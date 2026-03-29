import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'
import type { QualityInspection, InspectionType, InspectionResult, InspectionItem } from '@/types'

const TYPE_BADGE: Record<InspectionType, { label: string; color: 'blue' | 'yellow' | 'green' }> = {
  incoming: { label: '수입검사', color: 'blue' },
  process: { label: '공정검사', color: 'yellow' },
  outgoing: { label: '출하검사', color: 'green' },
}

const RESULT_BADGE: Record<InspectionResult, { label: string; color: 'green' | 'red' | 'yellow' }> = {
  pass: { label: '합격', color: 'green' },
  fail: { label: '불합격', color: 'red' },
  conditional_pass: { label: '조건부합격', color: 'yellow' },
}

interface InspectionForm {
  inspectionNo: string
  type: InspectionType
  itemCode: string
  itemName: string
  lotNo: string
  sampleQuantity: string
  inspectionDate: string
  overallResult: InspectionResult
  notes: string
}

export default function InspectionListPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<QualityInspection | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: inspections = [], isLoading } = useCollection<QualityInspection>('qualityInspections', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('qualityInspections')
  const updateMutation = useUpdateDocument('qualityInspections')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InspectionForm>()

  const openCreate = () => {
    setEditing(null)
    reset({ inspectionNo: '', type: 'incoming', itemCode: '', itemName: '', lotNo: '', sampleQuantity: '', inspectionDate: '', overallResult: 'pass', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (insp: QualityInspection) => {
    setEditing(insp)
    reset({
      inspectionNo: insp.inspectionNo, type: insp.type,
      itemCode: insp.itemCode, itemName: insp.itemName, lotNo: insp.lotNo,
      sampleQuantity: String(insp.sampleQuantity), inspectionDate: insp.inspectionDate,
      overallResult: insp.overallResult, notes: insp.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: InspectionForm) => {
    const payload = {
      inspectionNo: data.inspectionNo,
      type: data.type,
      itemId: '',
      itemCode: data.itemCode,
      itemName: data.itemName,
      lotNo: data.lotNo,
      sampleQuantity: Number(data.sampleQuantity),
      inspectionDate: data.inspectionDate,
      overallResult: data.overallResult,
      items: [] as InspectionItem[],
      notes: data.notes || null,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const filtered = inspections.filter((i) => {
    const matchSearch = i.itemName.includes(search) || i.inspectionNo.includes(search) || i.lotNo.includes(search)
    const matchType = !typeFilter || i.type === typeFilter
    return matchSearch && matchType
  })

  const columns = [
    { key: 'inspectionNo', label: '검사번호', width: '130px' },
    {
      key: 'type', label: '검사유형', width: '100px',
      render: (val: unknown) => { const info = TYPE_BADGE[val as InspectionType]; return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge> },
    },
    { key: 'itemCode', label: '품목코드', width: '110px' },
    { key: 'itemName', label: '품목명' },
    { key: 'lotNo', label: 'LOT번호', width: '140px' },
    { key: 'inspectionDate', label: '검사일', width: '100px' },
    {
      key: 'overallResult', label: '판정', width: '100px',
      render: (val: unknown) => { const info = RESULT_BADGE[val as InspectionResult]; return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge> },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: QualityInspection) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>,
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">품질검사</h1>
        <Button onClick={openCreate}>검사 등록</Button>
      </div>
      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="검사번호, 품목명, LOT번호 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
            <Select options={[{ value: '', label: '전체 유형' }, ...Object.entries(TYPE_BADGE).map(([v, i]) => ({ value: v, label: i.label }))]} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '검사 수정' : '검사 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="검사번호 *" error={errors.inspectionNo?.message} {...register('inspectionNo', { required: '필수' })} />
            <Select label="검사유형 *" options={Object.entries(TYPE_BADGE).map(([v, i]) => ({ value: v, label: i.label }))} {...register('type')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="품목코드 *" error={errors.itemCode?.message} {...register('itemCode', { required: '필수' })} />
            <Input label="품목명 *" error={errors.itemName?.message} {...register('itemName', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="LOT번호 *" error={errors.lotNo?.message} {...register('lotNo', { required: '필수' })} />
            <Input label="검사수량" type="number" {...register('sampleQuantity')} />
            <Input label="검사일 *" type="date" {...register('inspectionDate', { required: '필수' })} />
          </div>
          <Select label="종합 판정 *" options={Object.entries(RESULT_BADGE).map(([v, i]) => ({ value: v, label: i.label }))} {...register('overallResult')} />
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
