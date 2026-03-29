import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'

// --- 인라인 타입 ---

type ShipmentStatus = 'preparing' | 'shipped' | 'delivered'

interface ShipmentItem {
  itemCode: string
  itemName: string
  lotNo: string
  quantity: number
}

interface Shipment {
  id: string
  shipmentNo: string
  salesOrderNo: string
  customerName: string
  customerId: string
  shipmentDate: string
  items: ShipmentItem[]
  status: ShipmentStatus
  trackingNo: string | null
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

const STATUS_BADGE: Record<ShipmentStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' | 'purple' }> = {
  preparing: { label: '준비중', color: 'yellow' },
  shipped: { label: '출하완료', color: 'blue' },
  delivered: { label: '배송완료', color: 'green' },
}

interface ShipmentForm {
  shipmentNo: string
  salesOrderNo: string
  customerId: string
  shipmentDate: string
  status: ShipmentStatus
  trackingNo: string
  notes: string
}

interface ItemForm {
  itemId: string
  lotNo: string
  quantity: string
}

export default function ShipmentPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Shipment | null>(null)
  const [shipmentItems, setShipmentItems] = useState<ShipmentItem[]>([])
  const [isItemModal, setItemModal] = useState(false)

  const { data: shipments = [], isLoading } = useCollection<Shipment>(
    'salesShipments',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const { data: partners = [] } = useCollection<Partner>('partners', [orderBy('name', 'asc')], ['active'])
  const { data: items = [] } = useCollection<Item>('items', [orderBy('name', 'asc')], ['active'])
  const createMutation = useCreateDocument('salesShipments')
  const updateMutation = useUpdateDocument('salesShipments')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ShipmentForm>()
  const { register: regItem, handleSubmit: handleItem, reset: resetItem } = useForm<ItemForm>()

  const customerOptions = partners
    .filter((p) => p.type === 'customer' || p.type === 'both')
    .map((p) => ({ value: p.id, label: `[${p.code}] ${p.name}` }))

  const itemOptions = items.map((i) => ({ value: i.id, label: `[${i.code}] ${i.name}` }))

  const openCreate = () => {
    setEditing(null)
    setShipmentItems([])
    reset({ shipmentNo: '', salesOrderNo: '', customerId: '', shipmentDate: '', status: 'preparing', trackingNo: '', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (s: Shipment) => {
    setEditing(s)
    setShipmentItems(s.items ?? [])
    reset({
      shipmentNo: s.shipmentNo,
      salesOrderNo: s.salesOrderNo,
      customerId: s.customerId,
      shipmentDate: s.shipmentDate,
      status: s.status,
      trackingNo: s.trackingNo ?? '',
      notes: s.notes ?? '',
    })
    setModalOpen(true)
  }

  const onAddItem = (data: ItemForm) => {
    const item = items.find((i) => i.id === data.itemId)
    if (!item) return
    setShipmentItems((prev) => [
      ...prev,
      {
        itemCode: item.code,
        itemName: item.name,
        lotNo: data.lotNo,
        quantity: Number(data.quantity),
      },
    ])
    resetItem()
    setItemModal(false)
  }

  const onSave = async (data: ShipmentForm) => {
    const partner = partners.find((p) => p.id === data.customerId)
    const payload = {
      shipmentNo: data.shipmentNo,
      salesOrderNo: data.salesOrderNo,
      customerId: data.customerId,
      customerName: partner?.name ?? '',
      shipmentDate: data.shipmentDate,
      items: shipmentItems,
      status: data.status,
      trackingNo: data.trackingNo || null,
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
    { key: 'shipmentNo', label: '출하번호', width: '130px' },
    { key: 'salesOrderNo', label: '수주번호', width: '130px' },
    { key: 'customerName', label: '거래처' },
    { key: 'shipmentDate', label: '출하일', width: '100px' },
    {
      key: 'items',
      label: '품목수',
      width: '70px',
      render: (val: unknown) => (Array.isArray(val) ? `${val.length}건` : '0건'),
    },
    { key: 'trackingNo', label: '운송장번호', width: '130px' },
    {
      key: 'status',
      label: '상태',
      width: '90px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as ShipmentStatus]
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
      width: '80px',
      sortable: false,
      render: (_: unknown, row: Shipment) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>
          수정
        </Button>
      ),
    },
  ]

  const itemColumns = [
    { key: 'itemCode', label: '품목코드', width: '100px' },
    { key: 'itemName', label: '품목명' },
    { key: 'lotNo', label: 'LOT번호', width: '130px' },
    { key: 'quantity', label: '수량', width: '80px', render: (val: unknown) => formatNumber(val as number) },
    {
      key: 'actions',
      label: '',
      width: '60px',
      sortable: false,
      render: (_: unknown, row: ShipmentItem) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShipmentItems((p) => p.filter((i) => !(i.itemCode === row.itemCode && i.lotNo === row.lotNo)))}
        >
          삭제
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">출하관리</h1>
        <Button onClick={openCreate}>출하 등록</Button>
      </div>
      <Card>
        <Table columns={columns} data={shipments} loading={isLoading} />
      </Card>

      {/* 출하 등록/수정 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '출하 수정' : '출하 등록'} size="xl">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="출하번호 *" error={errors.shipmentNo?.message} {...register('shipmentNo', { required: '필수' })} />
            <Input label="수주번호" {...register('salesOrderNo')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="거래처 *" options={customerOptions} placeholder="거래처 선택" error={errors.customerId?.message} {...register('customerId', { required: '필수' })} />
            <Input label="출하일 *" type="date" {...register('shipmentDate', { required: '필수' })} />
            <Select label="상태" options={Object.entries(STATUS_BADGE).map(([v, i]) => ({ value: v, label: i.label }))} {...register('status')} />
          </div>
          <Input label="운송장번호" {...register('trackingNo')} />
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">출하 품목</h4>
              <Button size="sm" type="button" onClick={() => { resetItem(); setItemModal(true) }}>품목 추가</Button>
            </div>
            <Table columns={itemColumns} data={shipmentItems} keyField="itemCode" emptyMessage="품목을 추가하세요." />
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

      {/* 품목 추가 모달 */}
      <Modal isOpen={isItemModal} onClose={() => setItemModal(false)} title="품목 추가">
        <form onSubmit={handleItem(onAddItem)} className="space-y-4">
          <Select label="품목 *" options={itemOptions} placeholder="품목 선택" {...regItem('itemId', { required: true })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="LOT번호 *" {...regItem('lotNo', { required: true })} />
            <Input label="수량 *" type="number" step="0.01" {...regItem('quantity', { required: true })} />
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
