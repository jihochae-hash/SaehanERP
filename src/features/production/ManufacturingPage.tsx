import { useState } from 'react'
import { orderBy, where } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'
import type { BaseDocument } from '@/types'

/** 제조 상태 */
type ManufacturingStatus = 'in_progress' | 'completed' | 'failed'

const STATUS_BADGE: Record<ManufacturingStatus, { label: string; color: 'blue' | 'green' | 'red' }> = {
  in_progress: { label: '진행중', color: 'blue' },
  completed: { label: '완료', color: 'green' },
  failed: { label: '실패', color: 'red' },
}

const STATUS_OPTIONS = [
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'failed', label: '실패' },
]

/** 제조 실적 (productionRecords 컬렉션, stage='manufacturing') */
interface ManufacturingRecord extends BaseDocument {
  stage: 'manufacturing'
  recordNo: string
  workOrderNo: string
  productName: string
  batchNo: string
  plannedQty: number
  actualQty: number
  unit: string
  startTime: string
  endTime: string
  status: ManufacturingStatus
  notes?: string
}

interface ManufacturingForm {
  recordNo: string
  workOrderNo: string
  productName: string
  batchNo: string
  plannedQty: string
  actualQty: string
  unit: string
  startTime: string
  endTime: string
  status: ManufacturingStatus
  notes: string
}

export default function ManufacturingPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ManufacturingRecord | null>(null)
  const [search, setSearch] = useState('')

  const { data: records = [], isLoading } = useCollection<ManufacturingRecord>(
    'productionRecords',
    [where('stage', '==', 'manufacturing'), orderBy('createdAt', 'desc')],
    ['manufacturing'],
  )
  const createMutation = useCreateDocument('productionRecords')
  const updateMutation = useUpdateDocument('productionRecords')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ManufacturingForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      recordNo: '', workOrderNo: '', productName: '', batchNo: '',
      plannedQty: '', actualQty: '', unit: 'kg', startTime: '', endTime: '',
      status: 'in_progress', notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (rec: ManufacturingRecord) => {
    setEditing(rec)
    reset({
      recordNo: rec.recordNo, workOrderNo: rec.workOrderNo,
      productName: rec.productName, batchNo: rec.batchNo,
      plannedQty: String(rec.plannedQty), actualQty: String(rec.actualQty),
      unit: rec.unit, startTime: rec.startTime, endTime: rec.endTime,
      status: rec.status, notes: rec.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: ManufacturingForm) => {
    const payload = {
      stage: 'manufacturing' as const,
      recordNo: data.recordNo,
      workOrderNo: data.workOrderNo,
      productName: data.productName,
      batchNo: data.batchNo,
      plannedQty: Number(data.plannedQty),
      actualQty: Number(data.actualQty),
      unit: data.unit,
      startTime: data.startTime,
      endTime: data.endTime,
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
    r.batchNo.includes(search),
  )

  const columns = [
    { key: 'recordNo', label: '기록번호', width: '120px' },
    { key: 'workOrderNo', label: '작업지시번호', width: '130px' },
    { key: 'productName', label: '제품명' },
    { key: 'batchNo', label: '배치번호', width: '120px' },
    {
      key: 'plannedQty', label: '계획수량', width: '100px',
      render: (val: unknown, row: ManufacturingRecord) => `${val} ${row.unit}`,
    },
    {
      key: 'actualQty', label: '실적수량', width: '100px',
      render: (val: unknown, row: ManufacturingRecord) => `${val} ${row.unit}`,
    },
    { key: 'startTime', label: '시작일시', width: '130px' },
    { key: 'endTime', label: '종료일시', width: '130px' },
    {
      key: 'status', label: '상태', width: '80px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as ManufacturingStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: ManufacturingRecord) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">제조실적</h1>
        <Button onClick={openCreate}>실적 등록</Button>
      </div>

      <Card>
        <div className="mb-4">
          <Input placeholder="기록번호, 작업지시번호, 제품명, 배치번호 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="제조실적이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '실적 수정' : '실적 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="기록번호 *" error={errors.recordNo?.message} {...register('recordNo', { required: '필수' })} />
            <Input label="작업지시번호 *" error={errors.workOrderNo?.message} {...register('workOrderNo', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="제품명 *" error={errors.productName?.message} {...register('productName', { required: '필수' })} />
            <Input label="배치번호 *" error={errors.batchNo?.message} {...register('batchNo', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="계획수량 *" type="number" error={errors.plannedQty?.message} {...register('plannedQty', { required: '필수' })} />
            <Input label="실적수량 *" type="number" error={errors.actualQty?.message} {...register('actualQty', { required: '필수' })} />
            <Select label="단위" options={[{ value: 'kg', label: 'kg' }, { value: 'L', label: 'L' }, { value: 'ea', label: 'ea' }]} {...register('unit')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="시작일시 *" type="datetime-local" error={errors.startTime?.message} {...register('startTime', { required: '필수' })} />
            <Input label="종료일시" type="datetime-local" {...register('endTime')} />
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
