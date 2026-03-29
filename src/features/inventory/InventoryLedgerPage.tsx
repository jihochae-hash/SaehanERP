import { useState, useMemo } from 'react'
import { orderBy } from 'firebase/firestore'
import { Card, Table, Input } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { formatNumber } from '@/utils/format'
import type { InventoryTransaction } from '@/types'

/** 수불부 행 (품목별 집계) */
interface LedgerRow {
  id: string
  itemCode: string
  itemName: string
  openingStock: number
  totalIn: number
  totalOut: number
  closingStock: number
  unit: string
}

export default function InventoryLedgerPage() {
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: transactions = [], isLoading } = useCollection<InventoryTransaction>(
    'inventoryTransactions',
    [orderBy('createdAt', 'asc')],
    ['all'],
  )

  /** 기간 필터링 및 품목별 집계 */
  const ledgerData = useMemo(() => {
    // 기간 이전 거래 (기초재고 산출) + 기간 내 거래 분리
    const itemMap = new Map<string, {
      itemCode: string
      itemName: string
      unit: string
      openingStock: number
      totalIn: number
      totalOut: number
    }>()

    for (const tx of transactions) {
      const txDate = tx.createdAt?.slice?.(0, 10) ?? ''
      const key = tx.itemCode

      if (!itemMap.has(key)) {
        itemMap.set(key, {
          itemCode: tx.itemCode,
          itemName: tx.itemName,
          unit: tx.unit,
          openingStock: 0,
          totalIn: 0,
          totalOut: 0,
        })
      }
      const row = itemMap.get(key)!

      const isIncoming = tx.type === 'incoming' || tx.type === 'transfer_in' || tx.type === 'adjustment_plus' || tx.type === 'return'
      const qty = tx.quantity

      // 기간 이전 → 기초재고에 반영
      if (startDate && txDate < startDate) {
        row.openingStock += isIncoming ? qty : -qty
      }
      // 기간 내 → 입고/출고에 반영
      else if ((!startDate || txDate >= startDate) && (!endDate || txDate <= endDate)) {
        if (isIncoming) {
          row.totalIn += qty
        } else {
          row.totalOut += qty
        }
      }
    }

    const rows: LedgerRow[] = []
    itemMap.forEach((val, key) => {
      rows.push({
        id: key,
        itemCode: val.itemCode,
        itemName: val.itemName,
        openingStock: val.openingStock,
        totalIn: val.totalIn,
        totalOut: val.totalOut,
        closingStock: val.openingStock + val.totalIn - val.totalOut,
        unit: val.unit,
      })
    })

    // 품목코드 정렬
    rows.sort((a, b) => a.itemCode.localeCompare(b.itemCode))
    return rows
  }, [transactions, startDate, endDate])

  const filtered = ledgerData.filter((r) =>
    r.itemCode.includes(search) || r.itemName.includes(search),
  )

  const columns = [
    { key: 'itemCode', label: '품목코드', width: '120px' },
    { key: 'itemName', label: '품목명' },
    { key: 'unit', label: '단위', width: '60px' },
    {
      key: 'openingStock', label: '기초재고', width: '100px',
      render: (val: unknown) => formatNumber(val as number),
    },
    {
      key: 'totalIn', label: '입고', width: '100px',
      render: (val: unknown) => {
        const qty = val as number
        return <span className={qty > 0 ? 'text-blue-600 font-medium' : ''}>{formatNumber(qty)}</span>
      },
    },
    {
      key: 'totalOut', label: '출고', width: '100px',
      render: (val: unknown) => {
        const qty = val as number
        return <span className={qty > 0 ? 'text-red-600 font-medium' : ''}>{formatNumber(qty)}</span>
      },
    },
    {
      key: 'closingStock', label: '기말재고', width: '100px',
      render: (val: unknown) => {
        const qty = val as number
        return <span className={qty < 0 ? 'text-red-600 font-semibold' : 'font-semibold'}>{formatNumber(qty)}</span>
      },
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">수불부</h1>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="품목코드, 품목명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-40">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="시작일" />
          </div>
          <div className="w-40">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="종료일" />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="수불 데이터가 없습니다." />
        {!isLoading && filtered.length > 0 && (
          <div className="mt-3 text-sm text-gray-500 text-right">총 {filtered.length}개 품목</div>
        )}
      </Card>
    </div>
  )
}
