import { useState, useCallback } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Input, Badge, EditableTable, Modal } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument, useDeleteDocument } from '@/hooks/useFirestore'
import { getAllDocuments, orderBy as fsOrderBy } from '@/services/firestore.service'
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

interface NewItemRow {
  id: string
  type: ItemType
  customerAbbr: string
  name: string
  unit: string
  specification: string
  procurementType: string
  requiresLotTracking: boolean
}

export default function ItemListPage() {
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [page, setPage] = useState(0)
  const [isAddModalOpen, setAddModalOpen] = useState(false)
  const [newRows, setNewRows] = useState<NewItemRow[]>([])
  const [addSaving, setAddSaving] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<Map<string, Record<string, unknown>>>(new Map())
  const [saving, setSaving] = useState(false)
  const isCeo = useAuthStore((s) => s.isCeo())

  // 검색어가 있으면 전체 로드, 없으면 200건만
  const maxDocs = activeSearch ? 0 : 200
  const { data: items = [] } = useCollection<Item>('items', [orderBy('code', 'asc')], ['all', activeSearch], maxDocs)
  const createMutation = useCreateDocument('items')
  const updateMutation = useUpdateDocument('items')
  const deleteMutation = useDeleteDocument('items')

  const existingCodes = items.map((i) => i.code)

  const handleSearch = () => {
    setActiveSearch(search.trim())
    setPage(0)
  }

  // 검색 필터 (검색어가 있을 때만 필터링)
  const filtered = activeSearch
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
          item.code.toLowerCase().includes(activeSearch.toLowerCase()) ||
          (item.customerAbbr?.toLowerCase().includes(activeSearch.toLowerCase()) ?? false) ||
          (item.customerName?.toLowerCase().includes(activeSearch.toLowerCase()) ?? false),
      )
    : items

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

  /** 모달에 빈 행 추가 */
  const addNewRow = () => {
    setNewRows((prev) => [...prev, {
      id: crypto.randomUUID(),
      type: 'raw_material',
      customerAbbr: '',
      name: '',
      unit: 'kg',
      specification: '',
      procurementType: 'purchase',
      requiresLotTracking: true,
    }])
  }

  /** 모달 행 값 변경 */
  const updateNewRow = (id: string, key: string, value: unknown) => {
    setNewRows((prev) => prev.map((r) => r.id === id ? { ...r, [key]: value } : r))
  }

  /** 모달 행 삭제 */
  const removeNewRow = (id: string) => {
    setNewRows((prev) => prev.filter((r) => r.id !== id))
  }

  /** 모달: 일괄 저장 */
  const handleBulkAdd = async () => {
    const validRows = newRows.filter((r) => r.customerAbbr.length === 3 && r.name.trim())
    if (validRows.length === 0) {
      alert('고객사 약칭(3자리)과 품목명을 입력한 행이 없습니다.')
      return
    }
    setAddSaving(true)
    try {
      let codes = [...existingCodes]
      for (const row of validRows) {
        const code = generateNextCode(codes, row.type, row.customerAbbr)
        codes.push(code)
        await createMutation.mutateAsync({
          code, name: row.name, type: row.type, unit: row.unit,
          customerAbbr: row.customerAbbr.toUpperCase(),
          specification: row.specification || null,
          procurementType: row.procurementType || null,
          requiresLotTracking: row.requiresLotTracking,
          isActive: true,
        })
      }
      setNewRows([])
      setAddModalOpen(false)
    } catch {
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setAddSaving(false)
    }
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
        <div className="flex items-center gap-2">
          {hasChanges && (
            <>
              <span className="text-sm text-orange-600 font-medium">{pendingChanges.size}건 변경됨</span>
              <Button variant="secondary" onClick={handleCancel}>취소</Button>
              <Button onClick={handleSave} loading={saving}>저장</Button>
            </>
          )}
          {!hasChanges && (
            <Button onClick={() => { setNewRows([{ id: crypto.randomUUID(), type: 'raw_material', customerAbbr: '', name: '', unit: 'kg', specification: '', procurementType: 'purchase', requiresLotTracking: true }]); setAddModalOpen(true) }}>
              품목 추가
            </Button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <Input
              placeholder="품목코드, 품목명, 고객약칭 검색 (Enter)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button size="sm" onClick={handleSearch}>검색</Button>
            {activeSearch && <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setActiveSearch(''); setPage(0) }}>초기화</Button>}
          </div>
          <span className="text-xs text-gray-500">
            {filtered.length}건 중 {page * PAGE_SIZE + 1}~{Math.min((page + 1) * PAGE_SIZE, filtered.length)}
          </span>
        </div>
        <EditableTable
          columns={columns}
          data={displayData}
          onChange={handleChange}
          onDelete={isCeo ? handleDelete : undefined}
          exportFileName="품목관리"
          onFetchAllForExport={() => getAllDocuments<Item>('items', [fsOrderBy('code', 'asc')])}
        />
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

      {/* 품목 일괄 추가 모달 */}
      <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="품목 일괄 추가" size="xl">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">유형과 고객약칭(3자리)을 입력하면 코드가 자동 생성됩니다. 여러 행을 추가한 후 한번에 저장하세요.</p>

          <div className="overflow-auto max-h-[50vh]">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-24">유형 *</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-20">고객약칭 *</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">품목명 *</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-20">단위</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-28">규격</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-20">조달</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-12">LOT</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {newRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-1 py-1">
                      <select value={row.type} onChange={(e) => updateNewRow(row.id, 'type', e.target.value)} className="w-full px-1 py-1 text-sm border rounded">
                        {ITEM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input value={row.customerAbbr} onChange={(e) => updateNewRow(row.id, 'customerAbbr', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))} placeholder="ABC" maxLength={3} className="w-full px-1 py-1 text-sm border rounded uppercase" />
                    </td>
                    <td className="px-1 py-1">
                      <input value={row.name} onChange={(e) => updateNewRow(row.id, 'name', e.target.value)} placeholder="품목명 입력" className="w-full px-1 py-1 text-sm border rounded" />
                    </td>
                    <td className="px-1 py-1">
                      <select value={row.unit} onChange={(e) => updateNewRow(row.id, 'unit', e.target.value)} className="w-full px-1 py-1 text-sm border rounded">
                        {UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input value={row.specification} onChange={(e) => updateNewRow(row.id, 'specification', e.target.value)} placeholder="규격" className="w-full px-1 py-1 text-sm border rounded" />
                    </td>
                    <td className="px-1 py-1">
                      <select value={row.procurementType} onChange={(e) => updateNewRow(row.id, 'procurementType', e.target.value)} className="w-full px-1 py-1 text-sm border rounded">
                        {PROCUREMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1 text-center">
                      <input type="checkbox" checked={row.requiresLotTracking} onChange={(e) => updateNewRow(row.id, 'requiresLotTracking', e.target.checked)} className="w-4 h-4 text-teal-600 rounded" />
                    </td>
                    <td className="px-1 py-1">
                      <button onClick={() => removeNewRow(row.id)} className="text-gray-400 hover:text-red-500">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button variant="ghost" size="sm" onClick={addNewRow}>+ 행 추가</Button>

          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-sm text-gray-500">{newRows.filter((r) => r.customerAbbr.length === 3 && r.name.trim()).length}건 저장 가능</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setAddModalOpen(false)}>취소</Button>
              <Button onClick={handleBulkAdd} loading={addSaving}>일괄 저장</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
