import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Card, Table, Input, Badge, Select } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { formatNumber } from '@/utils/format'
import type { Inventory, Warehouse, WarehouseTransfer } from '@/types'

export default function StockListPage() {
  const [search, setSearch] = useState('')
  const [whFilter, setWhFilter] = useState('')

  const { data: stocks = [], isLoading } = useCollection<Inventory>('inventory', [orderBy('itemCode', 'asc')], ['all'])
  const { data: warehouses = [] } = useCollection<Warehouse>('warehouses', [orderBy('name', 'asc')], ['active'])
  const { data: transfers = [] } = useCollection<WarehouseTransfer>('warehouseTransfers', [orderBy('createdAt', 'desc')], ['all'])

  const whOptions = [{ value: '', label: '전체 창고' }, ...warehouses.map((w) => ({ value: w.id, label: w.name }))]

  // 이동중인 품목 LOT 목록
  const inTransitLots = new Set<string>()
  transfers.filter((t) => t.status === 'in_transit').forEach((t) => {
    t.items.forEach((item) => inTransitLots.add(item.lotNo))
  })

  const filtered = stocks.filter((s) => {
    const matchSearch =
      s.itemName.includes(search) ||
      s.itemCode.includes(search) ||
      s.lotNo.includes(search) ||
      s.warehouseName.includes(search) ||
      s.location.includes(search)
    const matchWh = !whFilter || s.warehouseId === whFilter
    return matchSearch && matchWh
  })

  const inTransitCount = transfers.filter((t) => t.status === 'in_transit').length

  const columns = [
    { key: 'itemCode', label: '품목코드', width: '110px' },
    { key: 'itemName', label: '품목명' },
    { key: 'warehouseName', label: '창고', width: '110px' },
    {
      key: 'location', label: 'WMS 위치', width: '110px',
      render: (val: unknown) => val ? <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{String(val)}</span> : '—',
    },
    { key: 'lotNo', label: 'LOT번호', width: '140px' },
    {
      key: 'quantity', label: '수량', width: '90px',
      render: (val: unknown, row: Inventory) => {
        const qty = val as number
        const isTransit = inTransitLots.has(row.lotNo)
        return (
          <div className="flex items-center gap-1">
            <span className={qty <= 0 ? 'text-red-600 font-semibold' : ''}>{formatNumber(qty)}</span>
            {isTransit && <Badge color="yellow">이동중</Badge>}
          </div>
        )
      },
    },
    { key: 'unit', label: '단위', width: '50px' },
    {
      key: 'expiryDate', label: '유효기한', width: '100px',
      render: (val: unknown) => {
        if (!val) return '—'
        const dateStr = String(val)
        const isExpired = new Date(dateStr) < new Date()
        return <Badge color={isExpired ? 'red' : 'gray'}>{dateStr}</Badge>
      },
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">재고현황</h1>
        <Badge color="blue">WMS</Badge>
        {inTransitCount > 0 && <Badge color="yellow">{inTransitCount}건 이동중</Badge>}
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="품목코드, 품목명, LOT번호, 창고, 위치 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-40">
            <Select options={whOptions} value={whFilter} onChange={(e) => setWhFilter(e.target.value)} />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="재고 데이터가 없습니다." />
        {!isLoading && filtered.length > 0 && (
          <div className="mt-3 text-sm text-gray-500 text-right">총 {filtered.length}건</div>
        )}
      </Card>
    </div>
  )
}
