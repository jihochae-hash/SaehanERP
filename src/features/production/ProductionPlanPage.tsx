import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import type { ProductionPlan } from '@/types'

const STATUS_BADGE = {
  draft: { label: '초안', color: 'gray' as const },
  confirmed: { label: '확정', color: 'green' as const },
  completed: { label: '완료', color: 'blue' as const },
}

interface PlanForm {
  name: string
  startDate: string
  endDate: string
  status: string
  notes: string
}

export default function ProductionPlanPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ProductionPlan | null>(null)

  const { data: plans = [], isLoading } = useCollection<ProductionPlan>('productionPlans', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('productionPlans')
  const updateMutation = useUpdateDocument('productionPlans')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PlanForm>()

  const openCreate = () => {
    setEditing(null)
    reset({ name: '', startDate: '', endDate: '', status: 'draft', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (plan: ProductionPlan) => {
    setEditing(plan)
    reset({ name: plan.name, startDate: plan.startDate, endDate: plan.endDate, status: plan.status, notes: plan.notes ?? '' })
    setModalOpen(true)
  }

  const onSave = async (data: PlanForm) => {
    const payload = {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      items: editing?.items ?? [],
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
    { key: 'name', label: '계획명' },
    { key: 'startDate', label: '시작일', width: '110px' },
    { key: 'endDate', label: '종료일', width: '110px' },
    {
      key: 'items', label: '품목수', width: '80px',
      render: (val: unknown) => Array.isArray(val) ? `${val.length}건` : '0건',
    },
    {
      key: 'status', label: '상태', width: '80px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as keyof typeof STATUS_BADGE]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: ProductionPlan) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">생산계획 (MPS)</h1>
        <Button onClick={openCreate}>계획 수립</Button>
      </div>

      <Card>
        <Table columns={columns} data={plans} loading={isLoading} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '생산계획 수정' : '생산계획 수립'}>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <Input label="계획명 *" error={errors.name?.message} {...register('name', { required: '필수' })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="시작일 *" type="date" {...register('startDate', { required: '필수' })} />
            <Input label="종료일 *" type="date" {...register('endDate', { required: '필수' })} />
          </div>
          <Select label="상태" options={[{value:'draft',label:'초안'},{value:'confirmed',label:'확정'},{value:'completed',label:'완료'}]} {...register('status')} />
          <Input label="비고" {...register('notes')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editing ? '수정' : '수립'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
