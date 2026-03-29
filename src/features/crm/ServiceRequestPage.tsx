import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'

// --- 인라인 타입 ---

type IssueType = 'defect' | 'exchange' | 'refund' | 'inquiry'
type ServiceStatus = 'received' | 'processing' | 'resolved' | 'closed'

interface ServiceRequest {
  id: string
  requestNo: string
  customerName: string
  productName: string
  requestDate: string
  issueType: IssueType
  description: string
  resolution: string
  resolvedDate: string
  status: ServiceStatus
  createdAt: unknown
}

interface ServiceForm {
  requestNo: string
  customerName: string
  productName: string
  requestDate: string
  issueType: IssueType
  description: string
  resolution: string
  resolvedDate: string
  status: ServiceStatus
}

// --- 상수 ---

const ISSUE_TYPE_BADGE: Record<IssueType, { label: string; color: 'red' | 'yellow' | 'blue' | 'gray' }> = {
  defect: { label: '불량', color: 'red' },
  exchange: { label: '교환', color: 'yellow' },
  refund: { label: '환불', color: 'blue' },
  inquiry: { label: '문의', color: 'gray' },
}

const STATUS_BADGE: Record<ServiceStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'purple' }> = {
  received: { label: '접수', color: 'gray' },
  processing: { label: '처리중', color: 'blue' },
  resolved: { label: '해결', color: 'green' },
  closed: { label: '종료', color: 'purple' },
}

const ISSUE_TYPE_OPTIONS = [
  { value: 'defect', label: '불량' },
  { value: 'exchange', label: '교환' },
  { value: 'refund', label: '환불' },
  { value: 'inquiry', label: '문의' },
]

const STATUS_OPTIONS = [
  { value: 'received', label: '접수' },
  { value: 'processing', label: '처리중' },
  { value: 'resolved', label: '해결' },
  { value: 'closed', label: '종료' },
]

export default function ServiceRequestPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceRequest | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: requests = [], isLoading } = useCollection<ServiceRequest>(
    'serviceRequests',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const createMutation = useCreateDocument('serviceRequests')
  const updateMutation = useUpdateDocument('serviceRequests')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      requestNo: '', customerName: '', productName: '',
      requestDate: '', issueType: 'defect', description: '',
      resolution: '', resolvedDate: '', status: 'received',
    })
    setModalOpen(true)
  }

  const openEdit = (req: ServiceRequest) => {
    setEditing(req)
    reset({
      requestNo: req.requestNo,
      customerName: req.customerName,
      productName: req.productName,
      requestDate: req.requestDate,
      issueType: req.issueType,
      description: req.description,
      resolution: req.resolution ?? '',
      resolvedDate: req.resolvedDate ?? '',
      status: req.status,
    })
    setModalOpen(true)
  }

  const onSave = async (data: ServiceForm) => {
    const payload = {
      requestNo: data.requestNo,
      customerName: data.customerName,
      productName: data.productName,
      requestDate: data.requestDate,
      issueType: data.issueType,
      description: data.description,
      resolution: data.resolution || null,
      resolvedDate: data.resolvedDate || null,
      status: data.status,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const filtered = requests.filter((r) => {
    const matchSearch =
      r.requestNo.includes(search) ||
      r.customerName.includes(search) ||
      r.productName.includes(search)
    const matchStatus = !statusFilter || r.status === statusFilter
    return matchSearch && matchStatus
  })

  const columns = [
    { key: 'requestNo', label: '접수번호', width: '120px' },
    { key: 'customerName', label: '고객명' },
    { key: 'productName', label: '제품명' },
    { key: 'requestDate', label: '접수일', width: '100px' },
    {
      key: 'issueType', label: '유형', width: '80px',
      render: (val: unknown) => {
        const info = ISSUE_TYPE_BADGE[val as IssueType]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    {
      key: 'status', label: '상태', width: '90px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as ServiceStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    {
      key: 'resolvedDate', label: '해결일', width: '100px',
      render: (val: unknown) => (val as string) || '-',
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: ServiceRequest) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">A/S 접수/처리</h1>
        <Button onClick={openCreate}>A/S 접수</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="접수번호, 고객명, 제품명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
            <Select
              options={[{ value: '', label: '전체 상태' }, ...STATUS_OPTIONS]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="A/S 접수 내역이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? 'A/S 수정' : 'A/S 접수'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="접수번호 *" error={errors.requestNo?.message} {...register('requestNo', { required: '필수' })} />
            <Input label="고객명 *" error={errors.customerName?.message} {...register('customerName', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="제품명 *" error={errors.productName?.message} {...register('productName', { required: '필수' })} />
            <Input label="접수일 *" type="date" error={errors.requestDate?.message} {...register('requestDate', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="유형 *" options={ISSUE_TYPE_OPTIONS} {...register('issueType')} />
            <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
          </div>
          <Input label="증상/내용 *" error={errors.description?.message} {...register('description', { required: '필수' })} />
          <Input label="처리내용" {...register('resolution')} />
          <Input label="해결일" type="date" {...register('resolvedDate')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? '수정' : '접수'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
