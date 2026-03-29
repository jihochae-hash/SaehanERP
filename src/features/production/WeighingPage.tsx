import { useState } from 'react'
import { orderBy, where } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'
import type { BaseDocument } from '@/types'

/** 칭량 상태 */
type WeighingStatus = 'pending' | 'completed'

const STATUS_BADGE: Record<WeighingStatus, { label: string; color: 'yellow' | 'green' }> = {
  pending: { label: '대기', color: 'yellow' },
  completed: { label: '완료', color: 'green' },
}

const STATUS_OPTIONS = [
  { value: 'pending', label: '대기' },
  { value: 'completed', label: '완료' },
]

/** 칭량 기록 (productionRecords 컬렉션, stage='weighing') */
interface WeighingRecord extends BaseDocument {
  stage: 'weighing'
  recordNo: string
  workOrderNo: string
  productName: string
  ingredientName: string
  targetWeight: number
  actualWeight: number
  unit: string
  operatorName: string
  weighedAt: string
  status: WeighingStatus
  notes?: string
}

interface WeighingForm {
  recordNo: string
  workOrderNo: string
  productName: string
  ingredientName: string
  targetWeight: string
  actualWeight: string
  unit: string
  operatorName: string
  weighedAt: string
  status: WeighingStatus
  notes: string
}

export default function WeighingPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WeighingRecord | null>(null)
  const [search, setSearch] = useState('')

  const { data: records = [], isLoading } = useCollection<WeighingRecord>(
    'productionRecords',
    [where('stage', '==', 'weighing'), orderBy('createdAt', 'desc')],
    ['weighing'],
  )
  const createMutation = useCreateDocument('productionRecords')
  const updateMutation = useUpdateDocument('productionRecords')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WeighingForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      recordNo: '', workOrderNo: '', productName: '', ingredientName: '',
      targetWeight: '', actualWeight: '', unit: 'kg', operatorName: '',
      weighedAt: '', status: 'pending', notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (rec: WeighingRecord) => {
    setEditing(rec)
    reset({
      recordNo: rec.recordNo, workOrderNo: rec.workOrderNo,
      productName: rec.productName, ingredientName: rec.ingredientName,
      targetWeight: String(rec.targetWeight), actualWeight: String(rec.actualWeight),
      unit: rec.unit, operatorName: rec.operatorName,
      weighedAt: rec.weighedAt, status: rec.status, notes: rec.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: WeighingForm) => {
    const payload = {
      stage: 'weighing' as const,
      recordNo: data.recordNo,
      workOrderNo: data.workOrderNo,
      productName: data.productName,
      ingredientName: data.ingredientName,
      targetWeight: Number(data.targetWeight),
      actualWeight: Number(data.actualWeight),
      unit: data.unit,
      operatorName: data.operatorName,
      weighedAt: data.weighedAt,
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

  const filtered = records.filter((r) =>
    r.recordNo.includes(search) ||
    r.workOrderNo.includes(search) ||
    r.productName.includes(search) ||
    r.ingredientName.includes(search) ||
    r.operatorName.includes(search),
  )

  const columns = [
    { key: 'recordNo', label: '기록번호', width: '120px' },
    { key: 'workOrderNo', label: '작업지시번호', width: '130px' },
    { key: 'productName', label: '제품명' },
    { key: 'ingredientName', label: '원료명' },
    {
      key: 'targetWeight', label: '목표중량', width: '100px',
      render: (val: unknown, row: WeighingRecord) => `${val} ${row.unit}`,
    },
    {
      key: 'actualWeight', label: '실제중량', width: '100px',
      render: (val: unknown, row: WeighingRecord) => `${val} ${row.unit}`,
    },
    { key: 'operatorName', label: '작업자', width: '90px' },
    { key: 'weighedAt', label: '칭량일시', width: '110px' },
    {
      key: 'status', label: '상태', width: '80px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as WeighingStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: WeighingRecord) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">칭량관리 (POP)</h1>
        <Button onClick={openCreate}>칭량 등록</Button>
      </div>

      <Card>
        <div className="mb-4">
          <Input placeholder="기록번호, 작업지시번호, 제품명, 원료명, 작업자 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="칭량 기록이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '칭량 수정' : '칭량 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="기록번호 *" error={errors.recordNo?.message} {...register('recordNo', { required: '필수' })} />
            <Input label="작업지시번호 *" error={errors.workOrderNo?.message} {...register('workOrderNo', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="제품명 *" error={errors.productName?.message} {...register('productName', { required: '필수' })} />
            <Input label="원료명 *" error={errors.ingredientName?.message} {...register('ingredientName', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="목표중량 *" type="number" step="0.001" error={errors.targetWeight?.message} {...register('targetWeight', { required: '필수' })} />
            <Input label="실제중량 *" type="number" step="0.001" error={errors.actualWeight?.message} {...register('actualWeight', { required: '필수' })} />
            <Select label="단위" options={[{ value: 'kg', label: 'kg' }, { value: 'g', label: 'g' }, { value: 'L', label: 'L' }, { value: 'mL', label: 'mL' }]} {...register('unit')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="작업자 *" error={errors.operatorName?.message} {...register('operatorName', { required: '필수' })} />
            <Input label="칭량일시 *" type="datetime-local" error={errors.weighedAt?.message} {...register('weighedAt', { required: '필수' })} />
            <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
          </div>
          <Input label="비고" {...register('notes')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editing ? '수정' : '등록'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
