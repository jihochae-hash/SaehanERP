import { useMemo } from 'react'
import { orderBy, where } from 'firebase/firestore'
import { Card, Table, Badge } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { formatDate, formatNumber } from '@/utils/format'

// --- 인라인 타입 ---

type SalesOrderStatus = 'confirmed' | 'processing' | 'shipped' | 'completed' | 'cancelled'

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
  deliveryDate: string
  items: SalesOrderItem[]
  totalAmount: number
  status: SalesOrderStatus
  createdAt: unknown
}

const STATUS_BADGE: Record<SalesOrderStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' }> = {
  confirmed: { label: '확정', color: 'blue' },
  processing: { label: '진행중', color: 'purple' },
  shipped: { label: '출하완료', color: 'yellow' },
  completed: { label: '완료', color: 'green' },
  cancelled: { label: '취소', color: 'red' },
}

export default function SalesAnalysisPage() {
  const { data: orders = [], isLoading } = useCollection<SalesOrder>(
    'salesOrders',
    [where('type', '==', 'order'), orderBy('createdAt', 'desc')],
    ['order'],
  )

  /** 완료된 주문만 매출로 계산 */
  const completedOrders = useMemo(
    () => orders.filter((o) => o.status === 'completed' || o.status === 'shipped'),
    [orders],
  )

  /** 총 매출액 */
  const totalSales = useMemo(
    () => completedOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0),
    [completedOrders],
  )

  /** 총 수주 건수 */
  const totalOrders = orders.length

  /** 월별 매출 집계 */
  const monthlySales = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of completedOrders) {
      if (!o.orderDate) continue
      const month = o.orderDate.substring(0, 7) // YYYY-MM
      map.set(month, (map.get(month) ?? 0) + (o.totalAmount ?? 0))
    }
    // 최근 순 정렬
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, amount]) => ({ id: month, month, amount }))
  }, [completedOrders])

  /** 거래처별 매출 집계 */
  const customerSales = useMemo(() => {
    const map = new Map<string, { customerName: string; totalAmount: number; orderCount: number }>()
    for (const o of completedOrders) {
      const key = o.customerId || o.customerName
      const existing = map.get(key) ?? { customerName: o.customerName, totalAmount: 0, orderCount: 0 }
      existing.totalAmount += o.totalAmount ?? 0
      existing.orderCount += 1
      map.set(key, existing)
    }
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
  }, [completedOrders])

  /** 전체 수주 목록 컬럼 */
  const orderColumns = [
    { key: 'orderNo', label: '수주번호', width: '130px' },
    { key: 'customerName', label: '거래처' },
    { key: 'orderDate', label: '수주일', width: '100px' },
    {
      key: 'items',
      label: '품목수',
      width: '70px',
      render: (val: unknown) => (Array.isArray(val) ? `${val.length}건` : '0건'),
    },
    {
      key: 'totalAmount',
      label: '금액',
      width: '120px',
      render: (val: unknown) => `₩${formatNumber(val as number)}`,
    },
    {
      key: 'status',
      label: '상태',
      width: '90px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as SalesOrderStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    {
      key: 'createdAt',
      label: '작성일',
      width: '100px',
      render: (val: unknown) => formatDate(val),
    },
  ]

  /** 월별 매출 컬럼 */
  const monthlyColumns = [
    { key: 'month', label: '월', width: '120px' },
    {
      key: 'amount',
      label: '매출액',
      render: (val: unknown) => `₩${formatNumber(val as number)}`,
    },
  ]

  /** 거래처별 매출 컬럼 */
  const customerColumns = [
    { key: 'customerName', label: '거래처' },
    { key: 'orderCount', label: '건수', width: '80px', render: (val: unknown) => `${formatNumber(val as number)}건` },
    {
      key: 'totalAmount',
      label: '매출액',
      width: '150px',
      render: (val: unknown) => `₩${formatNumber(val as number)}`,
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">매출현황</h1>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4">
          <p className="text-sm text-gray-500">총 수주 건수</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(totalOrders)}건</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4">
          <p className="text-sm text-gray-500">매출 완료 건수</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatNumber(completedOrders.length)}건</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4">
          <p className="text-sm text-gray-500">총 매출액</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">₩{formatNumber(totalSales)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4">
          <p className="text-sm text-gray-500">거래처 수</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{formatNumber(customerSales.length)}곳</p>
        </div>
      </div>

      {/* 월별 / 거래처별 매출 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="월별 매출">
          <Table columns={monthlyColumns} data={monthlySales} loading={isLoading} emptyMessage="매출 데이터가 없습니다." />
        </Card>
        <Card title="거래처별 매출">
          <Table columns={customerColumns} data={customerSales} loading={isLoading} emptyMessage="매출 데이터가 없습니다." />
        </Card>
      </div>

      {/* 전체 수주 목록 */}
      <Card title="수주 목록">
        <Table columns={orderColumns} data={orders} loading={isLoading} emptyMessage="수주 내역이 없습니다." />
      </Card>
    </div>
  )
}
