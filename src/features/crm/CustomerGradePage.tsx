import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Card, Table, Modal, Input, Select, Badge, Button } from '@/components/ui'
import { useCollection, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'

// --- 인라인 타입 ---

type CustomerGrade = 'VIP' | 'A' | 'B' | 'C' | 'D'

interface Partner {
  id: string
  code: string
  name: string
  type: string
  grade?: CustomerGrade
  annualSales?: number
  lastOrderDate?: string
  createdAt: unknown
}

interface GradeForm {
  grade: CustomerGrade
  annualSales: string
  lastOrderDate: string
}

// --- 상수 ---

const GRADE_BADGE: Record<CustomerGrade, { label: string; color: 'purple' | 'blue' | 'green' | 'yellow' | 'gray' }> = {
  VIP: { label: 'VIP', color: 'purple' },
  A: { label: 'A등급', color: 'blue' },
  B: { label: 'B등급', color: 'green' },
  C: { label: 'C등급', color: 'yellow' },
  D: { label: 'D등급', color: 'gray' },
}

const GRADE_OPTIONS = [
  { value: 'VIP', label: 'VIP' },
  { value: 'A', label: 'A등급' },
  { value: 'B', label: 'B등급' },
  { value: 'C', label: 'C등급' },
  { value: 'D', label: 'D등급' },
]

export default function CustomerGradePage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')

  const { data: partners = [], isLoading } = useCollection<Partner>(
    'partners',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const updateMutation = useUpdateDocument('partners')

  const { register, handleSubmit, reset } = useForm<GradeForm>()

  /** 등급별 분포 집계 */
  const gradeCounts = partners.reduce<Record<string, number>>((acc, p) => {
    const g = p.grade ?? '미지정'
    acc[g] = (acc[g] ?? 0) + 1
    return acc
  }, {})

  const openEdit = (partner: Partner) => {
    setEditing(partner)
    reset({
      grade: partner.grade ?? 'C',
      annualSales: String(partner.annualSales ?? 0),
      lastOrderDate: partner.lastOrderDate ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: GradeForm) => {
    if (!editing) return
    const payload = {
      grade: data.grade,
      annualSales: Number(data.annualSales),
      lastOrderDate: data.lastOrderDate || null,
    }
    await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    setModalOpen(false)
  }

  const filtered = partners.filter((p) => {
    const matchSearch = p.name.includes(search) || p.code.includes(search)
    const matchGrade = !gradeFilter || p.grade === gradeFilter
    return matchSearch && matchGrade
  })

  const columns = [
    { key: 'code', label: '거래처코드', width: '120px' },
    { key: 'name', label: '거래처명' },
    { key: 'type', label: '유형', width: '90px' },
    {
      key: 'grade', label: '등급', width: '90px',
      render: (val: unknown) => {
        if (!val) return <Badge color="gray">미지정</Badge>
        const info = GRADE_BADGE[val as CustomerGrade]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    {
      key: 'annualSales', label: '연매출', width: '130px',
      render: (val: unknown) => val ? `${formatNumber(val as number)}원` : '-',
    },
    {
      key: 'lastOrderDate', label: '최종주문일', width: '110px',
      render: (val: unknown) => (val as string) || '-',
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '100px', sortable: false,
      render: (_: unknown, row: Partner) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>등급 설정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">고객등급관리</h1>
      </div>

      {/* 등급별 분포 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {GRADE_OPTIONS.map((g) => (
          <Card key={g.value}>
            <div className="text-center">
              <Badge color={GRADE_BADGE[g.value as CustomerGrade].color}>
                {g.label}
              </Badge>
              <p className="mt-2 text-2xl font-bold text-gray-900">{gradeCounts[g.value] ?? 0}</p>
              <p className="text-xs text-gray-500">거래처</p>
            </div>
          </Card>
        ))}
        <Card>
          <div className="text-center">
            <Badge color="gray">미지정</Badge>
            <p className="mt-2 text-2xl font-bold text-gray-900">{gradeCounts['미지정'] ?? 0}</p>
            <p className="text-xs text-gray-500">거래처</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="거래처코드, 거래처명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
            <Select
              options={[{ value: '', label: '전체 등급' }, ...GRADE_OPTIONS]}
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="거래처가 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={`등급 설정 — ${editing?.name ?? ''}`}>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <Select label="등급 *" options={GRADE_OPTIONS} {...register('grade')} />
          <Input label="연매출 (원)" type="number" {...register('annualSales')} />
          <Input label="최종주문일" type="date" {...register('lastOrderDate')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={updateMutation.isPending}>저장</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
