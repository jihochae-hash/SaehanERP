import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument, useDeleteDocument } from '@/hooks/useFirestore'
import { useAuthStore } from '@/stores/auth'
import { useForm } from 'react-hook-form'
import type { Warehouse } from '@/types'

interface WarehouseForm {
  code: string
  name: string
  location: string
}

export default function WarehouseListPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Warehouse | null>(null)
  const isCeo = useAuthStore((s) => s.isCeo())

  const { data: warehouses = [], isLoading } = useCollection<Warehouse>(
    'warehouses',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const createMutation = useCreateDocument('warehouses')
  const updateMutation = useUpdateDocument('warehouses')
  const deleteMutation = useDeleteDocument('warehouses')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WarehouseForm>()

  const openCreate = () => {
    setEditing(null)
    reset({ code: '', name: '', location: '' })
    setModalOpen(true)
  }

  const openEdit = (w: Warehouse) => {
    setEditing(w)
    reset({ code: w.code, name: w.name, location: w.location ?? '' })
    setModalOpen(true)
  }

  const onSubmit = async (data: WarehouseForm) => {
    const payload = { ...data, location: data.location || null, isActive: true }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const handleDelete = async (w: Warehouse) => {
    if (!confirm(`"${w.name}" 창고를 삭제하시겠습니까?`)) return
    await deleteMutation.mutateAsync(w.id)
  }

  const columns = [
    { key: 'code', label: '창고코드', width: '120px' },
    { key: 'name', label: '창고명' },
    { key: 'location', label: '위치', render: (val: unknown) => val ? String(val) : '—' },
    {
      key: 'isActive', label: '상태', width: '80px',
      render: (val: unknown) => <Badge color={val ? 'green' : 'gray'}>{val ? '활성' : '비활성'}</Badge>,
    },
    {
      key: 'actions', label: '', width: '140px',
      render: (_: unknown, row: Warehouse) => (
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
        <h1 className="text-2xl font-bold text-gray-900">창고관리</h1>
        <Button onClick={openCreate}>창고 등록</Button>
      </div>

      <Card>
        <Table columns={columns} data={warehouses} loading={isLoading} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '창고 수정' : '창고 등록'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="창고코드 *" error={errors.code?.message} {...register('code', { required: '필수 항목입니다' })} />
          <Input label="창고명 *" error={errors.name?.message} {...register('name', { required: '필수 항목입니다' })} />
          <Input label="위치" {...register('location')} />
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
