import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument, useDeleteDocument } from '@/hooks/useFirestore'
import { useAuthStore } from '@/stores/auth'
import { useForm } from 'react-hook-form'
import type { Partner, PartnerType } from '@/types'

const PARTNER_TYPE_OPTIONS = [
  { value: 'supplier', label: '공급처' },
  { value: 'customer', label: '고객' },
  { value: 'both', label: '공급/고객' },
]

const TYPE_BADGE: Record<PartnerType, { label: string; color: 'blue' | 'green' | 'purple' }> = {
  supplier: { label: '공급처', color: 'blue' },
  customer: { label: '고객', color: 'green' },
  both: { label: '공급/고객', color: 'purple' },
}

interface PartnerForm {
  code: string
  name: string
  type: PartnerType
  businessNo: string
  representative: string
  address: string
  phone: string
  fax: string
  email: string
  contactPerson: string
  contactPhone: string
  notes: string
}

export default function PartnerListPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [search, setSearch] = useState('')
  const isCeo = useAuthStore((s) => s.isCeo())

  const { data: partners = [], isLoading } = useCollection<Partner>(
    'partners',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const createMutation = useCreateDocument('partners')
  const updateMutation = useUpdateDocument('partners')
  const deleteMutation = useDeleteDocument('partners')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PartnerForm>()

  const openCreate = () => {
    setEditingPartner(null)
    reset({ code: '', name: '', type: 'supplier', businessNo: '', representative: '', address: '', phone: '', fax: '', email: '', contactPerson: '', contactPhone: '', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (p: Partner) => {
    setEditingPartner(p)
    reset({
      code: p.code, name: p.name, type: p.type,
      businessNo: p.businessNo ?? '', representative: p.representative ?? '',
      address: p.address ?? '', phone: p.phone ?? '', fax: p.fax ?? '',
      email: p.email ?? '', contactPerson: p.contactPerson ?? '',
      contactPhone: p.contactPhone ?? '', notes: p.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: PartnerForm) => {
    const payload = {
      ...data,
      businessNo: data.businessNo || null,
      representative: data.representative || null,
      address: data.address || null,
      phone: data.phone || null,
      fax: data.fax || null,
      email: data.email || null,
      contactPerson: data.contactPerson || null,
      contactPhone: data.contactPhone || null,
      notes: data.notes || null,
      isActive: true,
    }
    if (editingPartner) {
      await updateMutation.mutateAsync({ docId: editingPartner.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const handleDelete = async (p: Partner) => {
    if (!confirm(`"${p.name}" 거래처를 삭제하시겠습니까?`)) return
    await deleteMutation.mutateAsync(p.id)
  }

  const filtered = partners.filter(
    (p) => p.name.includes(search) || p.code.includes(search) || (p.businessNo?.includes(search) ?? false),
  )

  const columns = [
    { key: 'code', label: '거래처코드', width: '120px' },
    { key: 'name', label: '거래처명' },
    {
      key: 'type', label: '유형', width: '100px',
      render: (val: unknown) => {
        const v = val as PartnerType
        const info = TYPE_BADGE[v]
        return <Badge color={info.color}>{info.label}</Badge>
      },
    },
    { key: 'businessNo', label: '사업자번호', width: '130px' },
    { key: 'contactPerson', label: '담당자', width: '100px' },
    { key: 'phone', label: '전화번호', width: '130px' },
    {
      key: 'actions', label: '', width: '140px',
      render: (_: unknown, row: Partner) => (
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
        <h1 className="text-2xl font-bold text-gray-900">거래처관리</h1>
        <Button onClick={openCreate}>거래처 등록</Button>
      </div>

      <Card>
        <div className="mb-4">
          <Input placeholder="거래처코드, 거래처명, 사업자번호 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingPartner ? '거래처 수정' : '거래처 등록'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="거래처코드 *" error={errors.code?.message} {...register('code', { required: '필수 항목입니다' })} />
            <Input label="거래처명 *" error={errors.name?.message} {...register('name', { required: '필수 항목입니다' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="유형 *" options={PARTNER_TYPE_OPTIONS} {...register('type')} />
            <Input label="사업자번호" {...register('businessNo')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="대표자" {...register('representative')} />
            <Input label="주소" {...register('address')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="전화번호" {...register('phone')} />
            <Input label="팩스" {...register('fax')} />
            <Input label="이메일" type="email" {...register('email')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="담당자" {...register('contactPerson')} />
            <Input label="담당자 연락처" {...register('contactPhone')} />
          </div>
          <Input label="비고" {...register('notes')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingPartner ? '수정' : '등록'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
