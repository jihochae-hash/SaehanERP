import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'
import type { BaseDocument } from '@/types'

/** 정비 유형 */
type MaintenanceType = 'preventive' | 'corrective' | 'breakdown'

/** 정비 상태 */
type MaintenanceStatus = 'reported' | 'in_progress' | 'completed'

const TYPE_BADGE: Record<MaintenanceType, { label: string; color: 'blue' | 'yellow' | 'red' }> = {
  preventive: { label: '예방정비', color: 'blue' },
  corrective: { label: '수정정비', color: 'yellow' },
  breakdown: { label: '고장수리', color: 'red' },
}

const TYPE_OPTIONS = [
  { value: 'preventive', label: '예방정비' },
  { value: 'corrective', label: '수정정비' },
  { value: 'breakdown', label: '고장수리' },
]

const STATUS_BADGE: Record<MaintenanceStatus, { label: string; color: 'red' | 'yellow' | 'green' }> = {
  reported: { label: '보고됨', color: 'red' },
  in_progress: { label: '진행중', color: 'yellow' },
  completed: { label: '완료', color: 'green' },
}

const STATUS_OPTIONS = [
  { value: 'reported', label: '보고됨' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
]

/** 정비/고장 이력 (maintenanceLogs 컬렉션) */
interface MaintenanceLog extends BaseDocument {
  logNo: string
  equipmentId: string
  equipmentName: string
  type: MaintenanceType
  description: string
  reportedDate: string
  completedDate?: string
  performedBy: string
  cost: number
  status: MaintenanceStatus
  notes?: string
}

interface MaintenanceForm {
  logNo: string
  equipmentId: string
  equipmentName: string
  type: MaintenanceType
  description: string
  reportedDate: string
  completedDate: string
  performedBy: string
  cost: string
  status: MaintenanceStatus
  notes: string
}

export default function MaintenanceLogPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MaintenanceLog | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: logs = [], isLoading } = useCollection<MaintenanceLog>('maintenanceLogs', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('maintenanceLogs')
  const updateMutation = useUpdateDocument('maintenanceLogs')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MaintenanceForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      logNo: '', equipmentId: '', equipmentName: '', type: 'preventive',
      description: '', reportedDate: '', completedDate: '', performedBy: '',
      cost: '', status: 'reported', notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (log: MaintenanceLog) => {
    setEditing(log)
    reset({
      logNo: log.logNo, equipmentId: log.equipmentId,
      equipmentName: log.equipmentName, type: log.type,
      description: log.description, reportedDate: log.reportedDate,
      completedDate: log.completedDate ?? '', performedBy: log.performedBy,
      cost: String(log.cost), status: log.status, notes: log.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: MaintenanceForm) => {
    const payload = {
      logNo: data.logNo,
      equipmentId: data.equipmentId,
      equipmentName: data.equipmentName,
      type: data.type,
      description: data.description,
      reportedDate: data.reportedDate,
      completedDate: data.completedDate || null,
      performedBy: data.performedBy,
      cost: Number(data.cost) || 0,
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

  const filtered = logs.filter((l) => {
    const matchSearch =
      l.logNo.includes(search) ||
      l.equipmentName.includes(search) ||
      l.performedBy.includes(search) ||
      l.description.includes(search)
    const matchStatus = !statusFilter || l.status === statusFilter
    const matchType = !typeFilter || l.type === typeFilter
    return matchSearch && matchStatus && matchType
  })

  const columns = [
    { key: 'logNo', label: '이력번호', width: '120px' },
    { key: 'equipmentName', label: '설비명' },
    {
      key: 'type', label: '유형', width: '100px',
      render: (val: unknown) => {
        const info = TYPE_BADGE[val as MaintenanceType]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'description', label: '내용' },
    { key: 'reportedDate', label: '보고일', width: '100px' },
    { key: 'completedDate', label: '완료일', width: '100px', render: (val: unknown) => val ? String(val) : '-' },
    { key: 'performedBy', label: '담당자', width: '100px' },
    {
      key: 'cost', label: '비용', width: '100px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    {
      key: 'status', label: '상태', width: '90px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as MaintenanceStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: MaintenanceLog) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">정비/고장 이력</h1>
        <Button onClick={openCreate}>이력 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="이력번호, 설비명, 담당자, 내용 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-32">
            <Select
              options={[{ value: '', label: '전체 유형' }, ...TYPE_OPTIONS]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
          <div className="w-32">
            <Select
              options={[{ value: '', label: '전체 상태' }, ...STATUS_OPTIONS]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="정비 이력이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '이력 수정' : '이력 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="이력번호 *" error={errors.logNo?.message} {...register('logNo', { required: '필수' })} />
            <Input label="설비명 *" error={errors.equipmentName?.message} {...register('equipmentName', { required: '필수' })} />
          </div>
          <Input label="설비 ID" {...register('equipmentId')} />
          <div className="grid grid-cols-3 gap-4">
            <Select label="유형" options={TYPE_OPTIONS} {...register('type')} />
            <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
            <Input label="담당자 *" error={errors.performedBy?.message} {...register('performedBy', { required: '필수' })} />
          </div>
          <Input label="내용 *" error={errors.description?.message} {...register('description', { required: '필수' })} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="보고일 *" type="date" error={errors.reportedDate?.message} {...register('reportedDate', { required: '필수' })} />
            <Input label="완료일" type="date" {...register('completedDate')} />
            <Input label="비용 (원)" type="number" {...register('cost')} />
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
