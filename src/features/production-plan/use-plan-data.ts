/**
 * 생산계획 데이터 로딩/저장 훅
 * 기존 ERP의 boms/items 컬렉션에서 BOM 데이터를 읽어 PlanBomRow 형태로 변환
 * Firestore 컬렉션: boms, items, planOrders, orderMaterials, bulkStatus, mfgSchedules, fpSchedules
 */

import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useCollection, useCreateDocument, useUpdateDocument, useDeleteDocument } from '@/hooks/useFirestore'
import type {
  PlanBomRow,
  ProductionOrder,
  OrderMaterial,
  BulkStatus,
  MfgSchedule,
  FpSchedule,
  OrderWithMaterials,
  MaterialStatus,
} from '@/types/production-plan'
import type { Bom } from '@/types/rnd'
import type { Item } from '@/types/master'
import { buildBomIndex, resolveProductMaterials } from './bom-utils'

// ─── BOM 데이터 (기존 boms + items 컬렉션에서 변환) ───
export function usePlanBom() {
  const { data: boms = [], isLoading: bomsLoading } = useCollection<Bom>('boms', [], ['boms'], 0)
  const { data: items = [], isLoading: itemsLoading } = useCollection<Item>('items', [], ['items-for-bom'], 0)

  const bomRows: PlanBomRow[] = useMemo(() => {
    if (!boms.length) return []

    // 품목코드 → 조달구분 매핑
    const itemMap = new Map<string, Item>()
    items.forEach(item => itemMap.set(item.code, item))

    const rows: PlanBomRow[] = []
    boms.filter(b => b.isActive).forEach(bom => {
      bom.items.forEach(bi => {
        // 조달구분 결정: 코드 첫자리 + procurementType
        const itemInfo = itemMap.get(bi.itemCode)
        let matType = '구매'
        if (itemInfo?.procurementType === 'production' || String(bi.itemCode).startsWith('5')) {
          matType = '생산'
        } else if (itemInfo?.procurementType === 'supplied') {
          matType = '사급'
        }

        rows.push({
          productCode: bom.productItemCode,
          productName: bom.productItemName,
          matCode: bi.itemCode,
          matName: bi.itemName,
          matQty: bi.quantity,
          matType,
        })
      })
    })
    return rows
  }, [boms, items])

  const bomIndex = useMemo(() => buildBomIndex(bomRows), [bomRows])
  return { bomRows, bomIndex, isLoading: bomsLoading || itemsLoading }
}

// ─── 수주 데이터 ───
export function usePlanOrders() {
  return useCollection<ProductionOrder>('planOrders', [orderBy('createdAt', 'desc')], ['planOrders'], 0)
}

// ─── 부자재 입고 ───
export function useOrderMaterials() {
  return useCollection<OrderMaterial>('orderMaterials', [], ['orderMaterials'], 0)
}

// ─── 벌크 입고 ───
export function useBulkStatus() {
  return useCollection<BulkStatus>('bulkStatus', [], ['bulkStatus'], 0)
}

// ─── 제조일정 ───
export function useMfgSchedules() {
  return useCollection<MfgSchedule>('mfgSchedules', [], ['mfgSchedules'], 0)
}

// ─── 충포장일정 ───
export function useFpSchedules() {
  return useCollection<FpSchedule>('fpSchedules', [], ['fpSchedules'], 0)
}

