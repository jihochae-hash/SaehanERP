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

const PAGE_SIZE = 50

export default function ItemListPage() {
  const [search, setSearch] = useState('')
  const [newItemAbr, setNewItemAbr] = useState('')
  const [newItemType, setNewItemType] = useState<ItemType>('raw_material')
  const [page, setPage] = useState(0)
  // 변경사항 버퍼: docId → { field → value }
  const [pendingChanges, setPendingChanges] = useState<Map<string, Record<string, unknown>>>(new Map())
  const [saving, setSaving] = useState(false)
  const isCeo = useAuthStore((s) => s.isCeo())

  const { data: items = [] } = useCollection<Item>('items', [orderBy('code', 'asc')], ['all'])
  const createMutation = useCreateDocument('items')
  const updateMutation = useUpdateDocument('items')
  const deleteMutation = useDeleteDocument('items')

  const existingCodes = items.map((i) => i.code)

  // 검색 필터
  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      (item.customerAbbr?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (item.customerName?.toLowerCase().includes(search.toLowerCase()) ?? false),
  )

  // 페이지네이션
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // 변경사항이 반영된 데이터 (화면 표시용)
  const displayData = paged.map((item) => {
    const changes = pendingChanges.get(item.id)
    if (!changes) return item
    return { ...item, ...changes } as Item
  })

  const hasChanges = pendingChanges.size > 0

  /** 셀 변경 → 버퍼에 저장 (DB 저장 안 함) */
  const handleChange = useCallback((rowIndex: number, key: string, value: unknown) => {
    const item = paged[rowIndex]
    if (!item) return

    // 코드 변경 시 검증
    if (key === 'code') {
      const newCode = String(value).toUpperCase()
      const validation = validateItemCode(newCode)
      if (!validation.valid) { alert(validation.message); return }
      if (isDuplicateCode(newCode, existingCodes, item.code)) { alert('이미 사용중인 품목코드입니다.'); return }
      value = newCode
    }

    setPendingChanges((prev) => {
      const next = new Map(prev)
      const existing = next.get(item.id) ?? {}
      next.set(item.id, { ...existing, [key]: value })

      // type 변경 시 코드 첫자리도 변경
      if (key === 'type') {
        const currentCode = (existing.code as string) ?? item.code
        if (currentCode) {
          const newPrefix = getCodePrefix(value as ItemType)
          const updatedCode = newPrefix + currentCode.slice(1)
          next.set(item.id, { ...existing, [key]: value, code: updatedCode })
        }
      }
      return next
    })
  }, [paged, existingCodes])

  /** 저장 버튼: 모든 변경사항 일괄 저장 */
  const handleSave = async () => {
    if (pendingChanges.size === 0) return
    setSaving(true)
    try {
      const promises = Array.from(pendingChanges.entries()).map(([docId, changes]) =>
        updateMutation.mutateAsync({ docId, data: changes })
      )
      await Promise.all(promises)
      setPendingChanges(new Map())
    } catch {
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  /** 변경사항 취소 */
  const handleCancel = () => setPendingChanges(new Map())

  /** 새 품목 추가 */
  const handleAdd = async () => {
    const abbr = newItemAbr.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
    if (abbr.length < 3) { alert('고객사 약칭을 3자리 알파벳으로 입력하세요.'); return }
    const code = generateNextCode(existingCodes, newItemType, abbr)
    await createMutation.mutateAsync({
      code, name: '', type: newItemType, unit: 'kg', customerAbbr: abbr,
      requiresLotTracking: true, isActive: true,
    })
    setNewItemAbr('')
  }

  const handleDelete = async (rowIndex: number) => {
    const item = paged[rowIndex]
    if (!item) return
    if (!isCeo) { alert('CEO만 삭제할 수 있습니다.'); return }
    if (!confirm(`"${item.code} ${item.name}" 품목을 삭제하시겠습니까?`)) return
    await deleteMutation.mutateAsync(item.id)
  }

  const columns = [
    {
      key: 'code', label: '품목코드', width: '140px',
      render: (val: unknown) => <span className="font-mono text-xs">{String(val)}</span>,
    },
    { key: 'name', label: '품목명' },
    {
      key: 'type', label: '유형', width: '90px', type: 'select' as const, options: ITEM_TYPE_OPTIONS,
      render: (val: unknown) => <Badge color="gray">{String(ITEM_TYPE_LABEL[val as ItemType] ?? val)}</Badge>,
    },
    { key: 'unit', label: '단위', width: '70px', type: 'select' as const, options: UNIT_OPTIONS },
    { key: 'specification', label: '규격', width: '120px' },
    { key: 'customerAbbr', label: '고객약칭', width: '80px' },
    { key: 'customerName', label: '고객사명', width: '100px' },
    { key: 'procurementType', label: '조달', width: '70px', type: 'select' as const, options: PROCUREMENT_OPTIONS },
    { key: 'subCode', label: 'Sub', width: '50px' },
    { key: 'unitQuantity', label: '단위수량', width: '75px', type: 'number' as const },
    { key: 'safetyStock', label: '안전재고', width: '75px', type: 'number' as const },
    { key: 'requiresLotTracking', label: 'LOT', width: '45px', type: 'checkbox' as const },
    { key: 'isActive', label: '활성', width: '45px', type: 'checkbox' as const },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">품목관리</h1>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-orange-600 font-medium">{pendingChanges.size}건 변경됨</span>
            <Button variant="secondary" onClick={handleCancel}>취소</Button>
            <Button onClick={handleSave} loading={saving}>저장</Button>
          </div>
        )}
      </div>

      {/* 새 품목 추가 */}
      <Card className="mb-4">
        <div className="flex items-end gap-3">
          <div className="w-32">
            <label className="block text-xs font-medium text-gray-600 mb-1">품목유형</label>
            <select value={newItemType} onChange={(e) => setNewItemType(e.target.value as ItemType)} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg">
              {ITEM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium text-gray-600 mb-1">고객사 약칭</label>
            <input value={newItemAbr} onChange={(e) => setNewItemAbr(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))} placeholder="ABC" maxLength={3} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg uppercase" />
          </div>
          <Button onClick={handleAdd} loading={createMutation.isPending}>품목 추가</Button>
          <div className="flex-1" />
          <p className="text-xs text-gray-400">셀 클릭 편집 → 저장 버튼으로 일괄 저장</p>
        </div>
      </Card>

      {/* 테이블 */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <Input placeholder="품목코드, 품목명, 고객약칭, 고객사명 검색..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} className="max-w-sm" />
          <span className="text-xs text-gray-500">
            {filtered.length}건 중 {page * PAGE_SIZE + 1}~{Math.min((page + 1) * PAGE_SIZE, filtered.length)}
          </span>
        </div>
        <EditableTable columns={columns} data={displayData} onChange={handleChange} onDelete={isCeo ? handleDelete : undefined} />
        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button>
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
              const p = totalPages <= 10 ? i : Math.max(0, Math.min(page - 4, totalPages - 10)) + i
              return (
                <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 text-sm rounded ${p === page ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {p + 1}
                </button>
              )
            })}
            <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>다음</Button>
          </div>
        )}
      </Card>
    </div>
  )
}
