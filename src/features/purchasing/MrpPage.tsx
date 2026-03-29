import { useState, useMemo } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Badge } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { formatNumber } from '@/utils/format'
import type { Bom, Inventory, WorkOrder } from '@/types'
import type { MrpResultItem } from '@/types'

/**
 * MRP 소요량 산출 페이지
 * 확정된 작업지시서 기반으로 BOM 전개 → 현재 재고 대비 부족 수량 계산
 */
export default function MrpPage() {
  const { data: workOrders = [] } = useCollection<WorkOrder>('workOrders', [orderBy('plannedStartDate', 'asc')], ['active'])
  const { data: boms = [] } = useCollection<Bom>('boms', [orderBy('productItemCode', 'asc')], ['active'])
  const { data: stocks = [] } = useCollection<Inventory>('inventory', [orderBy('itemCode', 'asc')], ['all'])

  const [calculated, setCalculated] = useState(false)

  // 진행중/계획 상태인 작업지시서만 대상
  const activeOrders = workOrders.filter((wo) => wo.status === 'planned' || wo.status === 'in_progress')

  /** MRP 산출 */
  const mrpResults = useMemo((): MrpResultItem[] => {
    if (!calculated) return []

    // 자재별 총 소요량 집계
    const requirements = new Map<string, { itemId: string; itemCode: string; itemName: string; unit: string; totalQty: number }>()

    for (const wo of activeOrders) {
      const bom = boms.find((b) => b.id === wo.bomId)
      if (!bom) continue

      const ratio = wo.plannedQuantity / bom.baseQuantity

      for (const bomItem of bom.items) {
        const needQty = bomItem.quantity * ratio * (1 + bomItem.lossRate / 100)
        const existing = requirements.get(bomItem.itemId)
        if (existing) {
          existing.totalQty += needQty
        } else {
          requirements.set(bomItem.itemId, {
            itemId: bomItem.itemId,
            itemCode: bomItem.itemCode,
            itemName: bomItem.itemName,
            unit: bomItem.unit,
            totalQty: needQty,
          })
        }
      }
    }

    // 현재 재고 대비 부족 수량 계산
    const results: MrpResultItem[] = []
    for (const [, req] of requirements) {
      const currentStock = stocks
        .filter((s) => s.itemId === req.itemId)
        .reduce((sum, s) => sum + s.quantity, 0)

      const shortage = Math.max(0, Math.round((req.totalQty - currentStock) * 1000) / 1000)
      results.push({
        itemId: req.itemId,
        itemCode: req.itemCode,
        itemName: req.itemName,
        unit: req.unit,
        requiredQuantity: Math.round(req.totalQty * 1000) / 1000,
        currentStock,
        shortageQuantity: shortage,
        needsOrder: shortage > 0,
      })
    }

    return results.sort((a, b) => (b.shortageQuantity > 0 ? 1 : 0) - (a.shortageQuantity > 0 ? 1 : 0) || a.itemCode.localeCompare(b.itemCode))
  }, [calculated, activeOrders, boms, stocks])

  const shortageCount = mrpResults.filter((r) => r.needsOrder).length

  const columns = [
    { key: 'itemCode', label: '품목코드', width: '110px' },
    { key: 'itemName', label: '품목명' },
    { key: 'unit', label: '단위', width: '60px' },
    { key: 'requiredQuantity', label: '소요량', width: '100px', render: (val: unknown) => formatNumber(val as number) },
    { key: 'currentStock', label: '현재재고', width: '100px', render: (val: unknown) => formatNumber(val as number) },
    {
      key: 'shortageQuantity', label: '부족량', width: '100px',
      render: (val: unknown) => {
        const qty = val as number
        return <span className={qty > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>{formatNumber(qty)}</span>
      },
    },
    {
      key: 'needsOrder', label: '발주필요', width: '90px',
      render: (val: unknown) => val ? <Badge color="red">발주필요</Badge> : <Badge color="green">충분</Badge>,
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">MRP 소요량 산출</h1>
        <Button onClick={() => setCalculated(true)}>소요량 산출</Button>
      </div>

      <Card title={`대상 작업지시: ${activeOrders.length}건 (계획/진행중)`} className="mb-4">
        <p className="text-sm text-gray-500">
          계획 또는 진행중인 작업지시서의 BOM을 전개하여 자재별 소요량을 산출합니다.
        </p>
      </Card>

      {calculated && (
        <Card title={`산출 결과 — 총 ${mrpResults.length}건 (발주필요 ${shortageCount}건)`}>
          <Table columns={columns} data={mrpResults} keyField="itemId" emptyMessage="산출 대상이 없습니다." />
        </Card>
      )}
    </div>
  )
}