// ─── CRUD mutations ───
export function usePlanMutations() {
  const createOrder = useCreateDocument('planOrders')
  const updateOrder = useUpdateDocument('planOrders')
  const deleteOrder = useDeleteDocument('planOrders')
  const createMaterial = useCreateDocument('orderMaterials')
  const updateMaterial = useUpdateDocument('orderMaterials')
  const deleteMaterial = useDeleteDocument('orderMaterials')
  const createBulk = useCreateDocument('bulkStatus')
  const updateBulk = useUpdateDocument('bulkStatus')
  const createMfgSchedule = useCreateDocument('mfgSchedules')
  const updateMfgSchedule = useUpdateDocument('mfgSchedules')
  const deleteMfgSchedule = useDeleteDocument('mfgSchedules')
  const createFpSchedule = useCreateDocument('fpSchedules')
  const updateFpSchedule = useUpdateDocument('fpSchedules')
  const deleteFpSchedule = useDeleteDocument('fpSchedules')

  return {
    createOrder, updateOrder, deleteOrder,
    createMaterial, updateMaterial, deleteMaterial,
    createBulk, updateBulk,
    createMfgSchedule, updateMfgSchedule, deleteMfgSchedule,
    createFpSchedule, updateFpSchedule, deleteFpSchedule,
  }
}

// ─── 주문 + 자재 결합 (기존 프로그램 getOrders 로직) ───
export function useOrdersWithMaterials() {
  const { data: orders = [], isLoading: ordersLoading } = usePlanOrders()
  const { data: allMats = [], isLoading: matsLoading } = useOrderMaterials()
  const { data: bulkStatuses = [], isLoading: bulkLoading } = useBulkStatus()
  const { bomRows, bomIndex, isLoading: bomLoading } = usePlanBom()

  const ordersWithMaterials: OrderWithMaterials[] = useMemo(() => {
    if (!orders.length) return []

    const matsByOrder: Record<string, OrderMaterial[]> = {}
    allMats.forEach(m => {
      if (!matsByOrder[m.orderId]) matsByOrder[m.orderId] = []
      matsByOrder[m.orderId].push(m)
    })

    const bulkMap: Record<string, BulkStatus> = {}
    bulkStatuses.forEach(b => { bulkMap[String(b.matCode)] = b })

    const resolveCache: Record<string, ReturnType<typeof resolveProductMaterials>> = {}

    return orders.map(o => {
      const savedMats = matsByOrder[o.id] || []
      const savedMap: Record<string, OrderMaterial> = {}
      const deletedCodes = new Set<string>()

      savedMats.forEach(m => {
        if (m.status === 'deleted') deletedCodes.add(String(m.matCode))
        else savedMap[String(m.matCode)] = m
      })

      if (!resolveCache[o.productCode]) {
        resolveCache[o.productCode] = resolveProductMaterials(o.productCode, o.productName, bomRows, bomIndex)
      }
      const resolved = resolveCache[o.productCode]

      // 부자재: BOM 기준 + 수동 추가분
      const materials = resolved.materials
        .filter(m => !deletedCodes.has(String(m.matCode)))
        .map(m => {
          const saved = savedMap[String(m.matCode)]
          return {
            id: saved?.id ?? '',
            orderId: o.id,
            matCode: m.matCode,
            matName: m.matName,
            matQty: m.matQty,
            matType: m.matType,
            status: (saved?.status ?? 'pending') as MaterialStatus,
            eta: saved?.eta ?? '',
            receivedDate: saved?.receivedDate ?? '',
            note: saved?.note ?? '',
            createdAt: saved?.createdAt ?? '',
            createdBy: saved?.createdBy ?? '',
            updatedAt: saved?.updatedAt ?? '',
            updatedBy: saved?.updatedBy ?? '',
          }
        })

      // 수동 추가된 자재 (BOM에 없는 것)
      savedMats.forEach(m => {
        if (m.status !== 'deleted' && !resolved.materials.some(r => String(r.matCode) === String(m.matCode)) && m.matType !== '생산') {
          materials.push(m)
        }
      })

      // 벌크(5번 코드)
      const bulkMaterials = resolved.bulks.map(b => {
        const st = bulkMap[String(b.matCode)]
        return {
          matCode: b.matCode,
          matName: b.matName,
          matQty: b.matQty,
          status: (st?.status ?? 'pending') as MaterialStatus,
          eta: st?.eta ?? '',
          receivedDate: st?.receivedDate ?? '',
        }
      })

      // 규격 자동 추정
      let spec = o.spec
      if (!spec && bulkMaterials.length) {
        const b5 = bulkMaterials.find(b => String(b.matCode).startsWith('5'))
        if (b5 && b5.matQty > 0) spec = Math.round(b5.matQty * 1000)
      }

      return { ...o, spec, materials, bulkMaterials } as OrderWithMaterials
    })
  }, [orders, allMats, bulkStatuses, bomRows, bomIndex])

  return {
    orders: ordersWithMaterials,
    isLoading: ordersLoading || matsLoading || bulkLoading || bomLoading,
  }
}

