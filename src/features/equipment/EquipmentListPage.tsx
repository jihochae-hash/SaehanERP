import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'
import type { BaseDocument } from '@/types'

/** 설비 상태 */
type EquipmentStatus = 'operating' | 'maintenance' | 'stopped' | 'disposed'

/** 설비 유형 */
type EquipmentType = 'mixer' | 'filling' | 'packaging' | 'tank' | 'other'

const STATUS_BADGE: Record<EquipmentStatus, { label: string; color: 'green' | 'yellow' | 'red' | 'gray' }> = {
  operating: { label: '가동중', color: 'green' },
  maintenance: { label: '정비중', color: 'yellow' },
  stopped: { label: '정지', color: 'red' },
  disposed: { label: '폐기', color: 'gray' },
}

const STATUS_OPTIONS = [
  { value: 'operating', label: '가동중' },
  { value: 'maintenance', label: '정비중' },
  { value: 'stopped', label: '정지' },
  { value: 'disposed', label: '폐기' },
]

const TYPE_OPTIONS = [
  { value: 'mixer', label: '믹서' },
  { value: 'filling', label: '충진기' },
  { value: 'packaging', label: '포장기' },
  { value: 'tank', label: '탱크' },
  { value: 'other', label: '기타' },
]

const TYPE_LABEL: Record<EquipmentType, string> = {
  mixer: '믹서',
  filling: '충진기',
  packaging: '포장기',
  tank: '탱크',
  other: '기타',
}

/** 설비대장 (equipment 컬렉션) */
interface Equipment extends BaseDocument {
  equipmentNo: string
  name: string
  type: EquipmentType
  manufacturer: string
  installDate: string
  location: string
  status: EquipmentStatus
  specifications?: string
  notes?: string
}

interface EquipmentForm {
  equipmentNo: string
  name: string
  type: EquipmentType
  manufacturer: string
  installDate: string
  location: string
  status: EquipmentStatus
  specifications: string
  notes: string
}

export default function EquipmentListPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: equipment = [], isLoading } = useCollection<Equipment>('equipment', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('equipment')
  const updateMutation = useUpdateDocument('equipment')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EquipmentForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      equipmentNo: '', name: '', type: 'mixer', manufacturer: '',
      installDate: '', location: '', status: 'operating',
      specifications: '', notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (item: Equipment) => {
    setEditing(item)
    reset({
      equipmentNo: item.equipmentNo, name: item.name, type: item.type,
      manufacturer: item.manufacturer, installDate: item.installDate,
      location: item.location, status: item.status,
      specifications: item.specifications ?? '', notes: item.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: EquipmentForm) => {
    const payload = {
      equipmentNo: data.equipmentNo,
      name: data.name,
      type: data.type,
      manufacturer: data.manufacturer,
      installDate: data.installDate,
      location: data.location,
      status: data.status,
      specifications: data.specifications || null,
      notes: data.notes || null,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const filtered = equipment.filter((e) => {
    const matchSearch =
      e.equipmentNo.includes(search) ||
      e.name.includes(search) ||
      e.manufacturer.includes(search) ||
      e.location.includes(search)
    const matchStatus = !statusFilter || e.status === statusFilter
    const matchType = !typeFilter || e.type === typeFilter
    return matchSearch && matchStatus && matchType
  })

  const columns = [
    { key: 'equipmentNo', label: '설비번호', width: '120px' },
    { key: 'name', label: '설비명' },
    {
      key: 'type', label: '유형', width: '90px',
      render: (val: unknown) => TYPE_LABEL[val as EquipmentType] ?? val,
    },
    { key: 'manufacturer', label: '제조사', width: '120px' },
    { key: 'installDate', label: '설치일', width: '100px' },
    { key: 'location', label: '설치위치', width: '120px' },
    {
      key: 'status', label: '상태', width: '90px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as EquipmentStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: Equipment) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">설비대장</h1>
        <Button onClick={openCreate}>설비 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="설비번호, 설비명, 제조사, 위치 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-32">
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
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="등록된 설비가 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '설비 수정' : '설비 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="설비번호 *" error={errors.equipmentNo?.message} {...register('equipmentNo', { required: '필수' })} />
            <Input label="설비명 *" error={errors.name?.message} {...register('name', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="유형" options={TYPE_OPTIONS} {...register('type')} />
            <Input label="제조사 *" error={errors.manufacturer?.message} {...register('manufacturer', { required: '필수' })} />
            <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="설치일" type="date" {...register('installDate')} />
            <Input label="설치위치 *" error={errors.location?.message} {...register('location', { required: '필수' })} />
          </div>
          <Input label="사양/스펙" {...register('specifications')} />
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
