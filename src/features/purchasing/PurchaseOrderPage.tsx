import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'
import type { PurchaseOrder, PurchaseOrderStatus, PurchaseOrderItem, Partner, Item } from '@/types'

const STATUS_BADGE: Record<PurchaseOrderStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' }> = {
  draft: { label: '작성중', color: 'gray' },
  approved: { label: '승인', color: 'blue' },
  ordered: { label: '발주완료', color: 'purple' },
  partial_received: { label: '부분입고', color: 'yellow' },
  received: { label: '입고완료', color: 'green' },
  cancelled: { label: '취소', color: 'red' },
}

interface OrderForm {
  orderNo: string
  partnerId: string
  orderDate: string
  expectedDate: string
  status: PurchaseOrderStatus
  notes: string
}

interface OrderItemForm {
  itemId: string
  quantity: string
  unitPrice: string
  notes: string
}

export default function PurchaseOrderPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PurchaseOrder | null>(null)
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([])
  const [isItemModal, setItemModal] = useState(false)

  const { data: orders = [], isLoading } = useCollection<PurchaseOrder>('purchaseOrders', [orderBy('createdAt', 'desc')], ['all'])
  const { data: partners = [] } = useCollection<Partner>('partners', [orderBy('name', 'asc')], ['active'])
  const { data: items = [] } = useCollection<Item>('items', [orderBy('name', 'asc')], ['active'])
  const createMutation = useCreateDocument('purchaseOrders')
  const updateMutation = useUpdateDocument('purchaseOrders')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrderForm>()
  const { register: regItem, handleSubmit: handleItem, reset: resetItem } = useForm<OrderItemForm>()

  const supplierOptions = partners.filter((p) => p.type === 'supplier' || p.type === 'both').map((p) => ({ value: p.id, label: `[${p.code}] ${p.name}` }))
  const materialOptions = items.filter((i) => i.type !== 'finished').map((i) => ({ value: i.id, label: `[${i.code}] ${i.name}` }))

  const openCreate = () => {
    setEditing(null)
    setOrderItems([])
    reset({ orderNo: '', partnerId: '', orderDate: '', expectedDate: '', status: 'draft', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (po: PurchaseOrder) => {
    setEditing(po)
    setOrderItems(po.items ?? [])
    reset({ orderNo: po.orderNo, partnerId: po.partnerId, orderDate: po.orderDate, expectedDate: po.expectedDate, status: po.status, notes: po.notes ?? '' })
    setModalOpen(true)
  }

  const onAddItem = (data: OrderItemForm) => {
    const item = items.find((i) => i.id === data.itemId)
    if (!item) return
    const qty = Number(data.quantity)
    const price = Number(data.unitPrice)
    setOrderItems((prev) => [...prev, {
      itemId: item.id, itemCode: item.code, itemName: item.name, unit: item.unit,
      quantity: qty, unitPrice: price, amount: qty * price, notes: data.notes || undefined,
    }])
    resetItem()
    setItemModal(false)
  }

  const onSave = async (data: OrderForm) => {
    const partner = partners.find((p) => p.id === data.partnerId)
    const totalAmount = orderItems.reduce((sum, i) => sum + i.amount, 0)
    const payload = {
      orderNo: data.orderNo, partnerId: data.partnerId, partnerName: partner?.name ?? '',
      orderDate: data.orderDate, expectedDate: data.expectedDate, status: data.status,
      items: orderItems, totalAmount, notes: data.notes || null,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const columns = [
    { key: 'orderNo', label: '발주번호', width: '130px' },
    { key: 'partnerName', label: '거래처' },
    { key: 'orderDate', label: '발주일', width: '100px' },
    { key: 'expectedDate', label: '입고예정', width: '100px' },
    { key: 'items', label: '품목수', width: '70px', render: (val: unknown) => Array.isArray(val) ? `${val.length}건` : '0건' },
    { key: 'totalAmount', label: '합계금액', width: '120px', render: (val: unknown) => `₩${formatNumber(val as number)}` },
    {
      key: 'status', label: '상태', width: '90px',
      render: (val: unknown) => { const info = STATUS_BADGE[val as PurchaseOrderStatus]; return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge> },
    },
    { key: 'createdAt', label: '작성일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: PurchaseOrder) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>,
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
      key: 'actions', label: '', width: '60px', sortable: false,
      render: (_: unknown, row: PurchaseOrderItem) => <Button size="sm" variant="ghost" onClick={() => setOrderItems((p) => p.filter((i) => i.itemId !== row.itemId))}>삭제</Button>,
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">발주서 관리</h1>
        <Button onClick={openCreate}>발주서 작성</Button>
      </div>
      <Card>
        <Table columns={columns} data={orders} loading={isLoading} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '발주서 수정' : '발주서 작성'} size="xl">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="발주번호 *" error={errors.orderNo?.message} {...register('orderNo', { required: '필수' })} />
            <Select label="거래처 *" options={supplierOptions} placeholder="거래처 선택" error={errors.partnerId?.message} {...register('partnerId', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="발주일 *" type="date" {...register('orderDate', { required: '필수' })} />
            <Input label="입고예정일 *" type="date" {...register('expectedDate', { required: '필수' })} />
            <Select label="상태" options={Object.entries(STATUS_BADGE).map(([v, i]) => ({ value: v, label: i.label }))} {...register('status')} />
          </div>
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">발주 품목</h4>
              <Button size="sm" type="button" onClick={() => { resetItem(); setItemModal(true) }}>품목 추가</Button>
            </div>
            <Table columns={itemColumns} data={orderItems} keyField="itemId" emptyMessage="품목을 추가하세요." />
            {orderItems.length > 0 && (
              <div className="mt-2 text-right text-sm font-semibold">합계: ₩{formatNumber(orderItems.reduce((s, i) => s + i.amount, 0))}</div>
            )}
          </div>
          <Input label="비고" {...register('notes')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editing ? '수정' : '작성'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isItemModal} onClose={() => setItemModal(false)} title="품목 추가">
        <form onSubmit={handleItem(onAddItem)} className="space-y-4">
          <Select label="품목 *" options={materialOptions} placeholder="품목 선택" {...regItem('itemId', { required: true })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="수량 *" type="number" step="0.01" {...regItem('quantity', { required: true })} />
            <Input label="단가 (원) *" type="number" {...regItem('unitPrice', { required: true })} />
          </div>
          <Input label="비고" {...regItem('notes')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setItemModal(false)}>취소</Button>
            <Button type="submit">추가</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
