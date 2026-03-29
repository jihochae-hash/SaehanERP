import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument, useDeleteDocument } from '@/hooks/useFirestore'
import { useAuthStore } from '@/stores/auth'
import { useForm } from 'react-hook-form'
import type { Item, ItemType, UnitType } from '@/types'

const ITEM_TYPE_OPTIONS = [
  { value: 'raw_material', label: '원료' },
  { value: 'sub_material', label: '부자재' },
  { value: 'semi_finished', label: '반제품' },
  { value: 'finished', label: '완제품' },
  { value: 'packaging', label: '포장재' },
]

const UNIT_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'L', label: 'L' },
  { value: 'mL', label: 'mL' },
  { value: 'ea', label: '개(ea)' },
  { value: 'box', label: '박스(box)' },
  { value: 'set', label: '세트(set)' },
  { value: 'pack', label: '팩(pack)' },
]

const TYPE_BADGE_COLOR: Record<ItemType, 'blue' | 'green' | 'yellow' | 'purple' | 'gray'> = {
  raw_material: 'blue',
  sub_material: 'gray',
  semi_finished: 'yellow',
  finished: 'green',
  packaging: 'purple',
}

interface ItemForm {
  code: string
  name: string
  type: ItemType
  unit: UnitType
  specification: string
  barcode: string
  category: string
  safetyStock: string
  leadTimeDays: string
}

export default function ItemListPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [search, setSearch] = useState('')
  const isCeo = useAuthStore((s) => s.isCeo())

  const { data: items = [], isLoading } = useCollection<Item>(
    'items',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const createMutation = useCreateDocument('items')
  const updateMutation = useUpdateDocument('items')
  const deleteMutation = useDeleteDocument('items')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ItemForm>()

  const openCreate = () => {
    setEditingItem(null)
    reset({ code: '', name: '', type: 'raw_material', unit: 'kg', specification: '', barcode: '', category: '', safetyStock: '', leadTimeDays: '' })
    setModalOpen(true)
  }

  const openEdit = (item: Item) => {
    setEditingItem(item)
    reset({
      code: item.code,
      name: item.name,
      type: item.type,
      unit: item.unit,
      specification: item.specification ?? '',
      barcode: item.barcode ?? '',
      category: item.category ?? '',
      safetyStock: item.safetyStock?.toString() ?? '',
      leadTimeDays: item.leadTimeDays?.toString() ?? '',
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: ItemForm) => {
    const payload = {
      code: data.code,
      name: data.name,
      type: data.type,
      unit: data.unit,
      specification: data.specification || null,
      barcode: data.barcode || null,
      category: data.category || null,
      safetyStock: data.safetyStock ? Number(data.safetyStock) : null,
      leadTimeDays: data.leadTimeDays ? Number(data.leadTimeDays) : null,
      isActive: true,
    }

    if (editingItem) {
      await updateMutation.mutateAsync({ docId: editingItem.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const handleDelete = async (item: Item) => {
    if (!confirm(`"${item.name}" 품목을 삭제하시겠습니까?`)) return
    await deleteMutation.mutateAsync(item.id)
  }

  const filtered = items.filter(
    (item) =>
      item.name.includes(search) ||
      item.code.includes(search) ||
      (item.barcode?.includes(search) ?? false),
  )

  const columns = [
    { key: 'code', label: '품목코드', width: '120px' },
    { key: 'name', label: '품목명' },
    {
      key: 'type',
      label: '유형',
      width: '100px',
      render: (val: unknown) => {
        const v = val as ItemType
        const label = ITEM_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v
        return <Badge color={TYPE_BADGE_COLOR[v]}>{label}</Badge>
      },
    },
    { key: 'unit', label: '단위', width: '80px' },
    { key: 'specification', label: '규격' },
    { key: 'safetyStock', label: '안전재고', width: '100px', render: (val: unknown) => val != null ? String(val) : '—' },
    {
      key: 'actions',
      label: '',
      width: '140px',
      render: (_: unknown, row: Item) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
          {isCeo && (
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDelete(row) }}>삭제</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">품목관리</h1>
        <Button onClick={openCreate}>품목 등록</Button>
      </div>

      <Card>
        <div className="mb-4">
          <Input
            placeholder="품목코드, 품목명, 바코드 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingItem ? '품목 수정' : '품목 등록'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="품목코드 *" error={errors.code?.message} {...register('code', { required: '필수 항목입니다' })} />
            <Input label="품목명 *" error={errors.name?.message} {...register('name', { required: '필수 항목입니다' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="유형 *" options={ITEM_TYPE_OPTIONS} {...register('type')} />
            <Select label="단위 *" options={UNIT_OPTIONS} {...register('unit')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="규격" {...register('specification')} />
            <Input label="바코드" {...register('barcode')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="분류" {...register('category')} />
            <Input label="안전재고" type="number" {...register('safetyStock')} />
            <Input label="리드타임(일)" type="number" {...register('leadTimeDays')} />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingItem ? '수정' : '등록'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
