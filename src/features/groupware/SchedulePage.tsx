import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'
import type { BaseDocument } from '@/types'

/** 일정 카테고리 */
type ScheduleCategory = 'meeting' | 'task' | 'event' | 'personal'

/** 일정 상태 */
type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled'

const CATEGORY_BADGE: Record<ScheduleCategory, { label: string; color: 'blue' | 'green' | 'yellow' | 'gray' }> = {
  meeting: { label: '회의', color: 'blue' },
  task: { label: '업무', color: 'green' },
  event: { label: '행사', color: 'yellow' },
  personal: { label: '개인', color: 'gray' },
}

const CATEGORY_OPTIONS = [
  { value: 'meeting', label: '회의' },
  { value: 'task', label: '업무' },
  { value: 'event', label: '행사' },
  { value: 'personal', label: '개인' },
]

const STATUS_BADGE: Record<ScheduleStatus, { label: string; color: 'blue' | 'green' | 'red' }> = {
  scheduled: { label: '예정', color: 'blue' },
  completed: { label: '완료', color: 'green' },
  cancelled: { label: '취소', color: 'red' },
}

const STATUS_OPTIONS = [
  { value: 'scheduled', label: '예정' },
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' },
]

/** 일정 (schedules 컬렉션) */
interface Schedule extends BaseDocument {
  title: string
  description?: string
  startDate: string
  endDate: string
  allDay: boolean
  category: ScheduleCategory
  assignedTo: string
  location?: string
  status: ScheduleStatus
}

interface ScheduleForm {
  title: string
  description: string
  startDate: string
  endDate: string
  allDay: boolean
  category: ScheduleCategory
  assignedTo: string
  location: string
  status: ScheduleStatus
}

export default function SchedulePage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const { data: schedules = [], isLoading } = useCollection<Schedule>('schedules', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('schedules')
  const updateMutation = useUpdateDocument('schedules')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ScheduleForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      title: '', description: '', startDate: '', endDate: '',
      allDay: false, category: 'meeting', assignedTo: '',
      location: '', status: 'scheduled',
    })
    setModalOpen(true)
  }

  const openEdit = (schedule: Schedule) => {
    setEditing(schedule)
    reset({
      title: schedule.title, description: schedule.description ?? '',
      startDate: schedule.startDate, endDate: schedule.endDate,
      allDay: schedule.allDay, category: schedule.category,
      assignedTo: schedule.assignedTo, location: schedule.location ?? '',
      status: schedule.status,
    })
    setModalOpen(true)
  }

  const onSave = async (data: ScheduleForm) => {
    const payload = {
      title: data.title,
      description: data.description || null,
      startDate: data.startDate,
      endDate: data.endDate,
      allDay: data.allDay,
      category: data.category,
      assignedTo: data.assignedTo,
      location: data.location || null,
      status: data.status,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const filtered = schedules.filter((s) => {
    const matchSearch =
      s.title.includes(search) ||
      s.assignedTo.includes(search) ||
      (s.location?.includes(search) ?? false)
    const matchCategory = !categoryFilter || s.category === categoryFilter
    const matchStatus = !statusFilter || s.status === statusFilter
    const matchDate = !dateFilter || s.startDate === dateFilter || (s.startDate <= dateFilter && s.endDate >= dateFilter)
    return matchSearch && matchCategory && matchStatus && matchDate
  })

  const columns = [
    {
      key: 'category', label: '분류', width: '80px',
      render: (val: unknown) => {
        const info = CATEGORY_BADGE[val as ScheduleCategory]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'title', label: '일정명' },
    { key: 'startDate', label: '시작일', width: '100px' },
    { key: 'endDate', label: '종료일', width: '100px' },
    {
      key: 'allDay', label: '종일', width: '60px',
      render: (val: unknown) => val ? <Badge color="blue">종일</Badge> : '-',
    },
    { key: 'assignedTo', label: '담당자', width: '100px' },
    { key: 'location', label: '장소', width: '120px', render: (val: unknown) => val ? String(val) : '-' },
    {
      key: 'status', label: '상태', width: '80px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as ScheduleStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: Schedule) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">일정관리</h1>
        <Button onClick={openCreate}>일정 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="일정명, 담당자, 장소 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-40">
            <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </div>
          <div className="w-28">
            <Select
              options={[{ value: '', label: '전체 분류' }, ...CATEGORY_OPTIONS]}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
          </div>
          <div className="w-28">
            <Select
              options={[{ value: '', label: '전체 상태' }, ...STATUS_OPTIONS]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="등록된 일정이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '일정 수정' : '일정 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <Input label="일정명 *" error={errors.title?.message} {...register('title', { required: '필수' })} />
          <Input label="설명" {...register('description')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="시작일 *" type="date" error={errors.startDate?.message} {...register('startDate', { required: '필수' })} />
            <Input label="종료일 *" type="date" error={errors.endDate?.message} {...register('endDate', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="분류" options={CATEGORY_OPTIONS} {...register('category')} />
            <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
            <Input label="담당자 *" error={errors.assignedTo?.message} {...register('assignedTo', { required: '필수' })} />
          </div>
          <Input label="장소" {...register('location')} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="allDay" {...register('allDay')} className="rounded border-gray-300" />
            <label htmlFor="allDay" className="text-sm text-gray-700">종일 일정</label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editing ? '수정' : '등록'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
