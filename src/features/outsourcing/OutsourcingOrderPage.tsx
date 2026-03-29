import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'
import type { BaseDocument } from '@/types'

/** 외주 상태 */
type OutsourcingStatus = 'ordered' | 'in_progress' | 'received' | 'cancelled'

const STATUS_BADGE: Record<OutsourcingStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'red' }> = {
  ordered: { label: '발주', color: 'gray' },
  in_progress: { label: '진행중', color: 'blue' },
  received: { label: '입고완료', color: 'green' },
  cancelled: { label: '취소', color: 'red' },
}

const STATUS_OPTIONS = [
  { value: 'ordered', label: '발주' },
  { value: 'in_progress', label: '진행중' },
  { value: 'received', label: '입고완료' },
  { value: 'cancelled', label: '취소' },
]

/** 외주 발주 (outsourcingOrders 컬렉션) */
interface OutsourcingOrder extends BaseDocument {
  orderNo: string
  partnerName: string
  productName: string
  quantity: number
  unit: string
  unitPrice: number
  amount: number
  orderDate: string
  dueDate: string
  status: OutsourcingStatus
  notes?: string
}

interface OutsourcingForm {
  orderNo: string
  partnerName: string
  productName: string
  quantity: string
  unit: string
  unitPrice: string
  orderDate: string
  dueDate: string
  status: OutsourcingStatus
  notes: string
}

export default function OutsourcingOrderPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<OutsourcingOrder | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: orders = [], isLoading } = useCollection<OutsourcingOrder>('outsourcingOrders', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('outsourcingOrders')
  const updateMutation = useUpdateDocument('outsourcingOrders')

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<OutsourcingForm>()

  /** 금액 자동 계산 */
  const qtyVal = Number(watch('quantity') || 0)
  const priceVal = Number(watch('unitPrice') || 0)
  const calculatedAmount = qtyVal * priceVal

  const openCreate = () => {
    setEditing(null)
    reset({
      orderNo: '', partnerName: '', productName: '',
      quantity: '', unit: 'ea', unitPrice: '',
      orderDate: '', dueDate: '', status: 'ordered', notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (order: OutsourcingOrder) => {
    setEditing(order)
    reset({
      orderNo: order.orderNo, partnerName: order.partnerName,
      productName: order.productName, quantity: String(order.quantity),
      unit: order.unit, unitPrice: String(order.unitPrice),
      orderDate: order.orderDate, dueDate: order.dueDate,
      status: order.status, notes: order.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: OutsourcingForm) => {
    const qty = Number(data.quantity)
    const price = Number(data.unitPrice)
    const payload = {
      orderNo: data.orderNo,
      partnerName: data.partnerName,
      productName: data.productName,
      quantity: qty,
      unit: data.unit,
      unitPrice: price,
      amount: qty * price,
      orderDate: data.orderDate,
      dueDate: data.dueDate,
      status: data.status,
      notes: data.notes || null,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.orderNo.includes(search) ||
      o.partnerName.includes(search) ||
      o.productName.includes(search)
    const matchStatus = !statusFilter || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const columns = [
    { key: 'orderNo', label: '발주번호', width: '120px' },
    { key: 'partnerName', label: '거래처' },
    { key: 'productName', label: '제품명' },
    {
      key: 'quantity', label: '수량', width: '90px',
      render: (val: unknown, row: OutsourcingOrder) => `${formatNumber(val as number)} ${row.unit}`,
    },
    {
      key: 'unitPrice', label: '단가', width: '100px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    {
      key: 'amount', label: '금액', width: '120px',
      render: (val: unknown) => <span className="font-semibold">{formatNumber(val as number)}원</span>,
    },
    { key: 'orderDate', label: '발주일', width: '100px' },
    {
      key: 'dueDate', label: '납기일', width: '100px',
      render: (val: unknown) => {
        const dateStr = String(val)
        const isOverdue = new Date(dateStr) < new Date()
        return <span className={isOverdue ? 'text-red-600' : ''}>{dateStr}</span>
      },
    },
    {
      key: 'status', label: '상태', width: '90px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as OutsourcingStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: OutsourcingOrder) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">외주관리</h1>
        <Button onClick={openCreate}>외주 발주</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="발주번호, 거래처, 제품명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
            <Select
              options={[{ value: '', label: '전체 상태' }, ...STATUS_OPTIONS]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="외주 발주가 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '외주 수정' : '외주 발주'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="발주번호 *" error={errors.orderNo?.message} {...register('orderNo', { required: '필수' })} />
            <Input label="거래처 *" error={errors.partnerName?.message} {...register('partnerName', { required: '필수' })} />
          </div>
          <Input label="제품명 *" error={errors.productName?.message} {...register('productName', { required: '필수' })} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="수량 *" type="number" error={errors.quantity?.message} {...register('quantity', { required: '필수' })} />
            <Select label="단위" options={[{ value: 'ea', label: 'ea' }, { value: 'kg', label: 'kg' }, { value: 'L', label: 'L' }, { value: 'box', label: 'box' }]} {...register('unit')} />
            <Input label="단가 (원) *" type="number" error={errors.unitPrice?.message} {...register('unitPrice', { required: '필수' })} />
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">합계금액:</span>
            <span className="font-semibold text-lg">{formatNumber(calculatedAmount)}원</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="발주일 *" type="date" error={errors.orderDate?.message} {...register('orderDate', { required: '필수' })} />
            <Input label="납기일 *" type="date" error={errors.dueDate?.message} {...register('dueDate', { required: '필수' })} />
            <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
          </div>
          <Input label="비고" {...register('notes')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editing ? '수정' : '발주'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
