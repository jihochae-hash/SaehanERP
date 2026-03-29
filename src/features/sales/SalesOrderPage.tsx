import { useState } from 'react'
import { orderBy, where } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
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
  notes: string | null
  createdAt: unknown
}

interface Partner {
  id: string
  code: string
  name: string
  type: string
}

interface Item {
  id: string
  code: string
  name: string
  unit: string
  type: string
}

// --- 상수 ---

const STATUS_BADGE: Record<SalesOrderStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' }> = {
  confirmed: { label: '확정', color: 'blue' },
  processing: { label: '진행중', color: 'purple' },
  shipped: { label: '출하완료', color: 'yellow' },
  completed: { label: '완료', color: 'green' },
  cancelled: { label: '취소', color: 'red' },
}

interface OrderForm {
  orderNo: string
  customerId: string
  orderDate: string
  deliveryDate: string
  status: SalesOrderStatus
  notes: string
}

interface ItemForm {
  itemId: string
  quantity: string
  unitPrice: string
}

export default function SalesOrderPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SalesOrder | null>(null)
  const [orderItems, setOrderItems] = useState<SalesOrderItem[]>([])
  const [isItemModal, setItemModal] = useState(false)

  const { data: orders = [], isLoading } = useCollection<SalesOrder>(
    'salesOrders',
    [where('type', '==', 'order'), orderBy('createdAt', 'desc')],
    ['order'],
  )
  const { data: partners = [] } = useCollection<Partner>('partners', [orderBy('name', 'asc')], ['active'])
  const { data: items = [] } = useCollection<Item>('items', [orderBy('name', 'asc')], ['active'])
  const createMutation = useCreateDocument('salesOrders')
  const updateMutation = useUpdateDocument('salesOrders')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrderForm>()
  const { register: regItem, handleSubmit: handleItem, reset: resetItem } = useForm<ItemForm>()

  const customerOptions = partners
    .filter((p) => p.type === 'customer' || p.type === 'both')
    .map((p) => ({ value: p.id, label: `[${p.code}] ${p.name}` }))

  const itemOptions = items.map((i) => ({ value: i.id, label: `[${i.code}] ${i.name}` }))

  const openCreate = () => {
    setEditing(null)
    setOrderItems([])
    reset({ orderNo: '', customerId: '', orderDate: '', deliveryDate: '', status: 'confirmed', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (o: SalesOrder) => {
    setEditing(o)
    setOrderItems(o.items ?? [])
    reset({
      orderNo: o.orderNo,
      customerId: o.customerId,
      orderDate: o.orderDate,
      deliveryDate: o.deliveryDate,
      status: o.status,
      notes: o.notes ?? '',
    })
    setModalOpen(true)
  }

  const onAddItem = (data: ItemForm) => {
    const item = items.find((i) => i.id === data.itemId)
    if (!item) return
    const qty = Number(data.quantity)
    const price = Number(data.unitPrice)
    setOrderItems((prev) => [
      ...prev,
      {
        itemCode: item.code,
        itemName: item.name,
        unit: item.unit,
        quantity: qty,
        unitPrice: price,
        amount: qty * price,
      },
    ])
    resetItem()
    setItemModal(false)
  }

  const onSave = async (data: OrderForm) => {
    const partner = partners.find((p) => p.id === data.customerId)
    const totalAmount = orderItems.reduce((sum, i) => sum + i.amount, 0)
    const payload = {
      type: 'order',
      orderNo: data.orderNo,
      customerId: data.customerId,
      customerName: partner?.name ?? '',
      orderDate: data.orderDate,
      deliveryDate: data.deliveryDate,
      status: data.status,
      items: orderItems,
      totalAmount,
      notes: data.notes || null,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const columns = [
    { key: 'orderNo', label: '수주번호', width: '130px' },
    { key: 'customerName', label: '거래처' },
    { key: 'orderDate', label: '수주일', width: '100px' },
    { key: 'deliveryDate', label: '납기일', width: '100px' },
    {
      key: 'items',
      label: '품목수',
      width: '70px',
      render: (val: unknown) => (Array.isArray(val) ? `${val.length}건` : '0건'),
    },
    {
      key: 'totalAmount',
      label: '합계금액',
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
    {
      key: 'actions',
      label: '',
      width: '80px',
      sortable: false,
      render: (_: unknown, row: SalesOrder) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>
          수정
        </Button>
      ),
    },
  ]

  const itemColumns = [
    { key: 'itemCode', label: '품목코드', width: '100px' },
    { key: 'itemName', label: '품목명' },
    { key: 'quantity', label: '수량', width: '80px' },
    { key: 'unit', label: '단위', width: '50px' },
    { key: 'unitPrice', label: '단가', width: '100px', render: (val: unknown) => `₩${formatNumber(val as number)}` },
    { key: 'amount', label: '금액', width: '120px', render: (val: unknown) => `₩${formatNumber(val as number)}` },
    {
      key: 'actions',
      label: '',
      width: '60px',
      sortable: false,
      render: (_: unknown, row: SalesOrderItem) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOrderItems((p) => p.filter((i) => i.itemCode !== row.itemCode))}
        >
          삭제
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">수주관리</h1>
        <Button onClick={openCreate}>수주 등록</Button>
      </div>
      <Card>
        <Table columns={columns} data={orders} loading={isLoading} />
      </Card>

      {/* 수주 등록/수정 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '수주 수정' : '수주 등록'} size="xl">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="수주번호 *" error={errors.orderNo?.message} {...register('orderNo', { required: '필수' })} />
            <Select label="거래처 *" options={customerOptions} placeholder="거래처 선택" error={errors.customerId?.message} {...register('customerId', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="수주일 *" type="date" {...register('orderDate', { required: '필수' })} />
            <Input label="납기일 *" type="date" {...register('deliveryDate', { required: '필수' })} />
            <Select label="상태" options={Object.entries(STATUS_BADGE).map(([v, i]) => ({ value: v, label: i.label }))} {...register('status')} />
          </div>
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">수주 품목</h4>
              <Button size="sm" type="button" onClick={() => { resetItem(); setItemModal(true) }}>품목 추가</Button>
            </div>
            <Table columns={itemColumns} data={orderItems} keyField="itemCode" emptyMessage="품목을 추가하세요." />
            {orderItems.length > 0 && (
              <div className="mt-2 text-right text-sm font-semibold">
                합계: ₩{formatNumber(orderItems.reduce((s, i) => s + i.amount, 0))}
              </div>
            )}
          </div>
          <Input label="비고" {...register('notes')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? '수정' : '등록'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 품목 추가 모달 */}
      <Modal isOpen={isItemModal} onClose={() => setItemModal(false)} title="품목 추가">
        <form onSubmit={handleItem(onAddItem)} className="space-y-4">
          <Select label="품목 *" options={itemOptions} placeholder="품목 선택" {...regItem('itemId', { required: true })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="수량 *" type="number" step="0.01" {...regItem('quantity', { required: true })} />
            <Input label="단가 (원) *" type="number" {...regItem('unitPrice', { required: true })} />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setItemModal(false)}>취소</Button>
            <Button type="submit">추가</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
