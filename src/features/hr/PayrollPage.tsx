import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'

// --- 인라인 타입 ---

type PayrollStatus = 'draft' | 'confirmed' | 'paid'

interface Payroll {
  id: string
  payrollNo: string
  period: string
  employeeName: string
  baseSalary: number
  overtimePay: number
  bonus: number
  totalPay: number
  nationalPension: number
  healthInsurance: number
  employmentInsurance: number
  incomeTax: number
  netPay: number
  status: PayrollStatus
  createdAt: unknown
}

interface PayrollForm {
  payrollNo: string
  period: string
  employeeName: string
  baseSalary: string
  overtimePay: string
  bonus: string
  nationalPension: string
  healthInsurance: string
  employmentInsurance: string
  incomeTax: string
  status: PayrollStatus
}

// --- 상수 ---

const STATUS_BADGE: Record<PayrollStatus, { label: string; color: 'gray' | 'blue' | 'green' }> = {
  draft: { label: '작성중', color: 'gray' },
  confirmed: { label: '확정', color: 'blue' },
  paid: { label: '지급완료', color: 'green' },
}

const STATUS_OPTIONS = [
  { value: 'draft', label: '작성중' },
  { value: 'confirmed', label: '확정' },
  { value: 'paid', label: '지급완료' },
]

export default function PayrollPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Payroll | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: payrolls = [], isLoading } = useCollection<Payroll>(
    'payrolls',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const createMutation = useCreateDocument('payrolls')
  const updateMutation = useUpdateDocument('payrolls')

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PayrollForm>()

  /** 자동 계산 */
  const baseSalaryVal = Number(watch('baseSalary') || 0)
  const overtimePayVal = Number(watch('overtimePay') || 0)
  const bonusVal = Number(watch('bonus') || 0)
  const nationalPensionVal = Number(watch('nationalPension') || 0)
  const healthInsuranceVal = Number(watch('healthInsurance') || 0)
  const employmentInsuranceVal = Number(watch('employmentInsurance') || 0)
  const incomeTaxVal = Number(watch('incomeTax') || 0)

  const totalPay = baseSalaryVal + overtimePayVal + bonusVal
  const totalDeductions = nationalPensionVal + healthInsuranceVal + employmentInsuranceVal + incomeTaxVal
  const netPay = totalPay - totalDeductions

  const openCreate = () => {
    setEditing(null)
    reset({
      payrollNo: '', period: '', employeeName: '',
      baseSalary: '', overtimePay: '0', bonus: '0',
      nationalPension: '0', healthInsurance: '0',
      employmentInsurance: '0', incomeTax: '0',
      status: 'draft',
    })
    setModalOpen(true)
  }

  const openEdit = (p: Payroll) => {
    setEditing(p)
    reset({
      payrollNo: p.payrollNo,
      period: p.period,
      employeeName: p.employeeName,
      baseSalary: String(p.baseSalary),
      overtimePay: String(p.overtimePay),
      bonus: String(p.bonus),
      nationalPension: String(p.nationalPension),
      healthInsurance: String(p.healthInsurance),
      employmentInsurance: String(p.employmentInsurance),
      incomeTax: String(p.incomeTax),
      status: p.status,
    })
    setModalOpen(true)
  }

  const onSave = async (data: PayrollForm) => {
    const base = Number(data.baseSalary)
    const overtime = Number(data.overtimePay)
    const bon = Number(data.bonus)
    const pension = Number(data.nationalPension)
    const health = Number(data.healthInsurance)
    const employment = Number(data.employmentInsurance)
    const tax = Number(data.incomeTax)
    const total = base + overtime + bon
    const net = total - pension - health - employment - tax

    const payload = {
      payrollNo: data.payrollNo,
      period: data.period,
      employeeName: data.employeeName,
      baseSalary: base,
      overtimePay: overtime,
      bonus: bon,
      totalPay: total,
      nationalPension: pension,
      healthInsurance: health,
      employmentInsurance: employment,
      incomeTax: tax,
      netPay: net,
      status: data.status,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const filtered = payrolls.filter((p) => {
    const matchSearch =
      p.payrollNo.includes(search) ||
      p.employeeName.includes(search) ||
      p.period.includes(search)
    const matchStatus = !statusFilter || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const columns = [
    { key: 'payrollNo', label: '급여번호', width: '120px' },
    { key: 'period', label: '귀속월', width: '90px' },
    { key: 'employeeName', label: '사원명', width: '100px' },
    {
      key: 'baseSalary', label: '기본급', width: '110px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    {
      key: 'overtimePay', label: '연장수당', width: '100px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    {
      key: 'totalPay', label: '총지급액', width: '120px',
      render: (val: unknown) => <span className="font-semibold">{formatNumber(val as number)}원</span>,
    },
    {
      key: 'netPay', label: '실수령액', width: '120px',
      render: (val: unknown) => <span className="font-semibold text-blue-600">{formatNumber(val as number)}원</span>,
    },
    {
      key: 'status', label: '상태', width: '90px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as PayrollStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: Payroll) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">급여관리</h1>
        <Button onClick={openCreate}>급여 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="급여번호, 사원명, 귀속월 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
            <Select
              options={[{ value: '', label: '전체 상태' }, ...STATUS_OPTIONS]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="급여 기록이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '급여 수정' : '급여 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label="급여번호 *" error={errors.payrollNo?.message} {...register('payrollNo', { required: '필수' })} />
            <Input label="귀속월 *" placeholder="예: 2026-03" error={errors.period?.message} {...register('period', { required: '필수' })} />
            <Input label="사원명 *" error={errors.employeeName?.message} {...register('employeeName', { required: '필수' })} />
          </div>

          {/* 지급 항목 */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">지급 항목</h4>
            <div className="grid grid-cols-3 gap-4">
              <Input label="기본급 (원) *" type="number" error={errors.baseSalary?.message} {...register('baseSalary', { required: '필수' })} />
              <Input label="연장수당 (원)" type="number" {...register('overtimePay')} />
              <Input label="상여금 (원)" type="number" {...register('bonus')} />
            </div>
          </div>

          {/* 공제 항목 */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">공제 항목</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input label="국민연금 (원)" type="number" {...register('nationalPension')} />
              <Input label="건강보험 (원)" type="number" {...register('healthInsurance')} />
              <Input label="고용보험 (원)" type="number" {...register('employmentInsurance')} />
              <Input label="소득세 (원)" type="number" {...register('incomeTax')} />
            </div>
          </div>

          {/* 계산 결과 */}
          <div className="flex items-center gap-6 px-3 py-3 bg-gray-50 rounded-lg">
            <div>
              <span className="text-sm text-gray-600">총지급액: </span>
              <span className="font-semibold">{formatNumber(totalPay)}원</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">공제합계: </span>
              <span className="font-semibold text-red-600">{formatNumber(totalDeductions)}원</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">실수령액: </span>
              <span className="font-bold text-blue-600 text-lg">{formatNumber(netPay)}원</span>
            </div>
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
