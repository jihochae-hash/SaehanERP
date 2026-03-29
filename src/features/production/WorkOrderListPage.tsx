import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'
import type { WorkOrder, WorkOrderStatus, Bom } from '@/types'

const STATUS_BADGE: Record<WorkOrderStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'red' }> = {
  planned: { label: '계획', color: 'gray' },
  in_progress: { label: '진행중', color: 'blue' },
  completed: { label: '완료', color: 'green' },
  cancelled: { label: '취소', color: 'red' },
}

const STATUS_OPTIONS = [
  { value: 'planned', label: '계획' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' },
]

interface WorkOrderForm {
  orderNo: string
  bomId: string
  plannedQuantity: string
  unit: string
  plannedStartDate: string
  plannedEndDate: string
  productionLine: string
  status: WorkOrderStatus
  notes: string
}

export default function WorkOrderListPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WorkOrder | null>(null)

  const { data: workOrders = [], isLoading } = useCollection<WorkOrder>('workOrders', [orderBy('createdAt', 'desc')], ['all'])
  const { data: boms = [] } = useCollection<Bom>('boms', [orderBy('productItemName', 'asc')], ['active'])
  const createMutation = useCreateDocument('workOrders')
  const updateMutation = useUpdateDocument('workOrders')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WorkOrderForm>()

  const bomOptions = boms.map((b) => ({ value: b.id, label: `[${b.productItemCode}] ${b.productItemName}` }))

  const openCreate = () => {
    setEditing(null)
    reset({ orderNo: '', bomId: '', plannedQuantity: '', unit: 'kg', plannedStartDate: '', plannedEndDate: '', productionLine: '', status: 'planned', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (wo: WorkOrder) => {
    setEditing(wo)
    reset({
      orderNo: wo.orderNo, bomId: wo.bomId,
      plannedQuantity: String(wo.plannedQuantity), unit: wo.unit,
      plannedStartDate: wo.plannedStartDate, plannedEndDate: wo.plannedEndDate,
      productionLine: wo.productionLine ?? '', status: wo.status, notes: wo.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: WorkOrderForm) => {
    const bom = boms.find((b) => b.id === data.bomId)
    const payload = {
      orderNo: data.orderNo,
      productItemId: bom?.productItemId ?? '',
      productItemCode: bom?.productItemCode ?? '',
      productItemName: bom?.productItemName ?? '',
      bomId: data.bomId,
      plannedQuantity: Number(data.plannedQuantity),
      unit: data.unit,
      plannedStartDate: data.plannedStartDate,
      plannedEndDate: data.plannedEndDate,
      productionLine: data.productionLine || null,
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

  const columns = [
    { key: 'orderNo', label: '지시번호', width: '130px' },
    { key: 'productItemName', label: '생산제품' },
    { key: 'plannedQuantity', label: '계획수량', width: '100px', render: (val: unknown, row: WorkOrder) => `${val} ${row.unit}` },
    { key: 'plannedStartDate', label: '시작예정', width: '110px' },
    { key: 'plannedEndDate', label: '종료예정', width: '110px' },
    { key: 'productionLine', label: '생산라인', width: '100px', render: (val: unknown) => val ? String(val) : '—' },
    {
      key: 'status', label: '상태', width: '80px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as WorkOrderStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '생성일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: WorkOrder) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">작업지시서</h1>
        <Button onClick={openCreate}>작업지시 생성</Button>
      </div>

      <Card>
        <Table columns={columns} data={workOrders} loading={isLoading} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '작업지시 수정' : '작업지시 생성'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="지시번호 *" error={errors.orderNo?.message} {...register('orderNo', { required: '필수' })} />
            <Select label="BOM (생산제품) *" options={bomOptions} placeholder="BOM 선택" error={errors.bomId?.message} {...register('bomId', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="계획수량 *" type="number" error={errors.plannedQuantity?.message} {...register('plannedQuantity', { required: '필수' })} />
            <Select label="단위" options={[{value:'kg',label:'kg'},{value:'L',label:'L'},{value:'ea',label:'ea'}]} {...register('unit')} />
            <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="시작예정일 *" type="date" {...register('plannedStartDate', { required: '필수' })} />
            <Input label="종료예정일 *" type="date" {...register('plannedEndDate', { required: '필수' })} />
          </div>
          <Input label="생산라인/탱크" placeholder="예: 1호 탱크" {...register('productionLine')} />
          <Input label="비고" {...register('notes')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editing ? '수정' : '생성'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