// ─── 주문 일괄 생성 ───
export function useBatchCreateOrders() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useCallback(async (
    orderDataList: Omit<ProductionOrder, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>[],
    bomRows: PlanBomRow[],
    bomIndex: Record<string, PlanBomRow[]>,
    existingOrders: ProductionOrder[],
  ) => {
    const now = new Date().toISOString()
    const uid = user?.uid ?? ''

    // 중복 체크
    const existingKeys = new Set(
      existingOrders
        .filter(o => o.orderNo)
        .map(o => `${o.orderNo}|${o.productCode}`),
    )

    const ordersRef = collection(db, 'planOrders')
    const matsRef = collection(db, 'orderMaterials')
    const resolveCache: Record<string, ReturnType<typeof resolveProductMaterials>> = {}

    let batch = writeBatch(db)
    let count = 0
    let created = 0
    let skipped = 0

    for (const od of orderDataList) {
      if (od.orderNo) {
        const key = `${od.orderNo}|${od.productCode}`
        if (existingKeys.has(key)) { skipped++; continue }
        existingKeys.add(key)
      }

      const orderDocRef = doc(ordersRef)
      batch.set(orderDocRef, { ...od, createdAt: now, createdBy: uid, updatedAt: now, updatedBy: uid })
      count++
      created++

      if (!resolveCache[od.productCode]) {
        resolveCache[od.productCode] = resolveProductMaterials(od.productCode, od.productName, bomRows, bomIndex)
      }
      const resolved = resolveCache[od.productCode]
      resolved.materials.forEach(mat => {
        const matDocRef = doc(matsRef)
        batch.set(matDocRef, {
          orderId: orderDocRef.id,
          matCode: mat.matCode,
          matName: mat.matName,
          matQty: mat.matQty,
          matType: mat.matType,
          status: 'pending',
          eta: '',
          receivedDate: '',
          note: '',
          createdAt: now,
          createdBy: uid,
          updatedAt: now,
          updatedBy: uid,
        })
        count++
      })

      if (count >= 400) {
        await batch.commit()
        batch = writeBatch(db)
        count = 0
      }
    }

    if (count > 0) await batch.commit()

    queryClient.invalidateQueries({ queryKey: ['planOrders'] })
    queryClient.invalidateQueries({ queryKey: ['orderMaterials'] })

    return { created, skipped }
  }, [queryClient, user])
}

// ─── 주문 일괄 삭제 ───
export function useBatchDeleteOrders() {
  const queryClient = useQueryClient()

  return useCallback(async (orderIds: string[]) => {
    if (!orderIds.length) return

    const idSet = new Set(orderIds)

    // 자재 삭제
    const matsSnap = await getDocs(collection(db, 'orderMaterials'))
    let batch = writeBatch(db)
    let count = 0
    matsSnap.docs.forEach(d => {
      if (idSet.has(d.data().orderId)) {
        batch.delete(d.ref)
        count++
        if (count >= 400) {
          batch.commit()
          batch = writeBatch(db)
          count = 0
        }
      }
    })

    // 주문 삭제
    orderIds.forEach(id => {
      batch.delete(doc(db, 'planOrders', id))
      count++
      if (count >= 400) {
        batch.commit()
        batch = writeBatch(db)
        count = 0
      }
    })

    if (count > 0) await batch.commit()

    queryClient.invalidateQueries({ queryKey: ['planOrders'] })
    queryClient.invalidateQueries({ queryKey: ['orderMaterials'] })
  }, [queryClient])
}
