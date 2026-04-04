import { useState, useCallback } from 'react'
import { orderBy, where } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'

// --- 인라인 타입 ---

type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected'

interface QuotationItem {
  itemCode: string
  itemName: string
  unit: string
  quantity: number
  unitPrice: number
  amount: number
}

interface Quotation {
  id: string
  type: 'quotation'
  quotationNo: string
  customerName: string
  customerId: string
  quotationDate: string
  validUntil: string
  items: QuotationItem[]
  totalAmount: number
  status: QuotationStatus
  notes: string | null
  createdAt: unknown
}

interface Partner {
  id: string
  code: string
  name: string
  type: string
}

interface Item {
  id: string
  code: string
  name: string
  unit: string
  type: string
}

// --- 상수 ---

const STATUS_BADGE: Record<QuotationStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'red' }> = {
  draft: { label: '작성중', color: 'gray' },
  sent: { label: '발송', color: 'blue' },
  accepted: { label: '수락', color: 'green' },
  rejected: { label: '거절', color: 'red' },
}

interface QuotationForm {
  quotationNo: string
  customerId: string
  quotationDate: string
  validUntil: string
  status: QuotationStatus
  notes: string
}

interface ItemForm {
  itemId: string
  quantity: string
  unitPrice: string
}

export default function QuotationPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Quotation | null>(null)
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([])
  const [isItemModal, setItemModal] = useState(false)

  const { data: quotations = [], isLoading } = useCollection<Quotation>(
    'salesOrders',
    [where('type', '==', 'quotation'), orderBy('createdAt', 'desc')],
    ['quotation'],
  )
  const { data: partners = [] } = useCollection<Partner>('partners', [orderBy('name', 'asc')], ['active'])
  const { data: items = [] } = useCollection<Item>('items', [orderBy('name', 'asc')], ['active'])
  const createMutation = useCreateDocument('salesOrders')
  const updateMutation = useUpdateDocument('salesOrders')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<QuotationForm>()

  /** 견적서 인쇄 (새 창에서 A4 양식으로 인쇄/PDF 저장) */
  const handlePrint = useCallback((q: Quotation) => {
    const pw = window.open('', '_blank', 'width=800,height=1000')
    if (!pw) return
    const rows = (q.items ?? []).map((it, i) =>
      `<tr><td class="c">${i+1}</td><td>${it.itemCode}</td><td>${it.itemName}</td><td class="c">${it.unit}</td><td class="r">${it.quantity.toLocaleString()}</td><td class="r">${it.unitPrice.toLocaleString()}</td><td class="r">${it.amount.toLocaleString()}</td></tr>`
    ).join('')
    const supply = q.totalAmount
    const tax = Math.round(supply * 0.1)
    const total = supply + tax
    pw.document.write(`<!DOCTYPE html><html><head><title>견적서 - ${q.quotationNo}</title>
<style>
@page{size:A4;margin:15mm}
body{font-family:'Malgun Gothic',sans-serif;color:#333;padding:20px;margin:0}
h1{text-align:center;font-size:28px;color:#0d9488;letter-spacing:8px;border-bottom:3px double #0d9488;padding-bottom:12px}
.row{display:flex;justify-content:space-between;margin:15px 0}
.box{border:2px solid #0d9488;border-radius:8px;padding:12px;width:48%}
.lb{font-weight:bold;color:#555;width:70px;display:inline-block;font-size:13px}
.vl{font-size:13px}
table.items{width:100%;border-collapse:collapse;margin:15px 0}
table.items th{border:1px solid #0d9488;background:#f0fdfa;padding:8px;font-size:12px;color:#0d9488}
table.items td{border:1px solid #ddd;padding:7px;font-size:12px}
.c{text-align:center}.r{text-align:right}
.sum{display:flex;justify-content:flex-end;margin:10px 0}
.sum td{padding:5px 15px;font-size:13px}
.sum .lb2{font-weight:bold;text-align:right;color:#555}
.gt{font-size:18px;color:#0d9488;font-weight:bold}
.ft{margin-top:40px;display:flex;justify-content:space-between;font-size:12px;color:#666}
.stamp{text-align:center;width:200px;border-top:1px solid #333;margin-top:60px;padding-top:5px}
.co{font-size:11px;color:#666;text-align:center;border-top:1px solid #ddd;padding-top:10px;margin-top:30px}
.note{font-size:12px;color:#666;padding:10px;background:#f9fafb;border-radius:5px;margin:10px 0}
.btns{text-align:center;margin-top:20px}
.btns button{padding:10px 30px;border:none;border-radius:8px;font-size:14px;cursor:pointer;margin:0 5px}
@media print{.btns{display:none!important}}
</style></head><body>
<h1>견 적 서</h1>
<div class="row">
  <div style="width:48%"><p><span class="lb">견적번호</span><span class="vl">${q.quotationNo}</span></p><p><span class="lb">견적일자</span><span class="vl">${q.quotationDate}</span></p><p><span class="lb">유효기한</span><span class="vl">${q.validUntil}</span></p></div>
  <div class="box"><p><span class="lb">거래처</span><span class="vl" style="font-size:16px;font-weight:bold">${q.customerName} 귀하</span></p></div>
</div>
<table class="items"><thead><tr><th style="width:35px">No</th><th style="width:90px">품목코드</th><th>품목명</th><th style="width:45px">단위</th><th style="width:65px">수량</th><th style="width:90px">단가</th><th style="width:100px">금액</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sum"><table><tr><td class="lb2">공급가액</td><td class="r">₩${supply.toLocaleString()}</td></tr><tr><td class="lb2">부가세(10%)</td><td class="r">₩${tax.toLocaleString()}</td></tr><tr style="border-top:2px solid #333"><td class="lb2" style="padding-top:8px">합계금액</td><td class="r gt" style="padding-top:8px">₩${total.toLocaleString()}</td></tr></table></div>
${q.notes ? `<div class="note"><b>비고:</b> ${q.notes}</div>` : ''}
<div class="ft"><div>위와 같이 견적합니다.</div><div class="stamp">(주)새한화장품</div></div>
<div class="co">(주)새한화장품 | Sae Han Cosmetics Co., Ltd.</div>
<div class="btns"><button onclick="window.print()" style="background:#0d9488;color:white">인쇄 / PDF 저장</button><button onclick="window.close()" style="background:#6b7280;color:white">닫기</button></div>
</body></html>`)
    pw.document.close()
  }, [])
  const { register: regItem, handleSubmit: handleItem, reset: resetItem } = useForm<ItemForm>()

  const customerOptions = partners
    .filter((p) => p.type === 'customer' || p.type === 'both')
    .map((p) => ({ value: p.id, label: `[${p.code}] ${p.name}` }))

  const itemOptions = items.map((i) => ({ value: i.id, label: `[${i.code}] ${i.name}` }))

  const openCreate = () => {
    setEditing(null)
    setQuotationItems([])
    reset({ quotationNo: '', customerId: '', quotationDate: '', validUntil: '', status: 'draft', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (q: Quotation) => {
    setEditing(q)
    setQuotationItems(q.items ?? [])
    reset({
      quotationNo: q.quotationNo,
      customerId: q.customerId,
      quotationDate: q.quotationDate,
      validUntil: q.validUntil,
      status: q.status,
      notes: q.notes ?? '',
    })
    setModalOpen(true)
  }

  const onAddItem = (data: ItemForm) => {
    const item = items.find((i) => i.id === data.itemId)
    if (!item) return
    const qty = Number(data.quantity)
    const price = Number(data.unitPrice)
    setQuotationItems((prev) => [
      ...prev,
      {
        itemCode: item.code,
        itemName: item.name,
        unit: item.unit,
        quantity: qty,
        unitPrice: price,
        amount: qty * price,
      },
    ])
    resetItem()
    setItemModal(false)
  }

  const onSave = async (data: QuotationForm) => {
    const partner = partners.find((p) => p.id === data.customerId)
    const totalAmount = quotationItems.reduce((sum, i) => sum + i.amount, 0)
    const payload = {
      type: 'quotation',
      quotationNo: data.quotationNo,
      customerId: data.customerId,
      customerName: partner?.name ?? '',
      quotationDate: data.quotationDate,
      validUntil: data.validUntil,
      status: data.status,
      items: quotationItems,
      totalAmount,
      notes: data.notes || null,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const columns = [
    { key: 'quotationNo', label: '견적번호', width: '130px' },
    { key: 'customerName', label: '거래처' },
    { key: 'quotationDate', label: '견적일', width: '100px' },
    { key: 'validUntil', label: '유효기한', width: '100px' },
    {
      key: 'items',
      label: '품목수',
      width: '70px',
      render: (val: unknown) => (Array.isArray(val) ? `${val.length}건` : '0건'),
    },
    {
      key: 'totalAmount',
      label: '합계금액',
      width: '120px',
      render: (val: unknown) => `₩${formatNumber(val as number)}`,
    },
    {
      key: 'status',
      label: '상태',
      width: '90px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as QuotationStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    {
      key: 'createdAt',
      label: '작성일',
      width: '100px',
      render: (val: unknown) => formatDate(val),
    },
    {
      key: 'actions',
      label: '',
      width: '140px',
      sortable: false,
      render: (_: unknown, row: Quotation) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handlePrint(row) }}>인쇄</Button>
        </div>
      ),
    },
  ]

  const itemColumns = [
    { key: 'itemCode', label: '품목코드', width: '100px' },
    { key: 'itemName', label: '품목명' },
    { key: 'quantity', label: '수량', width: '80px' },
    { key: 'unit', label: '단위', width: '50px' },
    { key: 'unitPrice', label: '단가', width: '100px', render: (val: unknown) => `₩${formatNumber(val as number)}` },
    { key: 'amount', label: '금액', width: '120px', render: (val: unknown) => `₩${formatNumber(val as number)}` },
    {
      key: 'actions',
      label: '',
      width: '60px',
      sortable: false,
      render: (_: unknown, row: QuotationItem) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setQuotationItems((p) => p.filter((i) => i.itemCode !== row.itemCode))}
        >
          삭제
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">견적관리</h1>
        <Button onClick={openCreate}>견적서 작성</Button>
      </div>
      <Card>
        <Table columns={columns} data={quotations} loading={isLoading} />
      </Card>

      {/* 견적서 작성/수정 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '견적서 수정' : '견적서 작성'} size="xl">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="견적번호 *" error={errors.quotationNo?.message} {...register('quotationNo', { required: '필수' })} />
            <Select label="거래처 *" options={customerOptions} placeholder="거래처 선택" error={errors.customerId?.message} {...register('customerId', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="견적일 *" type="date" {...register('quotationDate', { required: '필수' })} />
            <Input label="유효기한 *" type="date" {...register('validUntil', { required: '필수' })} />
            <Select label="상태" options={Object.entries(STATUS_BADGE).map(([v, i]) => ({ value: v, label: i.label }))} {...register('status')} />
          </div>
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">견적 품목</h4>
              <Button size="sm" type="button" onClick={() => { resetItem(); setItemModal(true) }}>품목 추가</Button>
            </div>
            <Table columns={itemColumns} data={quotationItems} keyField="itemCode" emptyMessage="품목을 추가하세요." />
            {quotationItems.length > 0 && (
              <div className="mt-2 text-right text-sm font-semibold">
                합계: ₩{formatNumber(quotationItems.reduce((s, i) => s + i.amount, 0))}
              </div>
            )}
          </div>
          <Input label="비고" {...register('notes')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? '수정' : '작성'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 품목 추가 모달 */}
      <Modal isOpen={isItemModal} onClose={() => setItemModal(false)} title="품목 추가">
        <form onSubmit={handleItem(onAddItem)} className="space-y-4">
          <Select label="품목 *" options={itemOptions} placeholder="품목 선택" {...regItem('itemId', { required: true })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="수량 *" type="number" step="0.01" {...regItem('quantity', { required: true })} />
            <Input label="단가 (원) *" type="number" {...regItem('unitPrice', { required: true })} />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setItemModal(false)}>취소</Button>
            <Button type="submit">추가</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
