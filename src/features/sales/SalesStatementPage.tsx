import { useState, useMemo } from 'react'
import { orderBy, where } from 'firebase/firestore'
import { Card, Table, Input, Select } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { formatNumber } from '@/utils/format'

// --- 인라인 타입 ---

interface SalesOrderItem {
  itemCode: string
  itemName: string
  unit: string
  quantity: number
  unitPrice: number
  amount: number
}

interface SalesOrder {
  id: string
  type: 'order'
  orderNo: string
  customerName: string
  customerId: string
  orderDate: string
  items: SalesOrderItem[]
  totalAmount: number
  status: string
  createdAt: unknown
}

interface ShipmentItem {
  itemCode: string
  itemName: string
  lotNo: string
  quantity: number
}

interface Shipment {
  id: string
  shipmentNo: string
  salesOrderNo: string
  customerName: string
  shipmentDate: string
  items: ShipmentItem[]
  status: string
  createdAt: unknown
}

interface Partner {
  id: string
  code: string
  name: string
  type: string
}

/** 거래명세서에 표시할 행 */
interface StatementRow {
  id: string
  orderNo: string
  shipmentNo: string
  customerName: string
  date: string
  itemCode: string
  itemName: string
  lotNo: string
  quantity: number
  unitPrice: number
  amount: number
}

export default function SalesStatementPage() {
  const [searchCustomer, setSearchCustomer] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: orders = [], isLoading: loadingOrders } = useCollection<SalesOrder>(
    'salesOrders',
    [where('type', '==', 'order'), orderBy('createdAt', 'desc')],
    ['order'],
  )
  const { data: shipments = [], isLoading: loadingShipments } = useCollection<Shipment>(
    'salesShipments',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const { data: partners = [] } = useCollection<Partner>('partners', [orderBy('name', 'asc')], ['active'])

  const customerOptions = [
    { value: '', label: '전체 거래처' },
    ...partners
      .filter((p) => p.type === 'customer' || p.type === 'both')
      .map((p) => ({ value: p.name, label: p.name })),
  ]

  /** 수주 + 출하를 결합해서 거래명세서 행을 생성 */
  const rows = useMemo(() => {
    const result: StatementRow[] = []

    // 수주 기반으로 출하 데이터를 매칭
    for (const order of orders) {
      // 출하와 매칭되는 건 찾기
      const matchedShipments = shipments.filter((s) => s.salesOrderNo === order.orderNo)

      if (matchedShipments.length > 0) {
        // 출하가 있는 경우: 출하 품목 기준으로 행 생성 (단가는 수주에서 가져옴)
        for (const shipment of matchedShipments) {
          for (const sItem of shipment.items ?? []) {
            const orderItem = (order.items ?? []).find((oi) => oi.itemCode === sItem.itemCode)
            result.push({
              id: `${shipment.id}-${sItem.itemCode}-${sItem.lotNo}`,
              orderNo: order.orderNo,
              shipmentNo: shipment.shipmentNo,
              customerName: order.customerName,
              date: shipment.shipmentDate || order.orderDate,
              itemCode: sItem.itemCode,
              itemName: sItem.itemName,
              lotNo: sItem.lotNo || '',
              quantity: sItem.quantity,
              unitPrice: orderItem?.unitPrice ?? 0,
              amount: sItem.quantity * (orderItem?.unitPrice ?? 0),
            })
          }
        }
      } else {
        // 출하가 없는 경우: 수주 품목 기준으로 행 생성
        for (const oItem of order.items ?? []) {
          result.push({
            id: `${order.id}-${oItem.itemCode}`,
            orderNo: order.orderNo,
            shipmentNo: '-',
            customerName: order.customerName,
            date: order.orderDate,
            itemCode: oItem.itemCode,
            itemName: oItem.itemName,
            lotNo: '-',
            quantity: oItem.quantity,
            unitPrice: oItem.unitPrice,
            amount: oItem.amount,
          })
        }
      }
    }
    return result
  }, [orders, shipments])

  /** 필터링 */
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (searchCustomer && r.customerName !== searchCustomer) return false
      if (dateFrom && r.date < dateFrom) return false
      if (dateTo && r.date > dateTo) return false
      return true
    })
  }, [rows, searchCustomer, dateFrom, dateTo])

  const totalAmount = filteredRows.reduce((sum, r) => sum + r.amount, 0)

  const columns = [
    { key: 'date', label: '날짜', width: '100px' },
    { key: 'orderNo', label: '수주번호', width: '120px' },
    { key: 'shipmentNo', label: '출하번호', width: '120px' },
    { key: 'customerName', label: '거래처' },
    { key: 'itemCode', label: '품목코드', width: '100px' },
    { key: 'itemName', label: '품목명' },
    { key: 'lotNo', label: 'LOT', width: '100px' },
    { key: 'quantity', label: '수량', width: '70px', render: (val: unknown) => formatNumber(val as number) },
    { key: 'unitPrice', label: '단가', width: '100px', render: (val: unknown) => `₩${formatNumber(val as number)}` },
    { key: 'amount', label: '금액', width: '120px', render: (val: unknown) => `₩${formatNumber(val as number)}` },
  ]

  const isLoading = loadingOrders || loadingShipments

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">거래명세서</h1>
      </div>

      {/* 검색 필터 */}
      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="거래처"
            options={customerOptions}
            value={searchCustomer}
            onChange={(e) => setSearchCustomer(e.target.value)}
          />
          <Input
            label="시작일"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="종료일"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </Card>

      {/* 합계 */}
      <div className="mb-4 flex items-center gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-3">
          <span className="text-sm text-gray-500 mr-2">총 건수</span>
          <span className="text-lg font-bold text-gray-900">{formatNumber(filteredRows.length)}건</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-3">
          <span className="text-sm text-gray-500 mr-2">합계 금액</span>
          <span className="text-lg font-bold text-teal-600">₩{formatNumber(totalAmount)}</span>
        </div>
      </div>

      {/* 데이터 테이블 */}
      <Card>
        <Table columns={columns} data={filteredRows} loading={isLoading} emptyMessage="거래 내역이 없습니다." />
      </Card>
    </div>
  )
}
