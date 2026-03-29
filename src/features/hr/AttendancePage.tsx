import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'

// --- 인라인 타입 ---

type AttendanceType = 'normal' | 'late' | 'absent' | 'vacation' | 'half_day'

interface Attendance {
  id: string
  employeeId: string
  employeeName: string
  date: string
  checkIn: string
  checkOut: string
  workHours: number
  overtimeHours: number
  type: AttendanceType
  notes: string
  createdAt: unknown
}

interface AttendanceForm {
  employeeId: string
  employeeName: string
  date: string
  checkIn: string
  checkOut: string
  workHours: string
  overtimeHours: string
  type: AttendanceType
  notes: string
}

// --- 상수 ---

const TYPE_BADGE: Record<AttendanceType, { label: string; color: 'green' | 'yellow' | 'red' | 'blue' | 'purple' }> = {
  normal: { label: '정상', color: 'green' },
  late: { label: '지각', color: 'yellow' },
  absent: { label: '결근', color: 'red' },
  vacation: { label: '휴가', color: 'blue' },
  half_day: { label: '반차', color: 'purple' },
}

const TYPE_OPTIONS = [
  { value: 'normal', label: '정상' },
  { value: 'late', label: '지각' },
  { value: 'absent', label: '결근' },
  { value: 'vacation', label: '휴가' },
  { value: 'half_day', label: '반차' },
]

export default function AttendancePage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Attendance | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: records = [], isLoading } = useCollection<Attendance>(
    'attendance',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const createMutation = useCreateDocument('attendance')
  const updateMutation = useUpdateDocument('attendance')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AttendanceForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      employeeId: '', employeeName: '', date: '',
      checkIn: '', checkOut: '', workHours: '',
      overtimeHours: '0', type: 'normal', notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (rec: Attendance) => {
    setEditing(rec)
    reset({
      employeeId: rec.employeeId ?? '',
      employeeName: rec.employeeName,
      date: rec.date,
      checkIn: rec.checkIn ?? '',
      checkOut: rec.checkOut ?? '',
      workHours: String(rec.workHours ?? 0),
      overtimeHours: String(rec.overtimeHours ?? 0),
      type: rec.type,
      notes: rec.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: AttendanceForm) => {
    const payload = {
      employeeId: data.employeeId || null,
      employeeName: data.employeeName,
      date: data.date,
      checkIn: data.checkIn || null,
      checkOut: data.checkOut || null,
      workHours: Number(data.workHours) || 0,
      overtimeHours: Number(data.overtimeHours) || 0,
      type: data.type,
      notes: data.notes || null,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const filtered = records.filter((r) => {
    const matchSearch =
      r.employeeName.includes(search) ||
      r.date.includes(search) ||
      (r.employeeId ?? '').includes(search)
    const matchType = !typeFilter || r.type === typeFilter
    return matchSearch && matchType
  })

  const columns = [
    { key: 'date', label: '날짜', width: '100px' },
    { key: 'employeeName', label: '사원명', width: '100px' },
    { key: 'checkIn', label: '출근', width: '80px', render: (val: unknown) => (val as string) || '-' },
    { key: 'checkOut', label: '퇴근', width: '80px', render: (val: unknown) => (val as string) || '-' },
    { key: 'workHours', label: '근무시간', width: '90px', render: (val: unknown) => `${val ?? 0}h` },
    { key: 'overtimeHours', label: '연장시간', width: '90px', render: (val: unknown) => `${val ?? 0}h` },
    {
      key: 'type', label: '구분', width: '80px',
      render: (val: unknown) => {
        const info = TYPE_BADGE[val as AttendanceType]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'notes', label: '비고', render: (val: unknown) => (val as string) || '-' },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: Attendance) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">근태관리</h1>
        <Button onClick={openCreate}>근태 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="사원명, 날짜, 사원ID 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
            <Select
              options={[{ value: '', label: '전체 구분' }, ...TYPE_OPTIONS]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="근태 기록이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '근태 수정' : '근태 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="사원명 *" error={errors.employeeName?.message} {...register('employeeName', { required: '필수' })} />
            <Input label="날짜 *" type="date" error={errors.date?.message} {...register('date', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="출근시간" type="time" {...register('checkIn')} />
            <Input label="퇴근시간" type="time" {...register('checkOut')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="근무시간" type="number" step="0.5" {...register('workHours')} />
            <Input label="연장시간" type="number" step="0.5" {...register('overtimeHours')} />
            <Select label="구분 *" options={TYPE_OPTIONS} {...register('type')} />
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
    </div>
  )
}
