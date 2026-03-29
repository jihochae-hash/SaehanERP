import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument, useDeleteDocument } from '@/hooks/useFirestore'
import { useAuthStore } from '@/stores/auth'
import { useForm } from 'react-hook-form'
import type { Ingredient } from '@/types'

const CATEGORY_OPTIONS = [
  { value: '유화제', label: '유화제' },
  { value: '보습제', label: '보습제' },
  { value: '계면활성제', label: '계면활성제' },
  { value: '방부제', label: '방부제' },
  { value: '향료', label: '향료' },
  { value: '색소', label: '색소' },
  { value: '자외선차단제', label: '자외선차단제' },
  { value: '유지류', label: '유지류' },
  { value: '추출물', label: '추출물' },
  { value: '기능성원료', label: '기능성원료' },
  { value: '기타', label: '기타' },
]

const BOOL_OPTIONS = [
  { value: 'false', label: '아니오' },
  { value: 'true', label: '예' },
]

interface IngredientForm {
  code: string
  nameKo: string
  nameEn: string
  inciName: string
  casNo: string
  supplier: string
  category: string
  function: string
  isProhibited: string
  maxUsagePercent: string
  isAllergen: string
  allergenType: string
  notes: string
}

export default function IngredientListPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [search, setSearch] = useState('')
  const isCeo = useAuthStore((s) => s.isCeo())

  const { data: ingredients = [], isLoading } = useCollection<Ingredient>(
    'ingredients',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const createMutation = useCreateDocument('ingredients')
  const updateMutation = useUpdateDocument('ingredients')
  const deleteMutation = useDeleteDocument('ingredients')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<IngredientForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      code: '', nameKo: '', nameEn: '', inciName: '', casNo: '', supplier: '',
      category: '기타', function: '', isProhibited: 'false', maxUsagePercent: '',
      isAllergen: 'false', allergenType: '', notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (item: Ingredient) => {
    setEditing(item)
    reset({
      code: item.code, nameKo: item.nameKo, nameEn: item.nameEn,
      inciName: item.inciName, casNo: item.casNo ?? '',
      supplier: item.supplier ?? '', category: item.category ?? '기타',
      function: item.function ?? '', isProhibited: String(item.isProhibited),
      maxUsagePercent: item.maxUsagePercent != null ? String(item.maxUsagePercent) : '',
      isAllergen: String(item.isAllergen),
      allergenType: item.allergenType ?? '', notes: item.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: IngredientForm) => {
    const payload = {
      code: data.code,
      nameKo: data.nameKo,
      nameEn: data.nameEn,
      inciName: data.inciName,
      casNo: data.casNo || null,
      supplier: data.supplier || null,
      category: data.category || null,
      function: data.function || null,
      isProhibited: data.isProhibited === 'true',
      maxUsagePercent: data.maxUsagePercent ? Number(data.maxUsagePercent) : null,
      isAllergen: data.isAllergen === 'true',
      allergenType: data.isAllergen === 'true' ? (data.allergenType || null) : null,
      allergenLeaveOnThreshold: data.isAllergen === 'true' ? 0.001 : null,
      allergenRinseOffThreshold: data.isAllergen === 'true' ? 0.01 : null,
      notes: data.notes || null,
      isActive: true,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const handleDelete = async (item: Ingredient) => {
    if (!confirm(`"${item.nameKo}" 원료를 삭제하시겠습니까?`)) return
    await deleteMutation.mutateAsync(item.id)
  }

  const filtered = ingredients.filter(
    (i) =>
      i.nameKo.includes(search) ||
      i.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      i.inciName.toLowerCase().includes(search.toLowerCase()) ||
      i.code.includes(search) ||
      (i.casNo?.includes(search) ?? false),
  )

  const columns = [
    { key: 'code', label: '원료코드', width: '100px' },
    { key: 'nameKo', label: '원료명(한)' },
    { key: 'nameEn', label: '원료명(영)' },
    { key: 'inciName', label: 'INCI Name' },
    { key: 'casNo', label: 'CAS No.', width: '110px', render: (val: unknown) => val ? String(val) : '—' },
    { key: 'category', label: '분류', width: '100px', render: (val: unknown) => val ? String(val) : '—' },
    {
      key: 'isProhibited', label: '금지', width: '60px',
      render: (val: unknown) => val ? <Badge color="red">금지</Badge> : null,
    },
    {
      key: 'isAllergen', label: '알러젠', width: '70px',
      render: (val: unknown) => val ? <Badge color="yellow">알러젠</Badge> : null,
    },
    {
      key: 'maxUsagePercent', label: '한도(%)', width: '80px',
      render: (val: unknown) => val != null ? `${val}%` : '—',
    },
    {
      key: 'actions', label: '', width: '140px', sortable: false,
      render: (_: unknown, row: Ingredient) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
          {isCeo && <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDelete(row) }}>삭제</Button>}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">원료 마스터</h1>
        <Button onClick={openCreate}>원료 등록</Button>
      </div>

      <Card>
        <div className="mb-4">
          <Input placeholder="원료코드, 원료명, INCI, CAS No. 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} />
        {!isLoading && filtered.length > 0 && (
          <div className="mt-3 text-sm text-gray-500 text-right">총 {filtered.length}건</div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '원료 수정' : '원료 등록'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="원료코드 *" error={errors.code?.message} {...register('code', { required: '필수 항목입니다' })} />
            <Input label="원료명(한) *" error={errors.nameKo?.message} {...register('nameKo', { required: '필수 항목입니다' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="원료명(영) *" error={errors.nameEn?.message} {...register('nameEn', { required: '필수 항목입니다' })} />
            <Input label="INCI Name *" error={errors.inciName?.message} {...register('inciName', { required: '필수 항목입니다' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="CAS No." {...register('casNo')} />
            <Input label="공급업체" {...register('supplier')} />
            <Select label="분류" options={CATEGORY_OPTIONS} {...register('category')} />
          </div>
          <Input label="기능/용도" {...register('function')} />

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">규제 정보</h4>
            <div className="grid grid-cols-3 gap-4">
              <Select label="금지 성분" options={BOOL_OPTIONS} {...register('isProhibited')} />
              <Input label="배합한도 (%)" type="number" step="0.001" placeholder="제한 없으면 비워두세요" {...register('maxUsagePercent')} />
              <Select label="EU 알러젠 (81종)" options={BOOL_OPTIONS} {...register('isAllergen')} />
            </div>
          </div>

          <Input label="비고" {...register('notes')} />

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? '수정' : '등록'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
