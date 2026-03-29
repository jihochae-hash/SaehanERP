import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'
import type { BaseDocument } from '@/types'

/** CGMP 문서 유형 (부적합/CAPA 제외) */
type CgmpDocType = 'sop' | 'validation' | 'training'

const TYPE_BADGE: Record<CgmpDocType, { label: string; color: 'blue' | 'green' | 'yellow' }> = {
  sop: { label: '표준작업절차서', color: 'blue' },
  validation: { label: '밸리데이션', color: 'green' },
  training: { label: '교육기록', color: 'yellow' },
}

const TYPE_OPTIONS = [
  { value: 'sop', label: '표준작업절차서 (SOP)' },
  { value: 'validation', label: '밸리데이션' },
  { value: 'training', label: '교육기록' },
]

/** CGMP 문서 상태 */
type CgmpDocStatus = 'draft' | 'effective' | 'superseded' | 'archived'

const STATUS_BADGE: Record<CgmpDocStatus, { label: string; color: 'gray' | 'green' | 'yellow' | 'red' }> = {
  draft: { label: '초안', color: 'gray' },
  effective: { label: '유효', color: 'green' },
  superseded: { label: '대체됨', color: 'yellow' },
  archived: { label: '폐기', color: 'red' },
}

const STATUS_OPTIONS = [
  { value: 'draft', label: '초안' },
  { value: 'effective', label: '유효' },
  { value: 'superseded', label: '대체됨' },
  { value: 'archived', label: '폐기' },
]

/** CGMP 문서 (cgmpDocuments 컬렉션, type != 'nonconformity' && type != 'capa') */
interface CgmpDoc extends BaseDocument {
  documentNo: string
  type: CgmpDocType
  title: string
  version: string
  effectiveDate: string
  reviewDate: string
  status: CgmpDocStatus
  notes?: string
}

interface CgmpDocForm {
  documentNo: string
  type: CgmpDocType
  title: string
  version: string
  effectiveDate: string
  reviewDate: string
  status: CgmpDocStatus
  notes: string
}

export default function CgmpDocListPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CgmpDoc | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // 전체 cgmpDocuments를 가져와서 클라이언트에서 필터링 (부적합/CAPA/일탈 제외)
  const { data: allDocuments = [], isLoading } = useCollection<CgmpDoc>('cgmpDocuments', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('cgmpDocuments')
  const updateMutation = useUpdateDocument('cgmpDocuments')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CgmpDocForm>()

  // SOP/밸리데이션/교육기록만 표시
  const documents = allDocuments.filter((d) =>
    d.type === 'sop' || d.type === 'validation' || d.type === 'training',
  )

  const openCreate = () => {
    setEditing(null)
    reset({
      documentNo: '', type: 'sop', title: '', version: '1.0',
      effectiveDate: '', reviewDate: '', status: 'draft', notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (doc: CgmpDoc) => {
    setEditing(doc)
    reset({
      documentNo: doc.documentNo, type: doc.type, title: doc.title,
      version: doc.version, effectiveDate: doc.effectiveDate,
      reviewDate: doc.reviewDate, status: doc.status, notes: doc.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: CgmpDocForm) => {
    const payload = {
      documentNo: data.documentNo,
      type: data.type,
      title: data.title,
      version: data.version,
      effectiveDate: data.effectiveDate,
      reviewDate: data.reviewDate,
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

  const filtered = documents.filter((d) => {
    const matchSearch =
      d.documentNo.includes(search) ||
      d.title.includes(search)
    const matchType = !typeFilter || d.type === typeFilter
    return matchSearch && matchType
  })

  /** 검토일 경과 여부 확인 */
  const isReviewOverdue = (reviewDate: string) => {
    if (!reviewDate) return false
    return new Date(reviewDate) < new Date()
  }

  const columns = [
    { key: 'documentNo', label: '문서번호', width: '130px' },
    {
      key: 'type', label: '유형', width: '130px',
      render: (val: unknown) => {
        const info = TYPE_BADGE[val as CgmpDocType]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'title', label: '제목' },
    { key: 'version', label: '버전', width: '70px' },
    { key: 'effectiveDate', label: '시행일', width: '100px' },
    {
      key: 'reviewDate', label: '검토일', width: '100px',
      render: (val: unknown) => {
        const dateStr = String(val || '')
        if (!dateStr) return '—'
        const overdue = isReviewOverdue(dateStr)
        return <span className={overdue ? 'text-red-600 font-medium' : ''}>{dateStr}</span>
      },
    },
    {
      key: 'status', label: '상태', width: '80px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as CgmpDocStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: CgmpDoc) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">CGMP 문서관리</h1>
        <Button onClick={openCreate}>문서 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="문서번호, 제목 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-44">
            <Select
              options={[{ value: '', label: '전체 유형' }, ...TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label.split(' (')[0] }))]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="CGMP 문서가 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '문서 수정' : '문서 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label="문서번호 *" error={errors.documentNo?.message} {...register('documentNo', { required: '필수' })} />
            <Select label="유형 *" options={TYPE_OPTIONS} {...register('type')} />
            <Input label="버전 *" placeholder="예: 1.0" error={errors.version?.message} {...register('version', { required: '필수' })} />
          </div>
          <Input label="제목 *" error={errors.title?.message} {...register('title', { required: '필수' })} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="시행일 *" type="date" error={errors.effectiveDate?.message} {...register('effectiveDate', { required: '필수' })} />
            <Input label="검토예정일 *" type="date" error={errors.reviewDate?.message} {...register('reviewDate', { required: '필수' })} />
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
