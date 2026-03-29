import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'
import type { CgmpDocument, NonconformityStatus } from '@/types'

const STATUS_BADGE: Record<NonconformityStatus, { label: string; color: 'red' | 'yellow' | 'blue' | 'green' }> = {
  open: { label: '발생', color: 'red' },
  investigating: { label: '조사중', color: 'yellow' },
  corrective_action: { label: '시정조치', color: 'blue' },
  closed: { label: '종결', color: 'green' },
}

const TYPE_OPTIONS = [
  { value: 'nonconformity', label: '부적합' },
  { value: 'capa', label: 'CAPA' },
  { value: 'deviation', label: '일탈' },
]

interface CapaForm {
  documentNo: string
  type: string
  title: string
  description: string
  relatedLotNo: string
  rootCause: string
  correctiveAction: string
  preventiveAction: string
  dueDate: string
  status: NonconformityStatus
}

export default function CapaListPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CgmpDocument | null>(null)

  const { data: documents = [], isLoading } = useCollection<CgmpDocument>('cgmpDocuments', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('cgmpDocuments')
  const updateMutation = useUpdateDocument('cgmpDocuments')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CapaForm>()

  const openCreate = () => {
    setEditing(null)
    reset({ documentNo: '', type: 'nonconformity', title: '', description: '', relatedLotNo: '', rootCause: '', correctiveAction: '', preventiveAction: '', dueDate: '', status: 'open' })
    setModalOpen(true)
  }

  const openEdit = (doc: CgmpDocument) => {
    setEditing(doc)
    reset({
      documentNo: doc.documentNo, type: doc.type, title: doc.title,
      description: doc.description, relatedLotNo: doc.relatedLotNo ?? '',
      rootCause: doc.rootCause ?? '', correctiveAction: doc.correctiveAction ?? '',
      preventiveAction: doc.preventiveAction ?? '', dueDate: doc.dueDate ?? '', status: doc.status,
    })
    setModalOpen(true)
  }

  const onSave = async (data: CapaForm) => {
    const payload = {
      documentNo: data.documentNo, type: data.type, title: data.title,
      description: data.description, relatedLotNo: data.relatedLotNo || null,
      rootCause: data.rootCause || null, correctiveAction: data.correctiveAction || null,
      preventiveAction: data.preventiveAction || null, dueDate: data.dueDate || null,
      status: data.status,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const columns = [
    { key: 'documentNo', label: '문서번호', width: '130px' },
    {
      key: 'type', label: '유형', width: '80px',
      render: (val: unknown) => {
        const label = TYPE_OPTIONS.find((o) => o.value === val)?.label ?? val
        return <Badge color={val === 'nonconformity' ? 'red' : val === 'capa' ? 'blue' : 'yellow'}>{String(label)}</Badge>
      },
    },
    { key: 'title', label: '제목' },
    { key: 'relatedLotNo', label: 'LOT', width: '130px', render: (val: unknown) => val ? String(val) : '—' },
    {
      key: 'status', label: '상태', width: '90px',
      render: (val: unknown) => { const info = STATUS_BADGE[val as NonconformityStatus]; return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge> },
    },
    { key: 'dueDate', label: '기한', width: '100px', render: (val: unknown) => val ? String(val) : '—' },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: CgmpDocument) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>,
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">부적합 / CAPA 관리</h1>
        <Button onClick={openCreate}>문서 등록</Button>
      </div>
      <Card>
        <Table columns={columns} data={documents} loading={isLoading} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '문서 수정' : '문서 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label="문서번호 *" error={errors.documentNo?.message} {...register('documentNo', { required: '필수' })} />
            <Select label="유형" options={TYPE_OPTIONS} {...register('type')} />
            <Select label="상태" options={Object.entries(STATUS_BADGE).map(([v, i]) => ({ value: v, label: i.label }))} {...register('status')} />
          </div>
          <Input label="제목 *" error={errors.title?.message} {...register('title', { required: '필수' })} />
          <Input label="설명 *" error={errors.description?.message} {...register('description', { required: '필수' })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="관련 LOT" {...register('relatedLotNo')} />
            <Input label="기한" type="date" {...register('dueDate')} />
          </div>
          <Input label="근본 원인" {...register('rootCause')} />
          <Input label="시정 조치" {...register('correctiveAction')} />
          <Input label="예방 조치" {...register('preventiveAction')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editing ? '수정' : '등록'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
