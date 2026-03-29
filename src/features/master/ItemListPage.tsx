import { useState, useCallback } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Input, Badge, EditableTable } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument, useDeleteDocument } from '@/hooks/useFirestore'
import { useAuthStore } from '@/stores/auth'
import type { Item, ItemType } from '@/types'
import { ITEM_TYPE_LABEL } from '@/types/master'
import { validateItemCode, isDuplicateCode, generateNextCode, getCodePrefix } from '@/utils/itemCode'

const ITEM_TYPE_OPTIONS = Object.entries(ITEM_TYPE_LABEL).map(([value, label]) => ({ value, label }))

const UNIT_OPTIONS = [
  { value: 'kg', label: 'kg' }, { value: 'g', label: 'g' },
  { value: 'L', label: 'L' }, { value: 'mL', label: 'mL' },
  { value: 'ea', label: 'EA' }, { value: 'box', label: 'box' },
  { value: 'set', label: 'set' }, { value: 'pack', label: 'pack' },
]

const PROCUREMENT_OPTIONS = [
  { value: 'production', label: '생산' },
  { value: 'purchase', label: '구매' },
  { value: 'supplied', label: '사급' },
  { value: 'development', label: '개발' },
]

export default function ItemListPage() {
  const [search, setSearch] = useState('')
  const [newItemAbr, setNewItemAbr] = useState('')
  const [newItemType, setNewItemType] = useState<ItemType>('raw_material')
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const isCeo = useAuthStore((s) => s.isCeo())

  const { data: items = [], isLoading } = useCollection<Item>('items', [orderBy('code', 'asc')], ['all'])
  const createMutation = useCreateDocument('items')
  const updateMutation = useUpdateDocument('items')
  const deleteMutation = useDeleteDocument('items')

  const existingCodes = items.map((i) => i.code)

  const filtered = items.filter(
    (item) =>
      item.name.includes(search) ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      (item.barcode?.includes(search) ?? false),
  )

  /** 셀 변경 → 즉시 저장 */
  const handleChange = useCallback(async (rowIndex: number, key: string, value: unknown) => {
    const item = filtered[rowIndex]
    if (!item) return

    // 코드 변경 시 검증
    if (key === 'code') {
      const newCode = String(value).toUpperCase()
      const validation = validateItemCode(newCode)
      if (!validation.valid) {
        alert(validation.message)
        return
      }
      if (isDuplicateCode(newCode, existingCodes, item.code)) {
        alert('이미 사용중인 품목코드입니다.')
        return
      }
      value = newCode
    }

    // type 변경 시 코드 첫자리도 자동 변경
    if (key === 'type') {
      const newPrefix = getCodePrefix(value as ItemType)
      const currentCode = item.code
      if (currentCode && currentCode.length >= 1) {
        const updatedCode = newPrefix + currentCode.slice(1)
        if (isDuplicateCode(updatedCode, existingCodes, item.code)) {
          alert('코드 변경 시 중복이 발생합니다.')
          return
        }
        setSaving((prev) => new Set(prev).add(item.id))
        await updateMutation.mutateAsync({ docId: item.id, data: { [key]: value, code: updatedCode } })
        setSaving((prev) => { const next = new Set(prev); next.delete(item.id); return next })
        return
      }
    }

    setSaving((prev) => new Set(prev).add(item.id))
    await updateMutation.mutateAsync({ docId: item.id, data: { [key]: value } })
    setSaving((prev) => { const next = new Set(prev); next.delete(item.id); return next })
  }, [filtered, existingCodes, updateMutation])

  /** 새 품목 추가 */
  const handleAdd = async () => {
    const abbr = newItemAbr.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
    if (abbr.length < 3) {
      alert('고객사 약칭을 3자리 알파벳으로 입력하세요.')
      return
    }
    const code = generateNextCode(existingCodes, newItemType, abbr)
    await createMutation.mutateAsync({
      code,
      name: '',
      type: newItemType,
      unit: 'kg',
      customerAbbr: abbr,
      requiresLotTracking: true,
      isActive: true,
    })
    setNewItemAbr('')
  }

  /** 삭제 */
  const handleDelete = async (rowIndex: number) => {
    const item = filtered[rowIndex]
    if (!item) return
    if (!isCeo) { alert('CEO만 삭제할 수 있습니다.'); return }
    if (!confirm(`"${item.code} ${item.name}" 품목을 삭제하시겠습니까?`)) return
    await deleteMutation.mutateAsync(item.id)
  }

  const columns = [
    {
      key: 'code', label: '품목코드', width: '140px',
      render: (val: unknown, row: Item) => (
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs">{String(val)}</span>
          {saving.has(row.id) && <span className="text-teal-500 text-xs">저장중...</span>}
        </div>
      ),
    },
    { key: 'name', label: '품목명' },
    {
      key: 'type', label: '유형', width: '100px', type: 'select' as const,
      options: ITEM_TYPE_OPTIONS,
      render: (val: unknown) => {
        const label = ITEM_TYPE_LABEL[val as ItemType] ?? val
        return <Badge color="gray">{String(label)}</Badge>
      },
    },
    { key: 'unit', label: '단위', width: '70px', type: 'select' as const, options: UNIT_OPTIONS },
    { key: 'specification', label: '규격', width: '120px' },
    { key: 'customerAbbr', label: '고객약칭', width: '80px' },
    { key: 'customerName', label: '고객사명', width: '100px' },
    { key: 'procurementType', label: '조달구분', width: '80px', type: 'select' as const, options: PROCUREMENT_OPTIONS },
    { key: 'formType', label: '제형', width: '70px' },
    { key: 'formTypeName', label: '제형명', width: '100px' },
    { key: 'rawMaterialSub', label: '원재료Sub', width: '80px' },
    { key: 'subMaterialType', label: '부자재유형', width: '90px' },
    { key: 'subMaterialTypeName', label: '부자재유형명', width: '100px' },
    { key: 'isBaseBulk', label: 'Base벌크', width: '70px', type: 'checkbox' as const },
    { key: 'subCode', label: 'Sub', width: '50px' },
    { key: 'unitQuantity', label: '단위수량', width: '80px', type: 'number' as const },
    { key: 'safetyStock', label: '안전재고', width: '80px', type: 'number' as const },
    { key: 'requiresLotTracking', label: 'LOT', width: '50px', type: 'checkbox' as const },
    { key: 'isActive', label: '활성', width: '50px', type: 'checkbox' as const },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">품목관리</h1>
      </div>

      {/* 새 품목 추가 바 */}
      <Card className="mb-4">
        <div className="flex items-end gap-3">
          <div className="w-32">
            <label className="block text-xs font-medium text-gray-600 mb-1">품목유형</label>
            <select
              value={newItemType}
              onChange={(e) => setNewItemType(e.target.value as ItemType)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
            >
              {ITEM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium text-gray-600 mb-1">고객사 약칭 (3자리)</label>
            <input
              value={newItemAbr}
              onChange={(e) => setNewItemAbr(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
              placeholder="예: ABC"
              maxLength={3}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg uppercase"
            />
          </div>
          <Button onClick={handleAdd} loading={createMutation.isPending}>품목 추가</Button>
          <div className="flex-1" />
          <p className="text-xs text-gray-400">코드 형식: ABBB-CCCCCD · 셀을 클릭하여 직접 편집 · Tab/Enter로 이동</p>
        </div>
      </Card>

      {/* 스프레드시트 편집 테이블 */}
      <Card>
        <div className="mb-3">
          <Input placeholder="품목코드, 품목명, 바코드 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <EditableTable
          columns={columns}
          data={filtered}
          onChange={handleChange}
          onDelete={isCeo ? handleDelete : undefined}
          emptyMessage="등록된 품목이 없습니다."
        />
        {!isLoading && filtered.length > 0 && (
          <div className="mt-3 text-sm text-gray-500 text-right">총 {filtered.length}건</div>
        )}
      </Card>
    </div>
  )
}
