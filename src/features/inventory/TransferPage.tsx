import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'
import type { WarehouseTransfer, TransferStatus, TransferItem, Warehouse, Inventory } from '@/types'
import { useAuthStore } from '@/stores/auth'

const STATUS_BADGE: Record<TransferStatus, { label: string; color: 'yellow' | 'green' | 'red' }> = {
  in_transit: { label: '이동중', color: 'yellow' },
  completed: { label: '이동완료', color: 'green' },
  cancelled: { label: '취소', color: 'red' },
}

interface TransferForm {
  transferNo: string
  fromWarehouseId: string
  toWarehouseId: string
  notes: string
}

export default function TransferPage() {
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [isReceiveOpen, setReceiveOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<WarehouseTransfer | null>(null)
  const [transferItems, setTransferItems] = useState<TransferItem[]>([])
  const [scanInput, setScanInput] = useState('')
  const [receiveLocations, setReceiveLocations] = useState<Record<string, string>>({})
  const user = useAuthStore((s) => s.user)

  const { data: transfers = [], isLoading } = useCollection<WarehouseTransfer>('warehouseTransfers', [orderBy('createdAt', 'desc')], ['all'])
  const { data: warehouses = [] } = useCollection<Warehouse>('warehouses', [orderBy('name', 'asc')], ['active'])
  const { data: stocks = [] } = useCollection<Inventory>('inventory', [orderBy('itemCode', 'asc')], ['all'])
  const createMutation = useCreateDocument('warehouseTransfers')
  const updateMutation = useUpdateDocument('warehouseTransfers')

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<TransferForm>()
  const watchFromWarehouse = watch('fromWarehouseId')

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: `[${w.code}] ${w.name}` }))

  // 선택한 출발 창고의 재고 목록
  const fromStocks = watchFromWarehouse ? stocks.filter((s) => s.warehouseId === watchFromWarehouse && s.quantity > 0) : []

  /** 바코드 스캔 또는 품목코드 입력으로 이동 품목 추가 */
  const handleScan = () => {
    const input = scanInput.trim()
    if (!input) return

    // 바코드 또는 품목코드로 재고 검색
    const stock = fromStocks.find(
      (s) => s.barcode === input || s.itemCode === input || s.lotNo === input,
    )
    if (!stock) {
      alert('해당 바코드/품목코드의 재고를 찾을 수 없습니다.')
      setScanInput('')
      return
    }

    // 이미 추가된 품목인지 확인
    if (transferItems.some((t) => t.itemId === stock.itemId && t.lotNo === stock.lotNo)) {
      alert('이미 추가된 품목입니다.')
      setScanInput('')
      return
    }

    setTransferItems((prev) => [...prev, {
      itemId: stock.itemId,
      itemCode: stock.itemCode,
      itemName: stock.itemName,
      lotNo: stock.lotNo,
      quantity: stock.quantity,
      unit: stock.unit,
      scannedOut: true,
      scannedIn: false,
      fromLocation: stock.location,
    }])
    setScanInput('')
  }

  /** 창고이동 생성 (출고) */
  const onCreateTransfer = async (data: TransferForm) => {
    if (transferItems.length === 0) {
      alert('이동할 품목을 추가하세요.')
      return
    }
    if (data.fromWarehouseId === data.toWarehouseId) {
      alert('출발 창고와 도착 창고가 같습니다.')
      return
    }
    const fromWh = warehouses.find((w) => w.id === data.fromWarehouseId)
    const toWh = warehouses.find((w) => w.id === data.toWarehouseId)

    await createMutation.mutateAsync({
      transferNo: data.transferNo,
      status: 'in_transit',
      fromWarehouseId: data.fromWarehouseId,
      fromWarehouseName: fromWh?.name ?? '',
      toWarehouseId: data.toWarehouseId,
      toWarehouseName: toWh?.name ?? '',
      items: transferItems,
      shippedAt: new Date().toISOString(),
      shippedBy: user?.displayName ?? '',
      notes: data.notes || null,
    })
    setCreateOpen(false)
    setTransferItems([])
  }

  /** 입고확인 모달 열기 */
  const openReceive = (transfer: WarehouseTransfer) => {
    setSelectedTransfer(transfer)
    setReceiveLocations({})
    setReceiveOpen(true)
  }

  /** 입고확인 처리 */
  const handleReceive = async () => {
    if (!selectedTransfer) return

    // 모든 품목에 도착 위치가 지정되었는지 확인
    const allLocated = selectedTransfer.items.every((item) => receiveLocations[`${item.itemId}_${item.lotNo}`])
    if (!allLocated) {
      alert('모든 품목의 도착 위치를 입력하세요.')
      return
    }

    const updatedItems = selectedTransfer.items.map((item) => ({
      ...item,
      scannedIn: true,
      toLocation: receiveLocations[`${item.itemId}_${item.lotNo}`],
    }))

    await updateMutation.mutateAsync({
      docId: selectedTransfer.id,
      data: {
        status: 'completed',
        items: updatedItems,
        receivedAt: new Date().toISOString(),
        receivedBy: user?.displayName ?? '',
      },
    })
    setReceiveOpen(false)
  }

  const inTransitCount = transfers.filter((t) => t.status === 'in_transit').length

  const columns = [
    { key: 'transferNo', label: '이동번호', width: '130px' },
    {
      key: 'status', label: '상태', width: '90px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as TransferStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'fromWarehouseName', label: '출발창고', width: '120px' },
    { key: 'toWarehouseName', label: '도착창고', width: '120px' },
    {
      key: 'items', label: '품목수', width: '70px',
      render: (val: unknown) => Array.isArray(val) ? `${val.length}건` : '0건',
    },
    { key: 'shippedBy', label: '출고자', width: '80px' },
    { key: 'shippedAt', label: '출고일시', width: '110px', render: (val: unknown) => formatDate(val) },
    {
      key: 'receivedAt', label: '입고확인', width: '110px',
      render: (val: unknown) => val ? formatDate(val) : <span className="text-yellow-600 font-medium">미확인</span>,
    },
    {
      key: 'actions', label: '', width: '100px', sortable: false,
      render: (_: unknown, row: WarehouseTransfer) => (
        row.status === 'in_transit' ? (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); openReceive(row) }}>입고확인</Button>
        ) : null
      ),
    },
  ]

  const transferItemColumns = [
    { key: 'itemCode', label: '품목코드', width: '100px' },
    { key: 'itemName', label: '품목명' },
    { key: 'lotNo', label: 'LOT번호', width: '140px' },
    { key: 'quantity', label: '수량', width: '80px' },
    { key: 'unit', label: '단위', width: '50px' },
    { key: 'fromLocation', label: '출발위치', width: '100px' },
    {
      key: 'scannedOut', label: '스캔', width: '60px',
      render: (val: unknown) => val ? <Badge color="green">완료</Badge> : <Badge color="gray">대기</Badge>,
    },
    {
      key: 'actions', label: '', width: '60px', sortable: false,
      render: (_: unknown, row: TransferItem) => (
        <Button size="sm" variant="ghost" onClick={() => setTransferItems((p) => p.filter((i) => !(i.itemId === row.itemId && i.lotNo === row.lotNo)))}>삭제</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">창고이동</h1>
          {inTransitCount > 0 && (
            <Badge color="yellow">{inTransitCount}건 이동중</Badge>
          )}
        </div>
        <Button onClick={() => { reset({ transferNo: '', fromWarehouseId: '', toWarehouseId: '', notes: '' }); setTransferItems([]); setCreateOpen(true) }}>
          이동 출고
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={transfers} loading={isLoading} />
      </Card>

      {/* 이동 출고 모달 */}
      <Modal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} title="창고이동 — 출고" size="xl">
        <form onSubmit={handleSubmit(onCreateTransfer)} className="space-y-4">
          <Input label="이동번호 *" error={errors.transferNo?.message} {...register('transferNo', { required: '필수' })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="출발 창고 *" options={warehouseOptions} placeholder="출발 창고 선택" error={errors.fromWarehouseId?.message} {...register('fromWarehouseId', { required: '필수' })} />
            <Select label="도착 창고 *" options={warehouseOptions} placeholder="도착 창고 선택" error={errors.toWarehouseId?.message} {...register('toWarehouseId', { required: '필수' })} />
          </div>

          {/* 바코드 스캔 영역 */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">품목 스캔 (바코드/품목코드/LOT번호)</h4>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="바코드를 스캔하거나 품목코드 입력..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan() } }}
                />
              </div>
              <Button type="button" onClick={handleScan}>추가</Button>
            </div>
            {watchFromWarehouse && fromStocks.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">선택한 창고에 재고가 없습니다.</p>
            )}
          </div>

          {/* 이동 품목 목록 */}
          <Table columns={transferItemColumns} data={transferItems} keyField="lotNo" emptyMessage="바코드를 스캔하여 품목을 추가하세요." />

          <Input label="비고" {...register('notes')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending}>이동 출고</Button>
          </div>
        </form>
      </Modal>

      {/* 입고확인 모달 */}
      <Modal isOpen={isReceiveOpen} onClose={() => setReceiveOpen(false)} title={`입고확인 — ${selectedTransfer?.transferNo ?? ''}`} size="lg">
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm">
            <p className="font-semibold text-yellow-800">이동중인 품목</p>
            <p className="text-yellow-700">
              {selectedTransfer?.fromWarehouseName} → {selectedTransfer?.toWarehouseName}
            </p>
          </div>

          <div className="space-y-3">
            {selectedTransfer?.items.map((item) => {
              const key = `${item.itemId}_${item.lotNo}`
              return (
                <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium">[{item.itemCode}] {item.itemName}</p>
                    <p className="text-xs text-gray-500">LOT: {item.lotNo} · {item.quantity} {item.unit}</p>
                  </div>
                  <div className="w-40">
                    <Input
                      placeholder="도착 위치"
                      value={receiveLocations[key] ?? ''}
                      onChange={(e) => setReceiveLocations((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setReceiveOpen(false)}>취소</Button>
            <Button onClick={handleReceive} loading={updateMutation.isPending}>입고 확인</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
