import { useState, useMemo } from 'react'
import { orderBy } from 'firebase/firestore'
import { Card, Table, Input, Badge } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { formatNumber } from '@/utils/format'
import type { Inventory, Item } from '@/types'

/** 안전재고 비교 행 */
interface SafetyStockRow {
  id: string
  itemCode: string
  itemName: string
  safetyStock: number
  currentStock: number
  shortage: number
  unit: string
  isAlert: boolean
}

export default function SafetyStockAlertPage() {
  const [search, setSearch] = useState('')
  const [showAlertOnly, setShowAlertOnly] = useState(true)

  const { data: items = [], isLoading: itemsLoading } = useCollection<Item>('items', [orderBy('code', 'asc')], ['all'])
  const { data: stocks = [], isLoading: stocksLoading } = useCollection<Inventory>('inventory', [orderBy('itemCode', 'asc')], ['all'])

  const isLoading = itemsLoading || stocksLoading

  /** 품목별 현재 재고 합산 후 안전재고와 비교 */
  const safetyStockData = useMemo(() => {
    // 품목별 재고 합산
    const stockMap = new Map<string, number>()
    for (const s of stocks) {
      const current = stockMap.get(s.itemCode) ?? 0
      stockMap.set(s.itemCode, current + s.quantity)
    }

    const rows: SafetyStockRow[] = []
    for (const item of items) {
      if (item.safetyStock == null || item.safetyStock <= 0) continue

      const currentStock = stockMap.get(item.code) ?? 0
      const isAlert = currentStock <= item.safetyStock
      const shortage = item.safetyStock - currentStock

      rows.push({
        id: item.id,
        itemCode: item.code,
        itemName: item.name,
        safetyStock: item.safetyStock,
        currentStock,
        shortage: shortage > 0 ? shortage : 0,
        unit: item.unit,
        isAlert,
      })
    }

    // 부족량 내림차순 정렬 (위험한 항목이 위로)
    rows.sort((a, b) => b.shortage - a.shortage)
    return rows
  }, [items, stocks])

  const filtered = safetyStockData.filter((r) => {
    const matchSearch = r.itemCode.includes(search) || r.itemName.includes(search)
    const matchAlert = !showAlertOnly || r.isAlert
    return matchSearch && matchAlert
  })

  const alertCount = safetyStockData.filter((r) => r.isAlert).length

  const columns = [
    { key: 'itemCode', label: '품목코드', width: '120px' },
    { key: 'itemName', label: '품목명' },
    { key: 'unit', label: '단위', width: '60px' },
    {
      key: 'safetyStock', label: '안전재고', width: '100px',
      render: (val: unknown) => formatNumber(val as number),
    },
    {
      key: 'currentStock', label: '현재재고', width: '100px',
      render: (val: unknown, row: SafetyStockRow) => (
        <span className={row.isAlert ? 'text-red-600 font-semibold' : 'font-medium'}>
          {formatNumber(val as number)}
        </span>
      ),
    },
    {
      key: 'shortage', label: '부족량', width: '100px',
      render: (val: unknown) => {
        const qty = val as number
        if (qty === 0) return <span className="text-gray-400">—</span>
        return <span className="text-red-600 font-semibold">-{formatNumber(qty)}</span>
      },
    },
    {
      key: 'isAlert', label: '상태', width: '90px',
      render: (val: unknown) => {
        const alert = val as boolean
        return alert
          ? <Badge color="red">부족</Badge>
          : <Badge color="green">정상</Badge>
      },
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">안전재고 알림</h1>
        {alertCount > 0 && <Badge color="red">{alertCount}건 부족</Badge>}
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="품목코드, 품목명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAlertOnly}
              onChange={(e) => setShowAlertOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            부족 항목만 표시
          </label>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="안전재고 설정된 품목이 없습니다." />
        {!isLoading && filtered.length > 0 && (
          <div className="mt-3 text-sm text-gray-500 text-right">총 {filtered.length}개 품목</div>
        )}
      </Card>
    </div>
  )
}
