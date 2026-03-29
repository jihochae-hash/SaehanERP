import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument, useDeleteDocument } from '@/hooks/useFirestore'
import { useAuthStore } from '@/stores/auth'
import { useForm } from 'react-hook-form'
import type { Bom, BomItem, Item } from '@/types'

interface BomForm {
  productItemId: string
  baseQuantity: string
  baseUnit: string
  formulaId: string
}

interface BomItemForm {
  itemId: string
  quantity: string
  lossRate: string
  notes: string
}

export default function BomListPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Bom | null>(null)
  const [bomItems, setBomItems] = useState<BomItem[]>([])
  const [isItemModalOpen, setItemModalOpen] = useState(false)
  const isCeo = useAuthStore((s) => s.isCeo())

  const { data: boms = [], isLoading } = useCollection<Bom>('boms', [orderBy('createdAt', 'desc')], ['all'])
  const { data: items = [] } = useCollection<Item>('items', [orderBy('name', 'asc')], ['active'])
  const createMutation = useCreateDocument('boms')
  const updateMutation = useUpdateDocument('boms')
  const deleteMutation = useDeleteDocument('boms')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BomForm>()
  const { register: regItem, handleSubmit: handleItem, reset: resetItem } = useForm<BomItemForm>()

  const finishedItems = items.filter((i) => i.type === 'finished' || i.type === 'semi_finished')
  const materialItems = items.filter((i) => i.type === 'raw_material' || i.type === 'sub_material' || i.type === 'packaging')

  const productOptions = finishedItems.map((i) => ({ value: i.id, label: `[${i.code}] ${i.name}` }))
  const materialOptions = materialItems.map((i) => ({ value: i.id, label: `[${i.code}] ${i.name}` }))

  const openCreate = () => {
    setEditing(null)
    setBomItems([])
    reset({ productItemId: '', baseQuantity: '', baseUnit: 'kg', formulaId: '' })
    setModalOpen(true)
  }

  const openEdit = (bom: Bom) => {
    setEditing(bom)
    setBomItems(bom.items ?? [])
    reset({
      productItemId: bom.productItemId,
      baseQuantity: String(bom.baseQuantity),
      baseUnit: bom.baseUnit,
      formulaId: bom.formulaId ?? '',
    })
    setModalOpen(true)
  }

  const onAddItem = (data: BomItemForm) => {
    const item = items.find((i) => i.id === data.itemId)
    if (!item) return
    setBomItems((prev) => [...prev, {
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      unit: item.unit,
      quantity: Number(data.quantity),
      lossRate: Number(data.lossRate) || 0,
      notes: data.notes || undefined,
    }])
    resetItem()
    setItemModalOpen(false)
  }

  const onSave = async (data: BomForm) => {
    const product = items.find((i) => i.id === data.productItemId)
    const payload = {
      productItemId: data.productItemId,
      productItemCode: product?.code ?? '',
      productItemName: product?.name ?? '',
      baseQuantity: Number(data.baseQuantity),
      baseUnit: data.baseUnit,
      formulaId: data.formulaId || null,
      items: bomItems,
      version: editing?.version ?? 1,
      isActive: true,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const columns = [
    { key: 'productItemCode', label: '제품코드', width: '120px' },
    { key: 'productItemName', label: '제품명' },
    { key: 'baseQuantity', label: '기준수량', width: '100px', render: (val: unknown, row: Bom) => `${val} ${row.baseUnit}` },
    { key: 'items', label: '자재수', width: '80px', render: (val: unknown) => Array.isArray(val) ? `${val.length}종` : '0종' },
    { key: 'version', label: 'Ver.', width: '60px', render: (val: unknown) => `v${val}` },
    {
      key: 'isActive', label: '상태', width: '70px',
      render: (val: unknown) => <Badge color={val ? 'green' : 'gray'}>{val ? '활성' : '비활성'}</Badge>,
    },
    {
      key: 'actions', label: '', width: '140px', sortable: false,
      render: (_: unknown, row: Bom) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
          {isCeo && <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(row.id) }}>삭제</Button>}
        </div>
      ),
    },
  ]

  const bomItemColumns = [
    { key: 'itemCode', label: '자재코드', width: '100px' },
    { key: 'itemName', label: '자재명' },
    { key: 'quantity', label: '소요량', width: '80px' },
    { key: 'unit', label: '단위', width: '60px' },
    { key: 'lossRate', label: '손실률(%)', width: '90px', render: (val: unknown) => `${val}%` },
    {
      key: 'actions', label: '', width: '60px', sortable: false,
      render: (_: unknown, row: BomItem) => (
        <Button size="sm" variant="ghost" onClick={() => setBomItems((prev) => prev.filter((i) => i.itemId !== row.itemId))}>삭제</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">BOM 관리</h1>
        <Button onClick={openCreate}>BOM 등록</Button>
      </div>

      <Card>
        <Table columns={columns} data={boms} loading={isLoading} />
      </Card>

      {/* BOM 등록/수정 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? 'BOM 수정' : 'BOM 등록'} size="xl">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="생산 제품 *" options={productOptions} placeholder="제품 선택" error={errors.productItemId?.message} {...register('productItemId', { required: '필수' })} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="기준수량 *" type="number" error={errors.baseQuantity?.message} {...register('baseQuantity', { required: '필수' })} />
              <Select label="단위" options={[{value:'kg',label:'kg'},{value:'L',label:'L'},{value:'ea',label:'ea'}]} {...register('baseUnit')} />
            </div>
          </div>

          {/* 자재 목록 */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">자재 목록</h4>
              <Button size="sm" type="button" onClick={() => { resetItem(); setItemModalOpen(true) }}>자재 추가</Button>
            </div>
            <Table columns={bomItemColumns} data={bomItems} keyField="itemId" emptyMessage="자재를 추가하세요." />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editing ? '수정' : '등록'}</Button>
          </div>
        </form>
      </Modal>

      {/* 자재 추가 모달 */}
      <Modal isOpen={isItemModalOpen} onClose={() => setItemModalOpen(false)} title="자재 추가">
        <form onSubmit={handleItem(onAddItem)} className="space-y-4">
          <Select label="자재 *" options={materialOptions} placeholder="자재 선택" {...regItem('itemId', { required: true })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="소요량 *" type="number" step="0.001" {...regItem('quantity', { required: true })} />
            <Input label="손실률 (%)" type="number" step="0.1" {...regItem('lossRate')} />
          </div>
          <Input label="비고" {...regItem('notes')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setItemModalOpen(false)}>취소</Button>
            <Button type="submit">추가</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
