import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Card, Table, Input, Badge } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { formatDate, formatNumber } from '@/utils/format'
import type { InventoryTransaction, TransactionType } from '@/types'

const TX_TYPE_BADGE: Record<TransactionType, { label: string; color: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray' }> = {
  incoming: { label: '입고', color: 'blue' },
  outgoing: { label: '출고', color: 'red' },
  transfer: { label: '이동', color: 'yellow' },
  adjustment_plus: { label: '조정(+)', color: 'green' },
  adjustment_minus: { label: '조정(-)', color: 'purple' },
  return: { label: '반품', color: 'gray' },
}

export default function TransactionListPage() {
  const [search, setSearch] = useState('')

  const { data: transactions = [], isLoading } = useCollection<InventoryTransaction>(
    'inventoryTransactions',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )

  const filtered = transactions.filter(
    (tx) =>
      tx.itemName.includes(search) ||
      tx.itemCode.includes(search) ||
      tx.lotNo.includes(search) ||
      tx.warehouseName.includes(search),
  )

  const columns = [
    {
      key: 'createdAt', label: '일시', width: '110px',
      render: (val: unknown) => formatDate(val),
    },
    {
      key: 'type', label: '유형', width: '90px',
      render: (val: unknown) => {
        const info = TX_TYPE_BADGE[val as TransactionType]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? String(val)}</Badge>
      },
    },
    { key: 'itemCode', label: '품목코드', width: '110px' },
    { key: 'itemName', label: '품목명' },
    { key: 'warehouseName', label: '창고', width: '100px' },
    { key: 'lotNo', label: 'LOT번호', width: '140px' },
    {
      key: 'quantity', label: '수량', width: '90px',
      render: (val: unknown, row: InventoryTransaction) => {
        const qty = val as number
        const isOut = row.type === 'outgoing' || row.type === 'adjustment_minus'
        return <span className={isOut ? 'text-red-600' : 'text-blue-600'}>{isOut ? '-' : '+'}{formatNumber(qty)}</span>
      },
    },
    { key: 'unit', label: '단위', width: '50px' },
    { key: 'notes', label: '비고', render: (val: unknown) => val ? String(val) : '' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">입출고이력</h1>

      <Card>
        <div className="mb-4">
          <Input
            placeholder="품목코드, 품목명, LOT번호, 창고 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="입출고 이력이 없습니다." />
        {!isLoading && filtered.length > 0 && (
          <div className="mt-3 text-sm text-gray-500 text-right">총 {filtered.length}건</div>
        )}
      </Card>
    </div>
  )
}
