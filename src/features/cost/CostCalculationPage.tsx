import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'
import type { BaseDocument } from '@/types'

/** 원가 기록 (costRecords 컬렉션) */
interface CostRecord extends BaseDocument {
  recordNo: string
  productName: string
  period: string
  materialCost: number
  laborCost: number
  overheadCost: number
  totalCost: number
  unitCost: number
  notes?: string
}

interface CostForm {
  recordNo: string
  productName: string
  period: string
  materialCost: string
  laborCost: string
  overheadCost: string
  unitCost: string
  notes: string
}

export default function CostCalculationPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CostRecord | null>(null)
  const [search, setSearch] = useState('')

  const { data: records = [], isLoading } = useCollection<CostRecord>('costRecords', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('costRecords')
  const updateMutation = useUpdateDocument('costRecords')

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CostForm>()

  /** 총원가 자동 계산 (화면 표시용) */
  const materialCostVal = Number(watch('materialCost') || 0)
  const laborCostVal = Number(watch('laborCost') || 0)
  const overheadCostVal = Number(watch('overheadCost') || 0)
  const calculatedTotal = materialCostVal + laborCostVal + overheadCostVal

  const openCreate = () => {
    setEditing(null)
    reset({
      recordNo: '', productName: '', period: '',
      materialCost: '', laborCost: '', overheadCost: '',
      unitCost: '', notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (rec: CostRecord) => {
    setEditing(rec)
    reset({
      recordNo: rec.recordNo, productName: rec.productName, period: rec.period,
      materialCost: String(rec.materialCost), laborCost: String(rec.laborCost),
      overheadCost: String(rec.overheadCost), unitCost: String(rec.unitCost),
      notes: rec.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: CostForm) => {
    const material = Number(data.materialCost)
    const labor = Number(data.laborCost)
    const overhead = Number(data.overheadCost)
    const payload = {
      recordNo: data.recordNo,
      productName: data.productName,
      period: data.period,
      materialCost: material,
      laborCost: labor,
      overheadCost: overhead,
      totalCost: material + labor + overhead,
      unitCost: Number(data.unitCost),
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
    r.recordNo.includes(search) || r.productName.includes(search) || r.period.includes(search),
  )

  const columns = [
    { key: 'recordNo', label: '기록번호', width: '120px' },
    { key: 'productName', label: '제품명' },
    { key: 'period', label: '기간', width: '100px' },
    {
      key: 'materialCost', label: '재료비', width: '110px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    {
      key: 'laborCost', label: '노무비', width: '110px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    {
      key: 'overheadCost', label: '경비', width: '110px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    {
      key: 'totalCost', label: '총원가', width: '120px',
      render: (val: unknown) => <span className="font-semibold">{formatNumber(val as number)}원</span>,
    },
    {
      key: 'unitCost', label: '단위원가', width: '110px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: CostRecord) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">원가산출</h1>
        <Button onClick={openCreate}>원가 등록</Button>
      </div>

      <Card>
        <div className="mb-4">
          <Input placeholder="기록번호, 제품명, 기간 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="원가 기록이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '원가 수정' : '원가 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label="기록번호 *" error={errors.recordNo?.message} {...register('recordNo', { required: '필수' })} />
            <Input label="제품명 *" error={errors.productName?.message} {...register('productName', { required: '필수' })} />
            <Input label="기간 *" placeholder="예: 2026-03" error={errors.period?.message} {...register('period', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="재료비 (원) *" type="number" error={errors.materialCost?.message} {...register('materialCost', { required: '필수' })} />
            <Input label="노무비 (원) *" type="number" error={errors.laborCost?.message} {...register('laborCost', { required: '필수' })} />
            <Input label="경비 (원) *" type="number" error={errors.overheadCost?.message} {...register('overheadCost', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">총원가:</span>
              <span className="font-semibold text-lg">{formatNumber(calculatedTotal)}원</span>
            </div>
            <Input label="단위원가 (원) *" type="number" error={errors.unitCost?.message} {...register('unitCost', { required: '필수' })} />
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
