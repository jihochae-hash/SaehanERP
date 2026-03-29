import { useState } from 'react'
import { where, orderBy } from 'firebase/firestore'
import { Button, Card, Input, Table, Badge } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { formatDate, formatNumber } from '@/utils/format'
import type { Inventory, InventoryTransaction } from '@/types'

export default function LotTrackingPage() {
  const [lotNo, setLotNo] = useState('')
  const [searchLot, setSearchLot] = useState('')

  const { data: stocks = [], isLoading: stockLoading } = useCollection<Inventory>(
    'inventory',
    searchLot ? [where('lotNo', '==', searchLot), orderBy('itemCode', 'asc')] : [],
    ['lot', searchLot],
  )

  const { data: transactions = [], isLoading: txLoading } = useCollection<InventoryTransaction>(
    'inventoryTransactions',
    searchLot ? [where('lotNo', '==', searchLot), orderBy('createdAt', 'desc')] : [],
    ['lot-tx', searchLot],
  )

  const handleSearch = () => {
    if (lotNo.trim()) setSearchLot(lotNo.trim())
  }

  const stockColumns = [
    { key: 'itemCode', label: '품목코드', width: '120px' },
    { key: 'itemName', label: '품목명' },
    { key: 'warehouseName', label: '창고', width: '120px' },
    { key: 'quantity', label: '현재수량', width: '100px', render: (val: unknown) => formatNumber(val as number) },
    { key: 'unit', label: '단위', width: '60px' },
    {
      key: 'expiryDate', label: '유효기한', width: '110px',
      render: (val: unknown) => {
        if (!val) return '—'
        const isExpired = new Date(String(val)) < new Date()
        return <Badge color={isExpired ? 'red' : 'green'}>{String(val)}</Badge>
      },
    },
  ]

  const txColumns = [
    { key: 'createdAt', label: '일시', width: '110px', render: (val: unknown) => formatDate(val) },
    {
      key: 'type', label: '유형', width: '80px',
      render: (val: unknown) => {
        const type = val as string
        const label = type === 'incoming' ? '입고' : type === 'outgoing' ? '출고' : type
        const color = type === 'incoming' ? 'blue' : type === 'outgoing' ? 'red' : 'gray'
        return <Badge color={color as 'blue' | 'red' | 'gray'}>{label}</Badge>
      },
    },
    { key: 'itemName', label: '품목명' },
    { key: 'warehouseName', label: '창고', width: '100px' },
    { key: 'quantity', label: '수량', width: '80px', render: (val: unknown) => formatNumber(val as number) },
    { key: 'notes', label: '비고', render: (val: unknown) => val ? String(val) : '' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">LOT 추적</h1>

      <Card>
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <Input
              placeholder="LOT번호를 입력하세요"
              value={lotNo}
              onChange={(e) => setLotNo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch}>조회</Button>
        </div>
      </Card>

      {searchLot && (
        <>
          <Card title={`LOT ${searchLot} — 현재 재고`} className="mt-4">
            <Table columns={stockColumns} data={stocks} loading={stockLoading} emptyMessage="해당 LOT 재고가 없습니다." />
          </Card>

          <Card title={`LOT ${searchLot} — 입출고 이력`} className="mt-4">
            <Table columns={txColumns} data={transactions} loading={txLoading} emptyMessage="해당 LOT 이력이 없습니다." />
          </Card>
        </>
      )}
    </div>
  )
}
