import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Card, Table, Input, Badge } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { formatNumber } from '@/utils/format'
import type { Inventory } from '@/types'

export default function StockListPage() {
  const [search, setSearch] = useState('')

  const { data: stocks = [], isLoading } = useCollection<Inventory>(
    'inventory',
    [orderBy('itemCode', 'asc')],
    ['all'],
  )

  const filtered = stocks.filter(
    (s) =>
      s.itemName.includes(search) ||
      s.itemCode.includes(search) ||
      s.lotNo.includes(search) ||
      s.warehouseName.includes(search),
  )

  // 안전재고 이하 여부 판별용 (추후 items 조인 필요, 현재는 0 기준)
  const columns = [
    { key: 'itemCode', label: '품목코드', width: '120px' },
    { key: 'itemName', label: '품목명' },
    { key: 'warehouseName', label: '창고', width: '120px' },
    { key: 'lotNo', label: 'LOT번호', width: '150px' },
    {
      key: 'quantity', label: '수량', width: '100px',
      render: (val: unknown) => {
        const qty = val as number
        return (
          <span className={qty <= 0 ? 'text-red-600 font-semibold' : ''}>
            {formatNumber(qty)}
          </span>
        )
      },
    },
    { key: 'unit', label: '단위', width: '60px' },
    {
      key: 'expiryDate', label: '유효기한', width: '110px',
      render: (val: unknown) => {
        if (!val) return '—'
        const dateStr = String(val)
        const isExpired = new Date(dateStr) < new Date()
        return <Badge color={isExpired ? 'red' : 'gray'}>{dateStr}</Badge>
      },
    },
    { key: 'location', label: '위치', render: (val: unknown) => val ? String(val) : '—' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">재고현황</h1>

      <Card>
        <div className="mb-4">
          <Input
            placeholder="품목코드, 품목명, LOT번호, 창고 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="재고 데이터가 없습니다." />
        {!isLoading && filtered.length > 0 && (
          <div className="mt-3 text-sm text-gray-500 text-right">
            총 {filtered.length}건
          </div>
        )}
      </Card>
    </div>
  )
}
