import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'

// --- 인라인 타입 ---

type ContactType = 'visit' | 'call' | 'email' | 'meeting'
type ContactLogStatus = 'pending' | 'completed'

interface ContactLog {
  id: string
  logDate: string
  partnerId: string
  partnerName: string
  contactType: ContactType
  subject: string
  content: string
  nextAction: string
  assignedTo: string
  status: ContactLogStatus
  createdAt: unknown
}

interface ContactLogForm {
  logDate: string
  partnerId: string
  partnerName: string
  contactType: ContactType
  subject: string
  content: string
  nextAction: string
  assignedTo: string
  status: ContactLogStatus
}

// --- 상수 ---

const CONTACT_TYPE_BADGE: Record<ContactType, { label: string; color: 'blue' | 'green' | 'yellow' | 'purple' }> = {
  visit: { label: '방문', color: 'blue' },
  call: { label: '전화', color: 'green' },
  email: { label: '이메일', color: 'yellow' },
  meeting: { label: '미팅', color: 'purple' },
}

const STATUS_BADGE: Record<ContactLogStatus, { label: string; color: 'gray' | 'green' }> = {
  pending: { label: '진행중', color: 'gray' },
  completed: { label: '완료', color: 'green' },
}

const CONTACT_TYPE_OPTIONS = [
  { value: 'visit', label: '방문' },
  { value: 'call', label: '전화' },
  { value: 'email', label: '이메일' },
  { value: 'meeting', label: '미팅' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: '진행중' },
  { value: 'completed', label: '완료' },
]

export default function ContactLogPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ContactLog | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: logs = [], isLoading } = useCollection<ContactLog>(
    'contactLogs',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const createMutation = useCreateDocument('contactLogs')
  const updateMutation = useUpdateDocument('contactLogs')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactLogForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      logDate: '', partnerId: '', partnerName: '',
      contactType: 'call', subject: '', content: '',
      nextAction: '', assignedTo: '', status: 'pending',
    })
    setModalOpen(true)
  }

  const openEdit = (log: ContactLog) => {
    setEditing(log)
    reset({
      logDate: log.logDate,
      partnerId: log.partnerId,
      partnerName: log.partnerName,
      contactType: log.contactType,
      subject: log.subject,
      content: log.content,
      nextAction: log.nextAction ?? '',
      assignedTo: log.assignedTo ?? '',
      status: log.status,
    })
    setModalOpen(true)
  }

  const onSave = async (data: ContactLogForm) => {
    const payload = {
      logDate: data.logDate,
      partnerId: data.partnerId || null,
      partnerName: data.partnerName,
      contactType: data.contactType,
      subject: data.subject,
      content: data.content,
      nextAction: data.nextAction || null,
      assignedTo: data.assignedTo || null,
      status: data.status,
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
      l.partnerName.includes(search) ||
      l.subject.includes(search) ||
      (l.assignedTo ?? '').includes(search)
    const matchType = !typeFilter || l.contactType === typeFilter
    return matchSearch && matchType
  })

  const columns = [
    { key: 'logDate', label: '일자', width: '100px' },
    { key: 'partnerName', label: '거래처' },
    {
      key: 'contactType', label: '유형', width: '90px',
      render: (val: unknown) => {
        const info = CONTACT_TYPE_BADGE[val as ContactType]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'subject', label: '제목' },
    { key: 'assignedTo', label: '담당자', width: '100px' },
    { key: 'nextAction', label: '후속조치', width: '150px' },
    {
      key: 'status', label: '상태', width: '80px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as ContactLogStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: ContactLog) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">연락/활동기록</h1>
        <Button onClick={openCreate}>기록 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="거래처, 제목, 담당자 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
            <Select
              options={[{ value: '', label: '전체 유형' }, ...CONTACT_TYPE_OPTIONS]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="연락/활동 기록이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '기록 수정' : '기록 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="일자 *" type="date" error={errors.logDate?.message} {...register('logDate', { required: '필수' })} />
            <Input label="거래처명 *" error={errors.partnerName?.message} {...register('partnerName', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="유형 *" options={CONTACT_TYPE_OPTIONS} {...register('contactType')} />
            <Input label="담당자" {...register('assignedTo')} />
            <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
          </div>
          <Input label="제목 *" error={errors.subject?.message} {...register('subject', { required: '필수' })} />
          <Input label="내용" {...register('content')} />
          <Input label="후속조치" {...register('nextAction')} />
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
