import { useState } from 'react'
import { orderBy, where } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'
import type { BaseDocument } from '@/types'

/** 충진/포장 상태 */
type PackagingStatus = 'in_progress' | 'completed' | 'failed'

const STATUS_BADGE: Record<PackagingStatus, { label: string; color: 'blue' | 'green' | 'red' }> = {
  in_progress: { label: '진행중', color: 'blue' },
  completed: { label: '완료', color: 'green' },
  failed: { label: '실패', color: 'red' },
}

const STATUS_OPTIONS = [
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'failed', label: '실패' },
]

/** 충진/포장 기록 (productionRecords 컬렉션, stage='packaging') */
interface PackagingRecord extends BaseDocument {
  stage: 'packaging'
  recordNo: string
  workOrderNo: string
  productName: string
  batchNo: string
  filledQty: number
  packagedQty: number
  defectQty: number
  unit: string
  lineName: string
  status: PackagingStatus
  notes?: string
}

interface PackagingForm {
  recordNo: string
  workOrderNo: string
  productName: string
  batchNo: string
  filledQty: string
  packagedQty: string
  defectQty: string
  unit: string
  lineName: string
  status: PackagingStatus
  notes: string
}

export default function PackagingPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PackagingRecord | null>(null)
  const [search, setSearch] = useState('')

  const { data: records = [], isLoading } = useCollection<PackagingRecord>(
    'productionRecords',
    [where('stage', '==', 'packaging'), orderBy('createdAt', 'desc')],
    ['packaging'],
  )
  const createMutation = useCreateDocument('productionRecords')
  const updateMutation = useUpdateDocument('productionRecords')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PackagingForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      recordNo: '', workOrderNo: '', productName: '', batchNo: '',
      filledQty: '', packagedQty: '', defectQty: '0', unit: 'ea',
      lineName: '', status: 'in_progress', notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (rec: PackagingRecord) => {
    setEditing(rec)
    reset({
      recordNo: rec.recordNo, workOrderNo: rec.workOrderNo,
      productName: rec.productName, batchNo: rec.batchNo,
      filledQty: String(rec.filledQty), packagedQty: String(rec.packagedQty),
      defectQty: String(rec.defectQty), unit: rec.unit,
      lineName: rec.lineName, status: rec.status, notes: rec.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: PackagingForm) => {
    const payload = {
      stage: 'packaging' as const,
      recordNo: data.recordNo,
      workOrderNo: data.workOrderNo,
      productName: data.productName,
      batchNo: data.batchNo,
      filledQty: Number(data.filledQty),
      packagedQty: Number(data.packagedQty),
      defectQty: Number(data.defectQty),
      unit: data.unit,
      lineName: data.lineName,
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

  const filtered = records.filter((r) =>
    r.recordNo.includes(search) ||
    r.workOrderNo.includes(search) ||
    r.productName.includes(search) ||
    r.batchNo.includes(search) ||
    r.lineName.includes(search),
  )

  const columns = [
    { key: 'recordNo', label: '기록번호', width: '120px' },
    { key: 'workOrderNo', label: '작업지시번호', width: '130px' },
    { key: 'productName', label: '제품명' },
    { key: 'batchNo', label: '배치번호', width: '120px' },
    {
      key: 'filledQty', label: '충진수량', width: '90px',
      render: (val: unknown) => formatNumber(val as number),
    },
    {
      key: 'packagedQty', label: '포장수량', width: '90px',
      render: (val: unknown) => formatNumber(val as number),
    },
    {
      key: 'defectQty', label: '불량수량', width: '90px',
      render: (val: unknown) => {
        const qty = val as number
        return <span className={qty > 0 ? 'text-red-600 font-semibold' : ''}>{formatNumber(qty)}</span>
      },
    },
    { key: 'unit', label: '단위', width: '50px' },
    { key: 'lineName', label: '라인명', width: '100px' },
    {
      key: 'status', label: '상태', width: '80px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as PackagingStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: PackagingRecord) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">충진/포장</h1>
        <Button onClick={openCreate}>실적 등록</Button>
      </div>

      <Card>
        <div className="mb-4">
          <Input placeholder="기록번호, 작업지시번호, 제품명, 배치번호, 라인명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="충진/포장 실적이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '실적 수정' : '실적 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="기록번호 *" error={errors.recordNo?.message} {...register('recordNo', { required: '필수' })} />
            <Input label="작업지시번호 *" error={errors.workOrderNo?.message} {...register('workOrderNo', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="제품명 *" error={errors.productName?.message} {...register('productName', { required: '필수' })} />
            <Input label="배치번호 *" error={errors.batchNo?.message} {...register('batchNo', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Input label="충진수량 *" type="number" error={errors.filledQty?.message} {...register('filledQty', { required: '필수' })} />
            <Input label="포장수량 *" type="number" error={errors.packagedQty?.message} {...register('packagedQty', { required: '필수' })} />
            <Input label="불량수량" type="number" {...register('defectQty')} />
            <Select label="단위" options={[{ value: 'ea', label: 'ea' }, { value: 'box', label: 'box' }, { value: 'set', label: 'set' }]} {...register('unit')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="라인명 *" placeholder="예: 충진1호기" error={errors.lineName?.message} {...register('lineName', { required: '필수' })} />
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
