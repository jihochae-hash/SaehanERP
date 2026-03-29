import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'
import type { BaseDocument } from '@/types'

/** 계약 상태 */
type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated'

/** 계약 유형 */
type ContractType = 'sales' | 'purchase' | 'outsourcing' | 'nda' | 'other'

const STATUS_BADGE: Record<ContractStatus, { label: string; color: 'gray' | 'green' | 'red' | 'yellow' }> = {
  draft: { label: '초안', color: 'gray' },
  active: { label: '유효', color: 'green' },
  expired: { label: '만료', color: 'red' },
  terminated: { label: '해지', color: 'yellow' },
}

const STATUS_OPTIONS = [
  { value: 'draft', label: '초안' },
  { value: 'active', label: '유효' },
  { value: 'expired', label: '만료' },
  { value: 'terminated', label: '해지' },
]

const TYPE_OPTIONS = [
  { value: 'sales', label: '매출계약' },
  { value: 'purchase', label: '매입계약' },
  { value: 'outsourcing', label: '외주계약' },
  { value: 'nda', label: '비밀유지(NDA)' },
  { value: 'other', label: '기타' },
]

const TYPE_LABEL: Record<ContractType, string> = {
  sales: '매출계약',
  purchase: '매입계약',
  outsourcing: '외주계약',
  nda: 'NDA',
  other: '기타',
}

/** 전자계약 (contracts 컬렉션) */
interface Contract extends BaseDocument {
  contractNo: string
  title: string
  partnerName: string
  contractType: ContractType
  startDate: string
  endDate: string
  amount: number
  status: ContractStatus
  autoRenew: boolean
  notes?: string
}

interface ContractForm {
  contractNo: string
  title: string
  partnerName: string
  contractType: ContractType
  startDate: string
  endDate: string
  amount: string
  status: ContractStatus
  autoRenew: boolean
  notes: string
}



export default function ContractListPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contract | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: contracts = [], isLoading } = useCollection<Contract>('contracts', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('contracts')
  const updateMutation = useUpdateDocument('contracts')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContractForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      contractNo: '', title: '', partnerName: '', contractType: 'sales',
      startDate: '', endDate: '', amount: '', status: 'draft',
      autoRenew: false, notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (contract: Contract) => {
    setEditing(contract)
    reset({
      contractNo: contract.contractNo, title: contract.title,
      partnerName: contract.partnerName, contractType: contract.contractType,
      startDate: contract.startDate, endDate: contract.endDate,
      amount: String(contract.amount), status: contract.status,
      autoRenew: contract.autoRenew, notes: contract.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: ContractForm) => {
    const payload = {
      contractNo: data.contractNo,
      title: data.title,
      partnerName: data.partnerName,
      contractType: data.contractType,
      startDate: data.startDate,
      endDate: data.endDate,
      amount: Number(data.amount) || 0,
      status: data.status,
      autoRenew: data.autoRenew,
      notes: data.notes || null,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const filtered = contracts.filter((c) => {
    const matchSearch =
      c.contractNo.includes(search) ||
      c.title.includes(search) ||
      c.partnerName.includes(search)
    const matchStatus = !statusFilter || c.status === statusFilter
    const matchType = !typeFilter || c.contractType === typeFilter
    return matchSearch && matchStatus && matchType
  })

  const columns = [
    { key: 'contractNo', label: '계약번호', width: '120px' },
    { key: 'title', label: '계약명' },
    { key: 'partnerName', label: '거래처', width: '130px' },
    {
      key: 'contractType', label: '유형', width: '100px',
      render: (val: unknown) => TYPE_LABEL[val as ContractType] ?? val,
    },
    { key: 'startDate', label: '시작일', width: '100px' },
    {
      key: 'endDate', label: '종료일', width: '100px',
      render: (val: unknown, row: Contract) => {
        const dateStr = String(val)
        const end = new Date(dateStr)
        const now = new Date()
        const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        const isExpired = diffDays < 0 && row.status !== 'expired' && row.status !== 'terminated'
        const isExpiringSoon = diffDays >= 0 && diffDays <= 30 && row.status === 'active'
        return (
          <span className={isExpired ? 'text-red-600 font-semibold' : isExpiringSoon ? 'text-yellow-600 font-semibold' : ''}>
            {dateStr}
            {isExpiringSoon && <span className="text-xs ml-1">({diffDays}일)</span>}
          </span>
        )
      },
    },
    {
      key: 'amount', label: '금액', width: '120px',
      render: (val: unknown) => <span className="font-semibold">{formatNumber(val as number)}원</span>,
    },
    {
      key: 'autoRenew', label: '자동갱신', width: '80px',
      render: (val: unknown) => val ? <Badge color="blue">자동</Badge> : <span className="text-gray-400">-</span>,
    },
    {
      key: 'status', label: '상태', width: '80px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as ContractStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: Contract) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]



  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">전자계약</h1>
        <Button onClick={openCreate}>계약 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="계약번호, 계약명, 거래처 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
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
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="등록된 계약이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '계약 수정' : '계약 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="계약번호 *" error={errors.contractNo?.message} {...register('contractNo', { required: '필수' })} />
            <Input label="거래처 *" error={errors.partnerName?.message} {...register('partnerName', { required: '필수' })} />
          </div>
          <Input label="계약명 *" error={errors.title?.message} {...register('title', { required: '필수' })} />
          <div className="grid grid-cols-3 gap-4">
            <Select label="유형" options={TYPE_OPTIONS} {...register('contractType')} />
            <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
            <Input label="금액 (원)" type="number" {...register('amount')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="시작일 *" type="date" error={errors.startDate?.message} {...register('startDate', { required: '필수' })} />
            <Input label="종료일 *" type="date" error={errors.endDate?.message} {...register('endDate', { required: '필수' })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="autoRenew" {...register('autoRenew')} className="rounded border-gray-300" />
            <label htmlFor="autoRenew" className="text-sm text-gray-700">자동 갱신</label>
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
