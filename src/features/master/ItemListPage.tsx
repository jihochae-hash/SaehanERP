import { useState, useCallback, useEffect } from 'react'
import { orderBy, doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { Button, Card, Input, Badge, EditableTable, Modal } from '@/components/ui'
import { useCollection, useUpdateDocument, useDeleteDocument } from '@/hooks/useFirestore'
import { useQueryClient } from '@tanstack/react-query'
import { getAllDocuments, orderBy as fsOrderBy, createDocumentWithId } from '@/services/firestore.service'
import { useAuthStore } from '@/stores/auth'
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning'
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
  customerName: string
  name: string
  unit: string
  specification: string
  barcode: string
  procurementType: string
  formType: string
  formTypeName: string
  rawMaterialSub: string
  subMaterialType: string
  subMaterialTypeName: string
  isBaseBulk: boolean
  subCode: string
  unitQuantity: string
  safetyStock: string
  requiresLotTracking: boolean
}

export default function ItemListPage() {
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [page, setPage] = useState(0)
  const [isAddModalOpen, setAddModalOpen] = useState(false)
  const [newRows, setNewRows] = useState<NewItemRow[]>([])
  const [addSaving, setAddSaving] = useState(false)
  const [typeDefaults, setTypeDefaults] = useState<Record<string, Record<string, unknown>>>({})

  // 품목구분별 기본 설정 로드
  useEffect(() => {
    getDoc(doc(db, 'systemSettings', 'itemTypeDefaults')).then((snap) => {
      if (snap.exists()) setTypeDefaults(snap.data() as Record<string, Record<string, unknown>>)
    }).catch(() => {})
  }, [])
  const [pendingChanges, setPendingChanges] = useState<Map<string, Record<string, unknown>>>(new Map())
  const [saving, setSaving] = useState(false)
  const isCeo = useAuthStore((s) => s.isCeo())
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  // 검색어가 있으면 전체 로드, 없으면 200건만
  const maxDocs = activeSearch ? 0 : 200
  const { data: items = [] } = useCollection<Item>('items', [orderBy('createdAt', 'desc')], ['all', activeSearch], maxDocs)
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
  useUnsavedWarning(hasChanges)

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

  const defaultNewRow = (type: ItemType = 'raw_material'): NewItemRow => {
    const td = typeDefaults[type] ?? {}
    return {
      id: crypto.randomUUID(), type, customerAbbr: '', customerName: '',
      name: '', unit: (td.defaultUnit as string) ?? 'kg', specification: '', barcode: '',
      procurementType: (td.defaultProcurement as string) ?? 'purchase',
      formType: '', formTypeName: '', rawMaterialSub: '',
      subMaterialType: '', subMaterialTypeName: '', isBaseBulk: false,
      subCode: 'A', unitQuantity: '',
      safetyStock: td.defaultSafetyStock ? String(td.defaultSafetyStock) : '',
      requiresLotTracking: (td.requiresLotTracking as boolean) ?? true,
    }
  }

  /** 모달에 빈 행 추가 */
  const addNewRow = () => {
    setNewRows((prev) => [...prev, defaultNewRow()])
  }

  /** 첫 줄 복사해서 행 추가 */
  const duplicateFirstRow = () => {
    if (newRows.length === 0) { addNewRow(); return }
    const first = newRows[0]
    setNewRows((prev) => [...prev, { ...first, id: crypto.randomUUID(), name: '' }])
  }

  /** 모달 행 값 변경 — 유형 변경 시 기본값 자동 적용 */
  const updateNewRow = (id: string, key: string, value: unknown) => {
    setNewRows((prev) => prev.map((r) => {
      if (r.id !== id) return r
      const updated = { ...r, [key]: value }
      // 유형 변경 시 설정 기본값 적용
      if (key === 'type') {
        const td = typeDefaults[value as string] ?? {}
        updated.unit = (td.defaultUnit as string) ?? updated.unit
        updated.procurementType = (td.defaultProcurement as string) ?? updated.procurementType
        updated.requiresLotTracking = (td.requiresLotTracking as boolean) ?? updated.requiresLotTracking
        if (td.defaultSafetyStock) updated.safetyStock = String(td.defaultSafetyStock)
      }
      return updated
    }))
  }

  /** 모달 행 삭제 */
  const removeNewRow = (id: string) => {
    setNewRows((prev) => prev.filter((r) => r.id !== id))
  }

  /** 모달: 일괄 저장 (Firestore 전체 코드 조회 후 중복 방지) */
  const handleBulkAdd = async () => {
    const validRows = newRows.filter((r) => r.customerAbbr.length === 3 && r.name.trim())
    if (validRows.length === 0) {
      alert('고객사 약칭(3자리)과 품목명을 입력한 행이 없습니다.')
      return
    }
    setAddSaving(true)
    try {
      // Firestore에서 전체 품목코드 조회 (중복 방지)
      const allItems = await getAllDocuments<Item>('items', [fsOrderBy('code', 'asc')])
      let codes = allItems.map((i) => i.code)

      for (const row of validRows) {
        const code = generateNextCode(codes, row.type, row.customerAbbr)
        // 최종 중복 체크
        if (codes.includes(code)) {
          alert(`코드 중복 발생: ${code} — 저장을 중단합니다.`)
          return
        }
        codes.push(code)
        // doc ID = 품목코드로 저장 (동시 접속 시 중복 자동 차단)
        await createDocumentWithId('items', code, {
          code, name: row.name, type: row.type, unit: row.unit,
          customerAbbr: row.customerAbbr.toUpperCase(),
          customerName: row.customerName || null,
          specification: row.specification || null,
          barcode: row.barcode || null,
          procurementType: row.procurementType || null,
          formType: row.formType || null,
          formTypeName: row.formTypeName || null,
          rawMaterialSub: row.rawMaterialSub || null,
          subMaterialType: row.subMaterialType || null,
          subMaterialTypeName: row.subMaterialTypeName || null,
          isBaseBulk: row.isBaseBulk,
          subCode: row.subCode || 'A',
          unitQuantity: row.unitQuantity ? Number(row.unitQuantity) : null,
          safetyStock: row.safetyStock ? Number(row.safetyStock) : null,
          requiresLotTracking: row.requiresLotTracking,
          isActive: true,
        }, user?.uid ?? '')
      }
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setNewRows([])
      setAddModalOpen(false)
    } catch (err: unknown) {
      const msg = (err as Error).message ?? '저장 중 오류'
      alert(msg)
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
            <Button onClick={() => { setNewRows([defaultNewRow()]); setAddModalOpen(true) }}>
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
            <table className="text-sm" style={{ minWidth: 1200 }}>
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {[
                    ['유형 *', 'w-20'], ['고객약칭 *', 'w-16'], ['고객사명', 'w-20'], ['품목명 *', ''], ['단위', 'w-16'],
                    ['규격', 'w-24'], ['바코드', 'w-24'], ['조달', 'w-16'], ['제형', 'w-16'], ['제형명', 'w-20'],
                    ['원재료Sub', 'w-16'], ['부자재유형', 'w-16'], ['부자재유형명', 'w-20'], ['Base벌크', 'w-12'],
                    ['Sub', 'w-10'], ['단위수량', 'w-16'], ['안전재고', 'w-16'], ['LOT', 'w-10'], ['', 'w-8'],
                  ].map(([label, w], i) => (
                    <th key={i} className={`px-1 py-2 text-left text-xs font-semibold text-gray-600 ${w}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {newRows.map((row) => {
                  const inp = "w-full px-1 py-1 text-sm border rounded"
                  const sel = "w-full px-1 py-1 text-sm border rounded"
                  return (
                    <tr key={row.id}>
                      <td className="px-1 py-1"><select value={row.type} onChange={(e) => updateNewRow(row.id, 'type', e.target.value)} className={sel}>{ITEM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                      <td className="px-1 py-1"><input value={row.customerAbbr} onChange={(e) => updateNewRow(row.id, 'customerAbbr', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))} placeholder="ABC" maxLength={3} className={`${inp} uppercase`} /></td>
                      <td className="px-1 py-1"><input value={row.customerName} onChange={(e) => updateNewRow(row.id, 'customerName', e.target.value)} className={inp} /></td>
                      <td className="px-1 py-1"><input value={row.name} onChange={(e) => updateNewRow(row.id, 'name', e.target.value)} placeholder="품목명" className={inp} /></td>
                      <td className="px-1 py-1"><select value={row.unit} onChange={(e) => updateNewRow(row.id, 'unit', e.target.value)} className={sel}>{UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                      <td className="px-1 py-1"><input value={row.specification} onChange={(e) => updateNewRow(row.id, 'specification', e.target.value)} className={inp} /></td>
                      <td className="px-1 py-1"><input value={row.barcode} onChange={(e) => updateNewRow(row.id, 'barcode', e.target.value)} className={inp} /></td>
                      <td className="px-1 py-1"><select value={row.procurementType} onChange={(e) => updateNewRow(row.id, 'procurementType', e.target.value)} className={sel}>{PROCUREMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                      <td className="px-1 py-1"><input value={row.formType} onChange={(e) => updateNewRow(row.id, 'formType', e.target.value)} className={inp} /></td>
                      <td className="px-1 py-1"><input value={row.formTypeName} onChange={(e) => updateNewRow(row.id, 'formTypeName', e.target.value)} className={inp} /></td>
                      <td className="px-1 py-1"><input value={row.rawMaterialSub} onChange={(e) => updateNewRow(row.id, 'rawMaterialSub', e.target.value)} className={inp} /></td>
                      <td className="px-1 py-1"><input value={row.subMaterialType} onChange={(e) => updateNewRow(row.id, 'subMaterialType', e.target.value)} className={inp} /></td>
                      <td className="px-1 py-1"><input value={row.subMaterialTypeName} onChange={(e) => updateNewRow(row.id, 'subMaterialTypeName', e.target.value)} className={inp} /></td>
                      <td className="px-1 py-1 text-center"><input type="checkbox" checked={row.isBaseBulk} onChange={(e) => updateNewRow(row.id, 'isBaseBulk', e.target.checked)} className="w-4 h-4 text-teal-600 rounded" /></td>
                      <td className="px-1 py-1"><input value={row.subCode} onChange={(e) => updateNewRow(row.id, 'subCode', e.target.value.toUpperCase().slice(0, 1))} maxLength={1} className={`${inp} uppercase text-center`} /></td>
                      <td className="px-1 py-1"><input value={row.unitQuantity} onChange={(e) => updateNewRow(row.id, 'unitQuantity', e.target.value)} type="number" className={inp} /></td>
                      <td className="px-1 py-1"><input value={row.safetyStock} onChange={(e) => updateNewRow(row.id, 'safetyStock', e.target.value)} type="number" className={inp} /></td>
                      <td className="px-1 py-1 text-center"><input type="checkbox" checked={row.requiresLotTracking} onChange={(e) => updateNewRow(row.id, 'requiresLotTracking', e.target.checked)} className="w-4 h-4 text-teal-600 rounded" /></td>
                      <td className="px-1 py-1"><button onClick={() => removeNewRow(row.id)} className="text-gray-400 hover:text-red-500">✕</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={addNewRow}>+ 빈 행 추가</Button>
            <Button variant="ghost" size="sm" onClick={duplicateFirstRow}>+ 첫 줄 복사 추가</Button>
          </div>

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
