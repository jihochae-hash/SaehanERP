import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { Button, Card, Input, Select } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import type { Item, Warehouse } from '@/types'

const OUTGOING_TYPE_OPTIONS = [
  { value: 'sales', label: '판매출고' },
  { value: 'production', label: '생산출고' },
  { value: 'disposal', label: '폐기' },
  { value: 'sample', label: '샘플' },
  { value: 'other', label: '기타출고' },
]

interface OutgoingForm {
  itemId: string
  warehouseId: string
  quantity: string
  outgoingType: string
  lotNo: string
  notes: string
}

export default function OutgoingPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const queryClient = useQueryClient()

  const { data: items = [] } = useCollection<Item>('items', [orderBy('name', 'asc')], ['active'])
  const { data: warehouses = [] } = useCollection<Warehouse>('warehouses', [orderBy('name', 'asc')], ['active'])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OutgoingForm>()

  const itemOptions = items.map((i) => ({ value: i.id, label: `[${i.code}] ${i.name}` }))
  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: `[${w.code}] ${w.name}` }))

  const onSubmit = async (data: OutgoingForm) => {
    setLoading(true)
    setResult(null)
    try {
      const processInventoryTx = httpsCallable(functions, 'processInventoryTx')
      await processInventoryTx({
        type: 'outgoing',
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        quantity: Number(data.quantity),
        outgoingType: data.outgoingType,
        lotNo: data.lotNo || undefined,
        notes: data.notes || undefined,
      })
      setResult({ success: true, message: '출고 처리가 완료되었습니다.' })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['inventoryTransactions'] })
      reset()
    } catch (err: unknown) {
      const message = (err as { message?: string }).message ?? '출고 처리에 실패했습니다.'
      setResult({ success: false, message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">출고처리</h1>

      <Card title="출고 정보 입력">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="품목 *"
              options={itemOptions}
              placeholder="품목을 선택하세요"
              error={errors.itemId?.message}
              {...register('itemId', { required: '품목을 선택하세요' })}
            />
            <Select
              label="출고창고 *"
              options={warehouseOptions}
              placeholder="창고를 선택하세요"
              error={errors.warehouseId?.message}
              {...register('warehouseId', { required: '창고를 선택하세요' })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="수량 *"
              type="number"
              step="0.01"
              error={errors.quantity?.message}
              {...register('quantity', { required: '수량을 입력하세요', min: { value: 0.01, message: '0보다 커야 합니다' } })}
            />
            <Select
              label="출고유형 *"
              options={OUTGOING_TYPE_OPTIONS}
              {...register('outgoingType', { required: '유형을 선택하세요' })}
            />
            <Input label="LOT번호" placeholder="출고할 LOT 선택" {...register('lotNo')} />
          </div>
          <Input label="비고" {...register('notes')} />

          {result && (
            <div className={`px-4 py-3 rounded-lg text-sm ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {result.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => { reset(); setResult(null) }}>초기화</Button>
            <Button type="submit" loading={loading}>출고 처리</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
