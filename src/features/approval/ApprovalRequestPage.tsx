import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import type { BaseDocument } from '@/types'

/** 결재 상태 */
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

/** 결재 유형 */
type ApprovalType = 'purchase' | 'formula' | 'shipment' | 'general'

const STATUS_BADGE: Record<ApprovalStatus, { label: string; color: 'yellow' | 'green' | 'red' | 'gray' }> = {
  pending: { label: '대기', color: 'yellow' },
  approved: { label: '승인', color: 'green' },
  rejected: { label: '반려', color: 'red' },
  cancelled: { label: '취소', color: 'gray' },
}

const STATUS_OPTIONS = [
  { value: 'pending', label: '대기' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '반려' },
  { value: 'cancelled', label: '취소' },
]

const TYPE_OPTIONS = [
  { value: 'purchase', label: '구매승인' },
  { value: 'formula', label: '처방확정' },
  { value: 'shipment', label: '출하승인' },
  { value: 'general', label: '일반' },
]

const TYPE_LABEL: Record<ApprovalType, string> = {
  purchase: '구매승인',
  formula: '처방확정',
  shipment: '출하승인',
  general: '일반',
}

/** 전자결재 (approvalRequests 컬렉션) */
interface ApprovalRequest extends BaseDocument {
  requestNo: string
  title: string
  type: ApprovalType
  requesterName: string
  requestDate: string
  description: string
  approverName: string
  approvedDate?: string
  status: ApprovalStatus
  comments?: string
}

interface ApprovalForm {
  requestNo: string
  title: string
  type: ApprovalType
  requesterName: string
  requestDate: string
  description: string
  approverName: string
  approvedDate: string
  status: ApprovalStatus
  comments: string
}

type ViewMode = 'all' | 'my_requests' | 'pending_approvals'

export default function ApprovalRequestPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ApprovalRequest | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('all')

  const user = useAuthStore((s) => s.user)
  const displayName = user?.displayName ?? ''

  const { data: requests = [], isLoading } = useCollection<ApprovalRequest>('approvalRequests', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('approvalRequests')
  const updateMutation = useUpdateDocument('approvalRequests')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ApprovalForm>()

  /** 대기 건수 */
  const pendingCount = requests.filter((r) => r.status === 'pending').length

  const openCreate = () => {
    setEditing(null)
    reset({
      requestNo: '', title: '', type: 'general',
      requesterName: displayName, requestDate: new Date().toISOString().slice(0, 10),
      description: '', approverName: '', approvedDate: '',
      status: 'pending', comments: '',
    })
    setModalOpen(true)
  }

  const openEdit = (req: ApprovalRequest) => {
    setEditing(req)
    reset({
      requestNo: req.requestNo, title: req.title, type: req.type,
      requesterName: req.requesterName, requestDate: req.requestDate,
      description: req.description, approverName: req.approverName,
      approvedDate: req.approvedDate ?? '', status: req.status,
      comments: req.comments ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: ApprovalForm) => {
    const payload = {
      requestNo: data.requestNo,
      title: data.title,
      type: data.type,
      requesterName: data.requesterName,
      requestDate: data.requestDate,
      description: data.description,
      approverName: data.approverName,
      approvedDate: data.approvedDate || null,
      status: data.status,
      comments: data.comments || null,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  /** 뷰 모드별 필터링 */
  const filtered = requests.filter((r) => {
    const matchSearch =
      r.requestNo.includes(search) ||
      r.title.includes(search) ||
      r.requesterName.includes(search) ||
      r.approverName.includes(search)
    const matchStatus = !statusFilter || r.status === statusFilter
    let matchView = true
    if (viewMode === 'my_requests') {
      matchView = r.requesterName === displayName
    } else if (viewMode === 'pending_approvals') {
      matchView = r.approverName === displayName && r.status === 'pending'
    }
    return matchSearch && matchStatus && matchView
  })

  const columns = [
    { key: 'requestNo', label: '결재번호', width: '120px' },
    {
      key: 'type', label: '유형', width: '100px',
      render: (val: unknown) => {
        const label = TYPE_LABEL[val as ApprovalType]
        return <Badge color={val === 'purchase' ? 'blue' : val === 'formula' ? 'green' : val === 'shipment' ? 'yellow' : 'gray'}>{label ?? val}</Badge>
      },
    },
    { key: 'title', label: '제목' },
    { key: 'requesterName', label: '기안자', width: '100px' },
    { key: 'approverName', label: '승인자', width: '100px' },
    { key: 'requestDate', label: '기안일', width: '100px' },
    {
      key: 'approvedDate', label: '처리일', width: '100px',
      render: (val: unknown) => val ? String(val) : '-',
    },
    {
      key: 'status', label: '상태', width: '90px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as ApprovalStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: ApprovalRequest) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>상세</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">전자결재</h1>
          {pendingCount > 0 && (
            <Badge color="red">{pendingCount}건 대기</Badge>
          )}
        </div>
        <Button onClick={openCreate}>기안 작성</Button>
      </div>

      <Card>
        {/* 뷰 모드 탭 */}
        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            variant={viewMode === 'all' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('all')}
          >
            전체
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'my_requests' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('my_requests')}
          >
            내 기안
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'pending_approvals' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('pending_approvals')}
          >
            결재 대기
          </Button>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="결재번호, 제목, 기안자, 승인자 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
            <Select
              options={[{ value: '', label: '전체 상태' }, ...STATUS_OPTIONS]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="결재 문서가 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '결재 상세' : '기안 작성'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="결재번호 *" error={errors.requestNo?.message} {...register('requestNo', { required: '필수' })} />
            <Select label="유형" options={TYPE_OPTIONS} {...register('type')} />
          </div>
          <Input label="제목 *" error={errors.title?.message} {...register('title', { required: '필수' })} />
          <Input label="내용 *" error={errors.description?.message} {...register('description', { required: '필수' })} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="기안자 *" error={errors.requesterName?.message} {...register('requesterName', { required: '필수' })} />
            <Input label="승인자 *" error={errors.approverName?.message} {...register('approverName', { required: '필수' })} />
            <Input label="기안일 *" type="date" error={errors.requestDate?.message} {...register('requestDate', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
            <Input label="처리일" type="date" {...register('approvedDate')} />
          </div>
          <Input label="코멘트" {...register('comments')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editing ? '수정' : '기안'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
