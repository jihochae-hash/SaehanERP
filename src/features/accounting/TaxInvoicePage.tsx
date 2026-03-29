import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'

// --- 인라인 타입 ---

type InvoiceStatus = 'draft' | 'issued' | 'sent'

interface TaxInvoice {
  id: string
  invoiceNo: string
  issueDate: string
  supplierName: string
  buyerName: string
  supplyAmount: number
  taxAmount: number
  totalAmount: number
  status: InvoiceStatus
  notes: string
  createdAt: unknown
}

interface InvoiceForm {
  invoiceNo: string
  issueDate: string
  supplierName: string
  buyerName: string
  supplyAmount: string
  taxAmount: string
  status: InvoiceStatus
  notes: string
}

// --- 상수 ---

const STATUS_BADGE: Record<InvoiceStatus, { label: string; color: 'gray' | 'blue' | 'green' }> = {
  draft: { label: '작성중', color: 'gray' },
  issued: { label: '발행', color: 'blue' },
  sent: { label: '전송완료', color: 'green' },
}

const STATUS_OPTIONS = [
  { value: 'draft', label: '작성중' },
  { value: 'issued', label: '발행' },
  { value: 'sent', label: '전송완료' },
]

export default function TaxInvoicePage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaxInvoice | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: invoices = [], isLoading } = useCollection<TaxInvoice>(
    'taxInvoices',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const createMutation = useCreateDocument('taxInvoices')
  const updateMutation = useUpdateDocument('taxInvoices')

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<InvoiceForm>()

  /** 합계금액 자동 계산 */
  const supplyVal = Number(watch('supplyAmount') || 0)
  const taxVal = Number(watch('taxAmount') || 0)
  const calculatedTotal = supplyVal + taxVal

  const openCreate = () => {
    setEditing(null)
    reset({
      invoiceNo: '', issueDate: '', supplierName: '',
      buyerName: '', supplyAmount: '', taxAmount: '',
      status: 'draft', notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (inv: TaxInvoice) => {
    setEditing(inv)
    reset({
      invoiceNo: inv.invoiceNo,
      issueDate: inv.issueDate,
      supplierName: inv.supplierName,
      buyerName: inv.buyerName,
      supplyAmount: String(inv.supplyAmount),
      taxAmount: String(inv.taxAmount),
      status: inv.status,
      notes: inv.notes ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: InvoiceForm) => {
    const supply = Number(data.supplyAmount)
    const tax = Number(data.taxAmount)
    const payload = {
      invoiceNo: data.invoiceNo,
      issueDate: data.issueDate,
      supplierName: data.supplierName,
      buyerName: data.buyerName,
      supplyAmount: supply,
      taxAmount: tax,
      totalAmount: supply + tax,
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

  const filtered = invoices.filter((i) => {
    const matchSearch =
      i.invoiceNo.includes(search) ||
      i.supplierName.includes(search) ||
      i.buyerName.includes(search)
    const matchStatus = !statusFilter || i.status === statusFilter
    return matchSearch && matchStatus
  })

  const columns = [
    { key: 'invoiceNo', label: '세금계산서번호', width: '150px' },
    { key: 'issueDate', label: '발행일', width: '100px' },
    { key: 'supplierName', label: '공급자' },
    { key: 'buyerName', label: '공급받는자' },
    {
      key: 'supplyAmount', label: '공급가액', width: '120px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    {
      key: 'taxAmount', label: '세액', width: '100px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    {
      key: 'totalAmount', label: '합계', width: '120px',
      render: (val: unknown) => <span className="font-semibold">{formatNumber(val as number)}원</span>,
    },
    {
      key: 'status', label: '상태', width: '90px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as InvoiceStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: TaxInvoice) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">전자세금계산서</h1>
        <Button onClick={openCreate}>세금계산서 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="세금계산서번호, 공급자, 공급받는자 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
            <Select
              options={[{ value: '', label: '전체 상태' }, ...STATUS_OPTIONS]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="세금계산서가 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '세금계산서 수정' : '세금계산서 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="세금계산서번호 *" error={errors.invoiceNo?.message} {...register('invoiceNo', { required: '필수' })} />
            <Input label="발행일 *" type="date" error={errors.issueDate?.message} {...register('issueDate', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="공급자 *" error={errors.supplierName?.message} {...register('supplierName', { required: '필수' })} />
            <Input label="공급받는자 *" error={errors.buyerName?.message} {...register('buyerName', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="공급가액 (원) *" type="number" error={errors.supplyAmount?.message} {...register('supplyAmount', { required: '필수' })} />
            <Input label="세액 (원) *" type="number" error={errors.taxAmount?.message} {...register('taxAmount', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">합계금액:</span>
              <span className="font-semibold text-lg">{formatNumber(calculatedTotal)}원</span>
            </div>
            <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
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
