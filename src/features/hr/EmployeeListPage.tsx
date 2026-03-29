import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'

// --- 인라인 타입 ---

type EmployeeStatus = 'active' | 'leave' | 'resigned'

interface Employee {
  id: string
  employeeNo: string
  name: string
  department: string
  position: string
  joinDate: string
  phone: string
  email: string
  status: EmployeeStatus
  createdAt: unknown
}

interface EmployeeForm {
  employeeNo: string
  name: string
  department: string
  position: string
  joinDate: string
  phone: string
  email: string
  status: EmployeeStatus
}

// --- 상수 ---

const STATUS_BADGE: Record<EmployeeStatus, { label: string; color: 'green' | 'yellow' | 'red' }> = {
  active: { label: '재직', color: 'green' },
  leave: { label: '휴직', color: 'yellow' },
  resigned: { label: '퇴사', color: 'red' },
}

const STATUS_OPTIONS = [
  { value: 'active', label: '재직' },
  { value: 'leave', label: '휴직' },
  { value: 'resigned', label: '퇴사' },
]

const DEPARTMENT_OPTIONS = [
  { value: '경영지원', label: '경영지원' },
  { value: '생산', label: '생산' },
  { value: '연구개발', label: '연구개발' },
  { value: '영업', label: '영업' },
  { value: '품질관리', label: '품질관리' },
  { value: '구매', label: '구매' },
  { value: '물류', label: '물류' },
]

export default function EmployeeListPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: employees = [], isLoading } = useCollection<Employee>(
    'employees',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const createMutation = useCreateDocument('employees')
  const updateMutation = useUpdateDocument('employees')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      employeeNo: '', name: '', department: '경영지원',
      position: '', joinDate: '', phone: '',
      email: '', status: 'active',
    })
    setModalOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    reset({
      employeeNo: emp.employeeNo,
      name: emp.name,
      department: emp.department,
      position: emp.position,
      joinDate: emp.joinDate,
      phone: emp.phone ?? '',
      email: emp.email ?? '',
      status: emp.status,
    })
    setModalOpen(true)
  }

  const onSave = async (data: EmployeeForm) => {
    const payload = {
      employeeNo: data.employeeNo,
      name: data.name,
      department: data.department,
      position: data.position,
      joinDate: data.joinDate,
      phone: data.phone || null,
      email: data.email || null,
      status: data.status,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const filtered = employees.filter((e) => {
    const matchSearch =
      e.employeeNo.includes(search) ||
      e.name.includes(search) ||
      e.department.includes(search)
    const matchStatus = !statusFilter || e.status === statusFilter
    return matchSearch && matchStatus
  })

  const columns = [
    { key: 'employeeNo', label: '사번', width: '100px' },
    { key: 'name', label: '이름', width: '100px' },
    { key: 'department', label: '부서', width: '100px' },
    { key: 'position', label: '직급', width: '90px' },
    { key: 'joinDate', label: '입사일', width: '100px' },
    { key: 'phone', label: '연락처', width: '130px' },
    { key: 'email', label: '이메일' },
    {
      key: 'status', label: '상태', width: '80px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as EmployeeStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: Employee) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">사원정보</h1>
        <Button onClick={openCreate}>사원 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="사번, 이름, 부서 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
            <Select
              options={[{ value: '', label: '전체 상태' }, ...STATUS_OPTIONS]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="사원 정보가 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '사원 수정' : '사원 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="사번 *" error={errors.employeeNo?.message} {...register('employeeNo', { required: '필수' })} />
            <Input label="이름 *" error={errors.name?.message} {...register('name', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="부서 *" options={DEPARTMENT_OPTIONS} {...register('department')} />
            <Input label="직급 *" error={errors.position?.message} {...register('position', { required: '필수' })} />
            <Input label="입사일 *" type="date" error={errors.joinDate?.message} {...register('joinDate', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="연락처" placeholder="010-0000-0000" {...register('phone')} />
            <Input label="이메일" type="email" {...register('email')} />
          </div>
          <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
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
