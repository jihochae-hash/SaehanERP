import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'
import type { BaseDocument } from '@/types'

/** 재고실사 상태 */
type StockCountStatus = 'draft' | 'counting' | 'completed'

const STATUS_BADGE: Record<StockCountStatus, { label: string; color: 'gray' | 'yellow' | 'green' }> = {
  draft: { label: '작성중', color: 'gray' },
  counting: { label: '실사중', color: 'yellow' },
  completed: { label: '완료', color: 'green' },
}

const STATUS_OPTIONS = [
  { value: 'draft', label: '작성중' },
  { value: 'counting', label: '실사중' },
  { value: 'completed', label: '완료' },
]

/** 실사 품목 항목 */
interface StockCountItem {
  itemCode: string
  itemName: string
  systemQty: number
  actualQty: number
  difference: number
}

/** 재고실사 문서 (stockCounts 컬렉션) */
interface StockCount extends BaseDocument {
  countNo: string
  countDate: string
  warehouseName: string
  items: StockCountItem[]
  status: StockCountStatus
  notes?: string
}

interface StockCountForm {
  countNo: string
  countDate: string
  warehouseName: string
  status: StockCountStatus
  notes: string
}

export default function StockCountPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StockCount | null>(null)
  const [search, setSearch] = useState('')

  const { data: counts = [], isLoading } = useCollection<StockCount>('stockCounts', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('stockCounts')
  const updateMutation = useUpdateDocument('stockCounts')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<StockCountForm>()

  const openCreate = () => {
    setEditing(null)
    reset({ countNo: '', countDate: '', warehouseName: '', status: 'draft', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (doc: StockCount) => {
    setEditing(doc)
    reset({
      countNo: doc.countNo, countDate: doc.countDate,
      warehouseName: doc.warehouseName, status: doc.status,
      notes: doc.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: StockCountForm) => {
    const payload = {
      countNo: data.countNo,
      countDate: data.countDate,
      warehouseName: data.warehouseName,
      items: editing?.items ?? ([] as StockCountItem[]),
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

  const filtered = counts.filter((c) =>
    c.countNo.includes(search) || c.warehouseName.includes(search),
  )

  /** 차이 품목 수 계산 */
  const getDiffCount = (items: StockCountItem[]) => {
    return items.filter((i) => i.difference !== 0).length
  }

  const columns = [
    { key: 'countNo', label: '실사번호', width: '130px' },
    { key: 'countDate', label: '실사일', width: '110px' },
    { key: 'warehouseName', label: '창고', width: '120px' },
    {
      key: 'items', label: '품목수', width: '80px',
      render: (val: unknown) => {
        const items = val as StockCountItem[]
        return formatNumber(items.length)
      },
    },
    {
      key: '_diff', label: '차이항목', width: '90px',
      render: (_: unknown, row: StockCount) => {
        const diffCount = getDiffCount(row.items)
        if (diffCount === 0) return <span className="text-gray-400">없음</span>
        return <span className="text-red-600 font-semibold">{diffCount}건</span>
      },
    },
    {
      key: 'status', label: '상태', width: '80px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as StockCountStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: StockCount) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">재고실사</h1>
        <Button onClick={openCreate}>실사 등록</Button>
      </div>

      <Card>
        <div className="mb-4">
          <Input placeholder="실사번호, 창고명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="재고실사 기록이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '실사 수정' : '실사 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label="실사번호 *" error={errors.countNo?.message} {...register('countNo', { required: '필수' })} />
            <Input label="실사일 *" type="date" error={errors.countDate?.message} {...register('countDate', { required: '필수' })} />
            <Input label="창고명 *" error={errors.warehouseName?.message} {...register('warehouseName', { required: '필수' })} />
          </div>
          <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />

          {/* 실사 품목 목록 (수정 시에만 표시) */}
          {editing && editing.items.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">실사 품목 ({editing.items.length}건)</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">품목코드</th>
                      <th className="px-3 py-2 text-left">품목명</th>
                      <th className="px-3 py-2 text-right">시스템수량</th>
                      <th className="px-3 py-2 text-right">실사수량</th>
                      <th className="px-3 py-2 text-right">차이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editing.items.map((item, idx) => (
                      <tr key={idx} className={item.difference !== 0 ? 'bg-red-50' : ''}>
                        <td className="px-3 py-1.5">{item.itemCode}</td>
                        <td className="px-3 py-1.5">{item.itemName}</td>
                        <td className="px-3 py-1.5 text-right">{formatNumber(item.systemQty)}</td>
                        <td className="px-3 py-1.5 text-right">{formatNumber(item.actualQty)}</td>
                        <td className={`px-3 py-1.5 text-right font-medium ${item.difference !== 0 ? 'text-red-600' : ''}`}>
                          {item.difference > 0 ? '+' : ''}{formatNumber(item.difference)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
