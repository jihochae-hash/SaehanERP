import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'

// --- 인라인 타입 ---

type EntryType = 'general' | 'sales' | 'purchase'

interface JournalEntry {
  id: string
  entryNo: string
  entryDate: string
  type: EntryType
  description: string
  debitAccount: string
  debitAmount: number
  creditAccount: string
  creditAmount: number
  isLocked: boolean
  notes: string
  createdAt: unknown
}

interface JournalForm {
  entryNo: string
  entryDate: string
  type: EntryType
  description: string
  debitAccount: string
  debitAmount: string
  creditAccount: string
  creditAmount: string
  notes: string
}

// --- 상수 ---

const TYPE_BADGE: Record<EntryType, { label: string; color: 'gray' | 'blue' | 'green' }> = {
  general: { label: '일반', color: 'gray' },
  sales: { label: '매출', color: 'blue' },
  purchase: { label: '매입', color: 'green' },
}

const TYPE_OPTIONS = [
  { value: 'general', label: '일반' },
  { value: 'sales', label: '매출' },
  { value: 'purchase', label: '매입' },
]

export default function JournalEntryPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<JournalEntry | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: entries = [], isLoading } = useCollection<JournalEntry>(
    'journalEntries',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const createMutation = useCreateDocument('journalEntries')
  const updateMutation = useUpdateDocument('journalEntries')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<JournalForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      entryNo: '', entryDate: '', type: 'general',
      description: '', debitAccount: '', debitAmount: '',
      creditAccount: '', creditAmount: '', notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (entry: JournalEntry) => {
    if (entry.isLocked) return
    setEditing(entry)
    reset({
      entryNo: entry.entryNo,
      entryDate: entry.entryDate,
      type: entry.type,
      description: entry.description,
      debitAccount: entry.debitAccount,
      debitAmount: String(entry.debitAmount),
      creditAccount: entry.creditAccount,
      creditAmount: String(entry.creditAmount),
      notes: entry.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: JournalForm) => {
    const payload = {
      entryNo: data.entryNo,
      entryDate: data.entryDate,
      type: data.type,
      description: data.description,
      debitAccount: data.debitAccount,
      debitAmount: Number(data.debitAmount),
      creditAccount: data.creditAccount,
      creditAmount: Number(data.creditAmount),
      isLocked: false,
      notes: data.notes || null,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const filtered = entries.filter((e) => {
    const matchSearch =
      e.entryNo.includes(search) ||
      e.description.includes(search) ||
      e.debitAccount.includes(search) ||
      e.creditAccount.includes(search)
    const matchType = !typeFilter || e.type === typeFilter
    return matchSearch && matchType
  })

  const columns = [
    {
      key: 'entryNo', label: '전표번호', width: '130px',
      render: (val: unknown, row: JournalEntry) => (
        <span className="flex items-center gap-1">
          {row.isLocked && <span title="확정됨">🔒</span>}
          {val as string}
        </span>
      ),
    },
    { key: 'entryDate', label: '전표일자', width: '100px' },
    {
      key: 'type', label: '구분', width: '80px',
      render: (val: unknown) => {
        const info = TYPE_BADGE[val as EntryType]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'description', label: '적요' },
    { key: 'debitAccount', label: '차변계정', width: '120px' },
    {
      key: 'debitAmount', label: '차변금액', width: '120px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    { key: 'creditAccount', label: '대변계정', width: '120px' },
    {
      key: 'creditAmount', label: '대변금액', width: '120px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    {
      key: 'isLocked', label: '상태', width: '80px',
      render: (val: unknown) => (
        <Badge color={val ? 'green' : 'gray'}>{val ? '확정' : '미확정'}</Badge>
      ),
    },
    { key: 'createdAt', label: '작성일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: JournalEntry) =>
        row.isLocked ? null : (
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
        ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">전표입력</h1>
        <Button onClick={openCreate}>전표 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="전표번호, 적요, 계정 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
            <Select
              options={[{ value: '', label: '전체 구분' }, ...TYPE_OPTIONS]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="전표가 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '전표 수정' : '전표 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label="전표번호 *" error={errors.entryNo?.message} {...register('entryNo', { required: '필수' })} />
            <Input label="전표일자 *" type="date" error={errors.entryDate?.message} {...register('entryDate', { required: '필수' })} />
            <Select label="구분 *" options={TYPE_OPTIONS} {...register('type')} />
          </div>
          <Input label="적요 *" error={errors.description?.message} {...register('description', { required: '필수' })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="차변계정 *" error={errors.debitAccount?.message} {...register('debitAccount', { required: '필수' })} />
            <Input label="차변금액 (원) *" type="number" error={errors.debitAmount?.message} {...register('debitAmount', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="대변계정 *" error={errors.creditAccount?.message} {...register('creditAccount', { required: '필수' })} />
            <Input label="대변금액 (원) *" type="number" error={errors.creditAmount?.message} {...register('creditAmount', { required: '필수' })} />
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
