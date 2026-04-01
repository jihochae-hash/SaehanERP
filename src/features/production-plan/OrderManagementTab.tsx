/**
 * 수주/입고관리 탭
 * 기존 프로그램의 수주 등록 + 원부자재 입고현황 추적 UI 그대로 재현
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import * as XLSX from 'xlsx'
import type {
  OrderWithMaterials,
  PlanBomRow,
  MaterialStatus,
  MfgSchedule,
  FpSchedule,
  BulkOrderProduct,
  ProductionOrder,
} from '@/types/production-plan'
// MATERIAL_STATUS_LABEL removed - unused
import { resolveProductMaterials, getRelatedProducts } from './bom-utils'
import { usePlanMutations, useBatchCreateOrders, useBatchDeleteOrders } from './use-plan-data'

interface Props {
  orders: OrderWithMaterials[]
  bomRows: PlanBomRow[]
  bomIndex: Record<string, PlanBomRow[]>
  mfgSchedules: MfgSchedule[]
  fpSchedules: FpSchedule[]
}

// ─── 진행률 계산 ───
function orderProg(o: OrderWithMaterials): number {
  const pkgDone = (o.materials || []).filter(m => m.status === 'received' || m.status === 'in_stock' || m.status === 'special').length
  const bulkDone = (o.bulkMaterials || []).filter(m => m.status === 'received' || m.status === 'in_stock' || m.status === 'special').length
  const total = (o.materials || []).length + (o.bulkMaterials || []).length
  if (!total) return 0
  return Math.round((pkgDone + bulkDone) / total * 100)
}

// ─── 벌크 기준 그룹핑 (Union-Find) ───
function groupByBulk(orders: OrderWithMaterials[]) {
  const bulkMap = new Map<string, string[]>()
  const orderBulks = new Map<string, Set<string>>()

  orders.forEach(o => {
    const bCodes = (o.bulkMaterials || []).map(m => m.matCode)
    orderBulks.set(o.id, new Set(bCodes))
    bCodes.forEach(bc => {
      if (!bulkMap.has(bc)) bulkMap.set(bc, [])
      bulkMap.get(bc)!.push(o.id)
    })
  })

  const parent: Record<string, string> = {}
  const find = (x: string): string => { if (!parent[x]) parent[x] = x; return parent[x] === x ? x : (parent[x] = find(parent[x])) }
  const union = (a: string, b: string) => { parent[find(a)] = find(b) }
  bulkMap.forEach(ids => { for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]) })

  const groups = new Map<string, { bulkName: string | null; bulkCodes?: Set<string>; orders: OrderWithMaterials[] }>()
  orders.forEach(o => {
    const bCodes = [...(orderBulks.get(o.id) || [])]
    if (!bCodes.length) {
      groups.set('_solo_' + o.id, { bulkName: null, orders: [o] })
    } else {
      const root = find(o.id)
      if (!groups.has(root)) groups.set(root, { bulkCodes: new Set(), orders: [], bulkName: null })
      const g = groups.get(root)!
      bCodes.forEach(c => g.bulkCodes?.add(c))
      g.orders.push(o)
    }
  })

  const result: { bulkName: string | null; orders: OrderWithMaterials[] }[] = []
  groups.forEach(g => {
    if (g.bulkCodes && g.orders.length > 1) {
      const firstName = g.orders[0].bulkMaterials?.find(m => g.bulkCodes?.has(m.matCode))?.matName || '공유벌크'
      g.bulkName = firstName.length > 40 ? firstName.substring(0, 40) + '...' : firstName
    }
    result.push(g)
  })
  return result
}

// ─── 날짜 포맷 ───
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtShortDate(ds: string): string {
  if (!ds) return '-'
  const d = new Date(ds)
  if (isNaN(d.getTime())) return ds
  return `${d.getMonth() + 1}/${d.getDate()}`
}
function formatDateWithDay(ds: string): string {
  if (!ds) return ''
  const d = new Date(ds)
  if (isNaN(d.getTime())) return ds
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${ds} (${days[d.getDay()]})`
}

// ─── 상태 뱃지 색상 ───
function statusBadge(status: MaterialStatus) {
  const colors: Record<string, string> = {
    pending: 'bg-red-100 text-red-700',
    ordered: 'bg-yellow-100 text-yellow-700',
    in_transit: 'bg-blue-100 text-blue-700',
    received: 'bg-green-100 text-green-700',
    in_stock: 'bg-green-100 text-green-700',
    special: 'bg-purple-100 text-purple-700',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function OrderManagementTab({ orders, bomRows, bomIndex, mfgSchedules, fpSchedules }: Props) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  usePlanMutations() // 초기화 용
  const batchCreate = useBatchCreateOrders()
  const batchDelete = useBatchDeleteOrders()

  // ─── 상태 ───
  const [filter, setFilter] = useState<'all' | 'pending' | 'ready'>('all')
  const [search, setSearch] = useState('')
  const [showPast, setShowPast] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)

  // 벌크 중심 주문 등록 폼
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{ productCode: string; productName: string }[]>([])
  const [bulkProducts, setBulkProducts] = useState<BulkOrderProduct[]>([])
  const [selectedBulkName, setSelectedBulkName] = useState('')

  // 엑셀 업로드
  const [uploadRows, setUploadRows] = useState<Omit<ProductionOrder, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── 일정 관련 ───
  const getOrderScheduleDates = useCallback((orderId: string) => {
    const allSchedules = [...mfgSchedules, ...fpSchedules]
    const schList = allSchedules.filter(s => (s.orderIds || '').split(',').includes(orderId))
    if (!schList.length) return { dates: [] as { date: string; type: string }[], maxDate: '' }
    const dates = schList.map(s => ({ date: s.date, type: s.workType }))
    const maxDate = dates.reduce((mx, d) => d.date > mx ? d.date : mx, '')
    return { dates, maxDate }
  }, [mfgSchedules, fpSchedules])

  const isOrderPastProduction = useCallback((orderId: string) => {
    const { maxDate } = getOrderScheduleDates(orderId)
    if (!maxDate) return false
    return maxDate < fmtDate(new Date())
  }, [getOrderScheduleDates])

  // ─── 필터링된 주문 목록 ───
  const filteredOrders = useMemo(() => {
    let list = orders
    if (filter === 'pending') list = list.filter(o => orderProg(o) < 100)
    else if (filter === 'ready') list = list.filter(o => orderProg(o) === 100)
    if (!showPast) list = list.filter(o => !isOrderPastProduction(o.id))
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        o.productCode.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        (o.customer || '').toLowerCase().includes(q) ||
        (o.orderNo || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [orders, filter, search, showPast, isOrderPastProduction])

  const groups = useMemo(() => groupByBulk(filteredOrders), [filteredOrders])

  // ─── 제품 검색 ───
  const doProductSearch = useCallback((q: string) => {
    setProductSearch(q)
    if (!q) { setSearchResults([]); return }
    const lower = q.toLowerCase()
    const seen = new Set<string>()
    const results: { productCode: string; productName: string }[] = []
    for (const row of bomRows) {
      if (seen.has(row.productCode)) continue
      if (row.productCode.toLowerCase().includes(lower) || row.productName.toLowerCase().includes(lower)) {
        seen.add(row.productCode)
        results.push({ productCode: row.productCode, productName: row.productName })
        if (results.length >= 20) break
      }
    }
    setSearchResults(results)
  }, [bomRows])

  // ─── 제품 선택 → 벌크 기반 관련 제품 자동 추가 ───
  const selectProduct = useCallback((code: string, name: string) => {
    setProductSearch('')
    setSearchResults([])
    const resolved = resolveProductMaterials(code, name, bomRows, bomIndex)
    const related = getRelatedProducts(code, bomRows, bomIndex)

    const products: BulkOrderProduct[] = [
      { code, name, spec: 0, qty: 0, density: 0, customer: '', dueDate: '', orderNo: '', note: '' },
    ]

    // 관련 제품 자동 추가
    related.forEach(r => {
      if (!products.some(p => p.code === r.productCode)) {
        products.push({ code: r.productCode, name: r.productName, spec: 0, qty: 0, density: 0, customer: '', dueDate: '', orderNo: '', note: '' })
      }
    })

    setBulkProducts(products)
    if (resolved.bulks.length > 0) {
      setSelectedBulkName(resolved.bulks[0].matName)
    }
    setShowOrderForm(true)
  }, [bomRows, bomIndex])

  // ─── 주문 등록 ───
  const createBulkOrder = useCallback(async () => {
    const validProducts = bulkProducts.filter(p => p.qty > 0)
    if (!validProducts.length) return

    const orderDataList = validProducts.map(p => {
      const fillPerUnit = p.spec * p.density
      return {
        productCode: p.code,
        productName: p.name,
        spec: p.spec,
        density: p.density,
        qty: p.qty,
        dueDate: p.dueDate,
        customer: p.customer,
        orderNo: p.orderNo,
        note: p.note,
        fillPerUnit,
        totalFill: fillPerUnit * p.qty,
        bulkDate: '',
      }
    })

    await batchCreate(orderDataList, bomRows, bomIndex, orders)
    setBulkProducts([])
    setShowOrderForm(false)
  }, [bulkProducts, batchCreate, bomRows, bomIndex, orders])

  // ─── 엑셀 업로드 처리 ───
  const handleExcelUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })
      if (data.length < 2) return

      const hdr = data[0].map(h => String(h || '').trim())
      const cols = {
        orderNo: hdr.findIndex(h => /수주번호|수주NO/i.test(h)),
        code: hdr.findIndex(h => /완제품코드|제품코드|품목코드/i.test(h)),
        name: hdr.findIndex(h => /제품명|품목명|완제품명/i.test(h)),
        qty: hdr.findIndex(h => /주문수량|수량/i.test(h)),
        customer: hdr.findIndex(h => /고객사|거래처|업체/i.test(h)),
        dueDate: hdr.findIndex(h => /납기일|납기/i.test(h)),
      }

      if (cols.code < 0 || cols.name < 0 || cols.qty < 0) {
        alert('필수 컬럼(완제품코드, 제품명, 주문수량)을 찾을 수 없습니다')
        return
      }

      const rows = data.slice(1)
        .filter(r => r[cols.code] && r[cols.name] && Number(r[cols.qty]) > 0)
        .map(r => {
          const code = String(r[cols.code]).trim()
          const resolved = resolveProductMaterials(code, '', bomRows, bomIndex)
          const b5 = resolved.bulks.find(b => String(b.matCode).startsWith('5'))
          const spec = b5 ? Math.round(b5.matQty * 1000) : 0

          // 비중 데이터 (localStorage)
          let density = 0
          try {
            const sgData = JSON.parse(localStorage.getItem('sg_data') || '{}')
            if (b5) {
              const bulkName = b5.matName
              for (const [key, val] of Object.entries(sgData)) {
                if (bulkName.includes(key) || key.includes(bulkName)) {
                  density = Number(val)
                  break
                }
              }
            }
          } catch { /* ignore */ }

          const fillPerUnit = spec * density
          const qty = Number(r[cols.qty]) || 0

          return {
            productCode: code,
            productName: String(r[cols.name]).trim(),
            spec,
            density,
            qty,
            dueDate: cols.dueDate >= 0 ? String(r[cols.dueDate] || '').trim() : '',
            customer: cols.customer >= 0 ? String(r[cols.customer] || '').trim() : '',
            orderNo: cols.orderNo >= 0 ? String(r[cols.orderNo] || '').trim() : '',
            note: '',
            fillPerUnit,
            totalFill: fillPerUnit * qty,
            bulkDate: '',
          }
        })

      setUploadRows(rows)
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }, [bomRows, bomIndex])

  const submitUpload = useCallback(async () => {
    if (!uploadRows?.length) return
    const result = await batchCreate(uploadRows, bomRows, bomIndex, orders)
    alert(`${result.created}건 등록 완료${result.skipped ? `, ${result.skipped}건 중복 제외` : ''}`)
    setUploadRows(null)
  }, [uploadRows, batchCreate, bomRows, bomIndex, orders])

  // ─── 선택 삭제 ───
  const handleBulkDelete = useCallback(async () => {
    if (!selectedOrders.size) return
    if (!confirm(`${selectedOrders.size}건의 수주를 삭제하시겠습니까?`)) return
    await batchDelete([...selectedOrders])
    setSelectedOrders(new Set())
    setDetailOrderId(null)
  }, [selectedOrders, batchDelete])

  // ─── 상세 보기 대상 ───
  const detailOrder = useMemo(() => orders.find(o => o.id === detailOrderId), [orders, detailOrderId])

  // ─── 자재 상태 업데이트 ───
  const updateMaterialStatus = useCallback(async (matId: string, field: string, value: string) => {
    if (!matId) return
    const now = new Date().toISOString()
    await updateDoc(doc(db, 'orderMaterials', matId), {
      [field]: value,
      updatedAt: now,
      updatedBy: user?.uid ?? '',
    })
    queryClient.invalidateQueries({ queryKey: ['orderMaterials'] })
  }, [queryClient, user])

  const updateBulkStatusField = useCallback(async (matCode: string, field: string, value: string) => {
    // bulkStatus 문서를 matCode로 찾아서 업데이트
    const { data: bulkStatuses = [] } = queryClient.getQueryData<{ data: { id: string; matCode: string }[] }>(['bulkStatus', 'list']) || { data: [] }
    // getQueryData가 배열을 직접 반환하는 경우도 있으므로
    const allBulks = Array.isArray(bulkStatuses) ? bulkStatuses : []
    const found = allBulks.find((b: { matCode: string }) => String(b.matCode) === matCode) as { id: string } | undefined
    if (found?.id) {
      const now = new Date().toISOString()
      await updateDoc(doc(db, 'bulkStatus', found.id), {
        [field]: value,
        updatedAt: now,
        updatedBy: user?.uid ?? '',
      })
      queryClient.invalidateQueries({ queryKey: ['bulkStatus'] })
    }
  }, [queryClient, user])

  // ─── 주문 필드 업데이트 ───
  const updateOrderField = useCallback(async (orderId: string, field: string, value: string | number) => {
    const now = new Date().toISOString()
    await updateDoc(doc(db, 'planOrders', orderId), {
      [field]: value,
      updatedAt: now,
      updatedBy: user?.uid ?? '',
    })
    queryClient.invalidateQueries({ queryKey: ['planOrders'] })
  }, [queryClient, user])

  // ─── 벌크 폼 제품 필드 업데이트 ───
  const updateBulkProduct = useCallback((idx: number, field: keyof BulkOrderProduct, value: string | number) => {
    setBulkProducts(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }, [])

  return (
    <div className="space-y-4">
      {/* ─── 수주 등록 영역 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-teal-600">+</span> 수주 등록
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              📄 엑셀 업로드
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
          </div>
        </div>

        {/* 제품 검색 */}
        <div className="relative mb-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={productSearch}
              onChange={e => doProductSearch(e.target.value)}
              placeholder="완제품코드 또는 제품명으로 검색..."
              className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none transition"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-[400px] overflow-y-auto mt-1">
              {searchResults.map(r => (
                <div
                  key={r.productCode}
                  onClick={() => selectProduct(r.productCode, r.productName)}
                  className="px-4 py-2.5 hover:bg-teal-50 cursor-pointer border-b border-gray-50 last:border-0"
                >
                  <div className="text-xs text-teal-600 font-semibold">{r.productCode}</div>
                  <div className="text-sm">{r.productName}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 벌크 중심 주문 등록 폼 */}
        {showOrderForm && bulkProducts.length > 0 && (
          <div className="border-2 border-teal-200 rounded-xl p-4 bg-teal-50/30">
            {selectedBulkName && (
              <div className="text-xs text-purple-600 font-semibold mb-3 flex items-center gap-1">
                🧪 공유 벌크: {selectedBulkName}
              </div>
            )}
            <div className="space-y-3">
              {bulkProducts.map((p, idx) => (
                <div key={p.code} className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs text-teal-600 font-semibold">{p.code}</span>
                      <span className="ml-2 text-sm font-medium">{p.name}</span>
                    </div>
                    <button
                      onClick={() => setBulkProducts(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-500 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 block">수주번호</label>
                      <input value={p.orderNo} onChange={e => updateBulkProduct(idx, 'orderNo', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-teal-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block">고객사</label>
                      <input value={p.customer} onChange={e => updateBulkProduct(idx, 'customer', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-teal-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block">규격(g)</label>
                      <input type="number" value={p.spec || ''} onChange={e => updateBulkProduct(idx, 'spec', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-teal-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block">비중</label>
                      <input type="number" step="0.01" value={p.density || ''} onChange={e => updateBulkProduct(idx, 'density', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-teal-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block">주문수량</label>
                      <input type="number" value={p.qty || ''} onChange={e => updateBulkProduct(idx, 'qty', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-teal-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block">납기일</label>
                      <input type="date" value={p.dueDate} onChange={e => updateBulkProduct(idx, 'dueDate', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-teal-500 focus:outline-none" />
                    </div>
                    <div className="flex items-end">
                      {p.qty > 0 && p.spec > 0 && p.density > 0 && (
                        <span className="text-[10px] text-teal-600 font-semibold">
                          {((p.spec * p.density * p.qty) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}kg
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <button onClick={() => { setBulkProducts([]); setShowOrderForm(false) }}
                className="px-4 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                취소
              </button>
              <button onClick={createBulkOrder}
                className="px-4 py-2 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium">
                주문 등록
              </button>
            </div>
          </div>
        )}

        {/* 엑셀 업로드 미리보기 */}
        {uploadRows && (
          <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50/30 mt-4">
            <h4 className="font-semibold text-sm mb-2">📄 엑셀 업로드 미리보기 ({uploadRows.length}건)</h4>
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-2 py-1 text-left">수주번호</th>
                    <th className="px-2 py-1 text-left">고객사</th>
                    <th className="px-2 py-1 text-left">완제품코드</th>
                    <th className="px-2 py-1 text-left">제품명</th>
                    <th className="px-2 py-1 text-right">수량</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadRows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-2 py-1">{r.orderNo || '-'}</td>
                      <td className="px-2 py-1">{r.customer || '-'}</td>
                      <td className="px-2 py-1 text-teal-600 font-semibold">{r.productCode}</td>
                      <td className="px-2 py-1">{r.productName}</td>
                      <td className="px-2 py-1 text-right">{r.qty.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <button onClick={() => setUploadRows(null)}
                className="px-4 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition">취소</button>
              <button onClick={submitUpload}
                className="px-4 py-2 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium">
                {uploadRows.length}건 등록
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── 주문 목록 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        {/* 필터 바 */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs">
              <option value="all">전체</option>
              <option value="pending">진행중</option>
              <option value="ready">입고완료</option>
            </select>
            <div className="relative">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="검색..." className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs w-48 focus:border-teal-500 focus:outline-none" />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            </div>
            <label className="text-[10px] text-gray-500 flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)} /> 과거생산일정
            </label>
          </div>
          <div className="flex items-center gap-2">
            {selectedOrders.size > 0 && (
              <button onClick={handleBulkDelete}
                className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                {selectedOrders.size}건 삭제
              </button>
            )}
            <span className="text-xs text-gray-500">{filteredOrders.length}건</span>
          </div>
        </div>

        {/* 주문 테이블 */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-3xl mb-2">📦</div>
            <p>{orders.length ? '조건에 맞는 주문이 없습니다' : '등록된 수주가 없습니다'}</p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100">
                  <th className="px-2 py-2 w-8">
                    <input type="checkbox"
                      checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                      onChange={e => {
                        if (e.target.checked) setSelectedOrders(new Set(filteredOrders.map(o => o.id)))
                        else setSelectedOrders(new Set())
                      }}
                      className="cursor-pointer" />
                  </th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">상태</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">수주번호</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">완제품코드</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">완제품명</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">고객사</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-700">수량</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">납기일</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">제조일</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">충포장일</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-700">제조량</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">입고현황</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g, gi) => (
                  <GroupRows
                    key={gi}
                    group={g}
                    selectedOrders={selectedOrders}
                    detailOrderId={detailOrderId}
                    isOrderPastProduction={isOrderPastProduction}
                    getOrderScheduleDates={getOrderScheduleDates}
                    onToggleSelect={(id, checked) => {
                      setSelectedOrders(prev => {
                        const next = new Set(prev)
                        if (checked) next.add(id)
                        else next.delete(id)
                        return next
                      })
                    }}
                    onShowDetail={setDetailOrderId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 상세 보기 패널 ─── */}
      {detailOrder && (
        <DetailPanel
          order={detailOrder}
          onClose={() => setDetailOrderId(null)}
          onUpdateMaterial={updateMaterialStatus}
          onUpdateBulk={updateBulkStatusField}
          onUpdateOrder={updateOrderField}
        />
      )}
    </div>
  )
}

// ─── 그룹 행 렌더링 ───
function GroupRows({
  group,
  selectedOrders,
  detailOrderId,
  isOrderPastProduction,
  getOrderScheduleDates,
  onToggleSelect,
  onShowDetail,
}: {
  group: { bulkName: string | null; orders: OrderWithMaterials[] }
  selectedOrders: Set<string>
  detailOrderId: string | null
  isOrderPastProduction: (id: string) => boolean
  getOrderScheduleDates: (id: string) => { dates: { date: string; type: string }[]; maxDate: string }
  onToggleSelect: (id: string, checked: boolean) => void
  onShowDetail: (id: string) => void
}) {
  return (
    <>
      {group.bulkName && (
        <tr className="bg-purple-50">
          <td colSpan={12} className="px-3 py-1.5 text-[11px] font-semibold text-purple-600 border-l-3 border-purple-500">
            🧪 {group.bulkName} ({group.orders.length}개 제품,{' '}
            {group.orders.reduce((s, o) => s + (o.qty || 0), 0).toLocaleString()}개,{' '}
            {(group.orders.reduce((s, o) => s + (o.totalFill || 0), 0) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}kg)
          </td>
        </tr>
      )}
      {group.orders.map(o => {
        const p = orderProg(o)
        const pc = p === 100 ? 'bg-green-500' : p >= 50 ? 'bg-amber-500' : 'bg-red-500'
        const st = p === 100 ? '완료' : p > 0 ? '진행' : '대기'
        const sc = p === 100 ? 'bg-green-100 text-green-700' : p > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
        const rcvBulk = (o.bulkMaterials || []).filter(m => m.status === 'received' || m.status === 'in_stock' || m.status === 'special').length
        const rcvPkg = (o.materials || []).filter(m => m.status === 'received' || m.status === 'in_stock' || m.status === 'special').length
        const tot = (o.materials || []).length + (o.bulkMaterials || []).length
        const dueDate = o.dueDate ? o.dueDate.slice(0, 10) : ''
        const overdue = dueDate && new Date(dueDate) < new Date(new Date().toDateString())
        const { dates: schDates } = getOrderScheduleDates(o.id)
        const mfgDates = schDates.filter(d => d.type === 'bulk')
        const fpDates = schDates.filter(d => d.type !== 'bulk')
        const isPast = isOrderPastProduction(o.id)

        return (
          <tr
            key={o.id}
            onClick={() => onShowDetail(o.id)}
            className={`cursor-pointer border-b border-gray-50 hover:bg-teal-50 transition ${detailOrderId === o.id ? 'bg-teal-50 border-teal-200' : ''} ${isPast ? 'opacity-50' : ''}`}
          >
            <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={selectedOrders.has(o.id)}
                onChange={e => onToggleSelect(o.id, e.target.checked)} className="cursor-pointer" />
            </td>
            <td className="px-2 py-1.5">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sc}`}>{st}</span>
            </td>
            <td className="px-2 py-1.5 text-gray-500">{o.orderNo || '-'}</td>
            <td className="px-2 py-1.5">
              <span className="text-teal-600 font-semibold text-[10px]">{o.productCode}</span>
              {group.bulkName && <span className="ml-1 text-[9px] bg-purple-100 text-purple-600 px-1 rounded">공유</span>}
            </td>
            <td className="px-2 py-1.5 font-medium max-w-[200px] truncate">{o.productName}</td>
            <td className="px-2 py-1.5">{o.customer || '-'}</td>
            <td className="px-2 py-1.5 text-right">{o.qty ? o.qty.toLocaleString() + '개' : '-'}</td>
            <td className={`px-2 py-1.5 ${overdue ? 'text-red-600 font-semibold' : ''}`}>
              {dueDate ? formatDateWithDay(dueDate) : '-'}{overdue && ' !'}
            </td>
            <td className="px-2 py-1.5 text-gray-500">{o.bulkDate ? fmtShortDate(o.bulkDate) : mfgDates.length ? mfgDates.map(d => fmtShortDate(d.date)).join(', ') : '-'}</td>
            <td className="px-2 py-1.5 text-gray-500">{fpDates.length ? fpDates.map(d => fmtShortDate(d.date)).join(', ') : '-'}</td>
            <td className="px-2 py-1.5 text-right">{o.totalFill ? (o.totalFill / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + 'kg' : '-'}</td>
            <td className="px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pc}`} style={{ width: `${p}%` }} />
                </div>
                <span className={`text-[11px] font-medium ${p === 100 ? 'text-green-600' : p > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                  {rcvBulk + rcvPkg}/{tot}
                </span>
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}

// ─── 상세 패널 ───
function DetailPanel({
  order,
  onClose,
  onUpdateMaterial,
  onUpdateBulk,
  onUpdateOrder,
}: {
  order: OrderWithMaterials
  onClose: () => void
  onUpdateMaterial: (matId: string, field: string, value: string) => Promise<void>
  onUpdateBulk: (matCode: string, field: string, value: string) => Promise<void>
  onUpdateOrder: (orderId: string, field: string, value: string | number) => Promise<void>
}) {
  const o = order

  return (
    <div className="bg-white rounded-xl border-2 border-teal-200 p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs text-teal-600 font-semibold">{o.productCode}</span>
          <h3 className="text-lg font-bold">{o.productName}</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
      </div>

      {/* 주문 정보 편집 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4 bg-gray-50 rounded-lg p-3">
        <div>
          <label className="text-[10px] text-gray-500 block">수주번호</label>
          <input defaultValue={o.orderNo} onBlur={e => onUpdateOrder(o.id, 'orderNo', e.target.value)}
            className="w-full border-b border-gray-300 bg-transparent text-sm font-medium focus:border-teal-500 focus:outline-none py-0.5" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block">고객사</label>
          <input defaultValue={o.customer} onBlur={e => onUpdateOrder(o.id, 'customer', e.target.value)}
            className="w-full border-b border-gray-300 bg-transparent text-sm font-medium focus:border-teal-500 focus:outline-none py-0.5" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block">규격(g)</label>
          <input type="number" defaultValue={o.spec || ''} onBlur={e => onUpdateOrder(o.id, 'spec', Number(e.target.value))}
            className="w-full border-b border-gray-300 bg-transparent text-sm font-medium focus:border-teal-500 focus:outline-none py-0.5" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block">비중</label>
          <input type="number" step="0.01" defaultValue={o.density || ''} onBlur={e => onUpdateOrder(o.id, 'density', Number(e.target.value))}
            className="w-full border-b border-gray-300 bg-transparent text-sm font-medium focus:border-teal-500 focus:outline-none py-0.5" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block">수량</label>
          <input type="number" defaultValue={o.qty || ''} onBlur={e => onUpdateOrder(o.id, 'qty', Number(e.target.value))}
            className="w-full border-b border-gray-300 bg-transparent text-sm font-medium focus:border-teal-500 focus:outline-none py-0.5" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block">납기일</label>
          <input type="date" defaultValue={o.dueDate?.slice(0, 10)} onBlur={e => onUpdateOrder(o.id, 'dueDate', e.target.value)}
            className="w-full border-b border-gray-300 bg-transparent text-sm font-medium focus:border-teal-500 focus:outline-none py-0.5" />
        </div>
      </div>

      {/* 충진량 요약 */}
      {o.spec > 0 && o.density > 0 && o.qty > 0 && (
        <div className="bg-teal-50 border-2 border-teal-500 rounded-lg px-4 py-3 mb-4 flex gap-6 items-center">
          <div>
            <div className="text-[10px] text-gray-500">1개당 충진량</div>
            <div className="text-lg font-bold text-teal-700">{(o.spec * o.density).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}g</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">총 충진량</div>
            <div className="text-lg font-bold text-teal-700">
              {((o.spec * o.density * o.qty) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}kg
            </div>
          </div>
        </div>
      )}

      {/* 원자재(벌크) 입고 현황 */}
      {(o.bulkMaterials || []).length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-semibold bg-teal-50 text-teal-700 px-3 py-2 rounded-t-lg">
            🧪 원자재(벌크) 입고현황
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-1.5 text-left font-semibold">자재코드</th>
                <th className="px-3 py-1.5 text-left font-semibold">자재명</th>
                <th className="px-3 py-1.5 text-left font-semibold">상태</th>
                <th className="px-3 py-1.5 text-left font-semibold">입고예정일</th>
              </tr>
            </thead>
            <tbody>
              {o.bulkMaterials.map((m, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-3 py-1.5 text-teal-600 font-semibold">{m.matCode}</td>
                  <td className="px-3 py-1.5">{m.matName}</td>
                  <td className="px-3 py-1.5">
                    <select
                      value={m.status}
                      onChange={e => onUpdateBulk(m.matCode, 'status', e.target.value)}
                      className={`text-[11px] px-2 py-0.5 rounded border border-gray-200 ${statusBadge(m.status)}`}
                    >
                      <option value="pending">미입고</option>
                      <option value="ordered">발주완료</option>
                      <option value="in_transit">입고예정</option>
                      <option value="received">입고완료</option>
                      <option value="in_stock">재고있음</option>
                      <option value="special">별도처리</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="date" value={m.eta || ''} onChange={e => onUpdateBulk(m.matCode, 'eta', e.target.value)}
                      className="text-xs px-1 py-0.5 border border-gray-200 rounded focus:border-teal-500 focus:outline-none" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 부자재 입고 현황 */}
      {(o.materials || []).length > 0 && (
        <div>
          <div className="text-sm font-semibold bg-green-50 text-green-700 px-3 py-2 rounded-t-lg">
            📦 부자재 입고현황
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-1.5 text-left font-semibold">자재코드</th>
                <th className="px-3 py-1.5 text-left font-semibold">자재명</th>
                <th className="px-3 py-1.5 text-left font-semibold">구분</th>
                <th className="px-3 py-1.5 text-left font-semibold">상태</th>
                <th className="px-3 py-1.5 text-left font-semibold">입고예정일</th>
              </tr>
            </thead>
            <tbody>
              {o.materials.map((m, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-3 py-1.5 text-teal-600 font-semibold">{m.matCode}</td>
                  <td className="px-3 py-1.5">{m.matName}</td>
                  <td className="px-3 py-1.5 text-gray-500">{m.matType}</td>
                  <td className="px-3 py-1.5">
                    <select
                      value={m.status}
                      onChange={e => { if (m.id) onUpdateMaterial(m.id, 'status', e.target.value) }}
                      className={`text-[11px] px-2 py-0.5 rounded border border-gray-200 ${statusBadge(m.status)}`}
                    >
                      <option value="pending">미입고</option>
                      <option value="ordered">발주완료</option>
                      <option value="in_transit">입고예정</option>
                      <option value="received">입고완료</option>
                      <option value="in_stock">재고있음</option>
                      <option value="special">별도처리</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="date" value={m.eta || ''}
                      onChange={e => { if (m.id) onUpdateMaterial(m.id, 'eta', e.target.value) }}
                      className="text-xs px-1 py-0.5 border border-gray-200 rounded focus:border-teal-500 focus:outline-none" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
