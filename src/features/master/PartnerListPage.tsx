import { useState, useCallback } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Input, EditableTable, Modal } from '@/components/ui'
import { useCollection, useUpdateDocument, useDeleteDocument } from '@/hooks/useFirestore'
import { useQueryClient } from '@tanstack/react-query'
import { getAllDocuments, orderBy as fsOrderBy, createDocumentWithId } from '@/services/firestore.service'
import { useAuthStore } from '@/stores/auth'
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning'
import type { Partner, PartnerType } from '@/types'

const PARTNER_TYPE_OPTIONS = [
  { value: 'supplier', label: '공급처' },
  { value: 'customer', label: '고객' },
  { value: 'both', label: '공급/고객' },
]

const PAGE_SIZE = 50

interface NewPartnerRow {
  id: string
  name: string
  abbr: string
  type: PartnerType
  businessNo: string
  representative: string
  roadAddress: string
  phone: string
  contactPerson: string
  contactEmail: string
}

export default function PartnerListPage() {
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pendingChanges, setPendingChanges] = useState<Map<string, Record<string, unknown>>>(new Map())
  const [saving, setSaving] = useState(false)
  const [isAddModalOpen, setAddModalOpen] = useState(false)
  const [newRows, setNewRows] = useState<NewPartnerRow[]>([])
  const [addSaving, setAddSaving] = useState(false)
  const isCeo = useAuthStore((s) => s.isCeo())
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const maxDocs = activeSearch ? 0 : 200
  const { data: partners = [] } = useCollection<Partner>('partners', [orderBy('createdAt', 'desc')], ['all', activeSearch], maxDocs)
  const updateMutation = useUpdateDocument('partners')
  const deleteMutation = useDeleteDocument('partners')

  const existingCodes = partners.map((p) => p.code)

  const handleSearch = () => { setActiveSearch(search.trim()); setPage(0) }

  const filtered = activeSearch
    ? partners.filter((p) =>
        p.name.includes(activeSearch) || p.code.includes(activeSearch) ||
        (p.abbr?.toLowerCase().includes(activeSearch.toLowerCase()) ?? false) ||
        (p.businessNo?.includes(activeSearch) ?? false) ||
        (p.contactPerson?.includes(activeSearch) ?? false))
    : partners

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const displayData = paged.map((p) => { const c = pendingChanges.get(p.id); return c ? { ...p, ...c } as Partner : p })
  const hasChanges = pendingChanges.size > 0
  useUnsavedWarning(hasChanges)

  const handleChange = useCallback((rowIndex: number, key: string, value: unknown) => {
    const partner = paged[rowIndex]
    if (!partner) return
    if (key === 'code') {
      const newCode = String(value)
      if (existingCodes.some((c) => c === newCode && c !== partner.code)) { alert('이미 사용중인 거래처코드입니다.'); return }
    }
    setPendingChanges((prev) => { const next = new Map(prev); next.set(partner.id, { ...(next.get(partner.id) ?? {}), [key]: value }); return next })
  }, [paged, existingCodes])

  const handleSave = async () => {
    if (pendingChanges.size === 0) return
    setSaving(true)
    try {
      await Promise.all(Array.from(pendingChanges.entries()).map(([docId, changes]) => updateMutation.mutateAsync({ docId, data: changes })))
      setPendingChanges(new Map())
    } catch { alert('저장 중 오류가 발생했습니다.') } finally { setSaving(false) }
  }

  const handleCancel = () => setPendingChanges(new Map())

  const handleDelete = async (rowIndex: number) => {
    const partner = paged[rowIndex]
    if (!partner) return
    if (!isCeo) { alert('CEO만 삭제할 수 있습니다.'); return }
    if (!confirm(`"${partner.code} ${partner.name}" 거래처를 삭제하시겠습니까?`)) return
    await deleteMutation.mutateAsync(partner.id)
  }

  // --- 거래처 추가 모달 ---
  const defaultNewRow = (): NewPartnerRow => ({
    id: crypto.randomUUID(), name: '', abbr: '', type: 'supplier',
    businessNo: '', representative: '', roadAddress: '', phone: '', contactPerson: '', contactEmail: '',
  })

  const addNewRow = () => setNewRows((prev) => [...prev, defaultNewRow()])
  const duplicateFirstRow = () => {
    if (newRows.length === 0) { addNewRow(); return }
    const first = newRows[0]
    setNewRows((prev) => [...prev, { ...first, id: crypto.randomUUID(), name: '', businessNo: '' }])
  }
  const updateNewRow = (id: string, key: string, value: unknown) => {
    setNewRows((prev) => prev.map((r) => r.id === id ? { ...r, [key]: value } : r))
  }
  const removeNewRow = (id: string) => setNewRows((prev) => prev.filter((r) => r.id !== id))

  const handleBulkAdd = async () => {
    const validRows = newRows.filter((r) => r.name.trim())
    if (validRows.length === 0) { alert('거래처명을 입력한 행이 없습니다.'); return }
    setAddSaving(true)
    try {
      const allPartners = await getAllDocuments<Partner>('partners', [fsOrderBy('code', 'asc')])
      let maxNum = allPartners.reduce((max, p) => { const n = parseInt(p.code.replace(/\D/g, ''), 10); return isNaN(n) ? max : Math.max(max, n) }, 0)

      for (const row of validRows) {
        maxNum++
        const code = String(maxNum).padStart(6, '0')
        await createDocumentWithId('partners', code, {
          code, name: row.name, abbr: row.abbr || null, type: row.type,
          businessNo: row.businessNo || null, representative: row.representative || null,
          roadAddress: row.roadAddress || null, phone: row.phone || null,
          contactPerson: row.contactPerson || null, contactEmail: row.contactEmail || null,
          isActive: true,
        }, user?.uid ?? '')
      }
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      setNewRows([])
      setAddModalOpen(false)
    } catch (err: unknown) {
      alert((err as Error).message ?? '저장 중 오류')
    } finally { setAddSaving(false) }
  }

  const columns = [
    { key: 'code', label: '코드', width: '80px' },
    { key: 'name', label: '상호' },
    { key: 'abbr', label: '약칭', width: '70px' },
    { key: 'type', label: '유형', width: '90px', type: 'select' as const, options: PARTNER_TYPE_OPTIONS },
    { key: 'businessNo', label: '사업자번호', width: '130px' },
    { key: 'representative', label: '대표자', width: '80px' },
    { key: 'roadAddress', label: '도로명주소' },
    { key: 'businessType', label: '업태', width: '100px' },
    { key: 'phone', label: '전화번호', width: '130px' },
    { key: 'contactPerson', label: '담당자', width: '80px' },
    { key: 'contactEmail', label: '담당자이메일', width: '160px' },
    { key: 'internalManager', label: '자사담당', width: '80px' },
    { key: 'isSales', label: '매출', width: '50px', type: 'checkbox' as const },
    { key: 'isPurchase', label: '매입', width: '50px', type: 'checkbox' as const },
    { key: 'isActive', label: '활성', width: '50px', type: 'checkbox' as const },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">거래처관리</h1>
        <div className="flex items-center gap-2">
          {hasChanges ? (
            <>
              <span className="text-sm text-orange-600 font-medium">{pendingChanges.size}건 변경됨</span>
              <Button variant="secondary" onClick={handleCancel}>취소</Button>
              <Button onClick={handleSave} loading={saving}>저장</Button>
            </>
          ) : (
            <Button onClick={() => { setNewRows([defaultNewRow()]); setAddModalOpen(true) }}>거래처 추가</Button>
          )}
        </div>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <Input placeholder="코드, 상호, 약칭, 사업자번호, 담당자 검색 (Enter)" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
            <Button size="sm" onClick={handleSearch}>검색</Button>
            {activeSearch && <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setActiveSearch(''); setPage(0) }}>초기화</Button>}
          </div>
          <span className="text-xs text-gray-500">{filtered.length}건 중 {page * PAGE_SIZE + 1}~{Math.min((page + 1) * PAGE_SIZE, filtered.length)}</span>
        </div>
        <EditableTable
          columns={columns} data={displayData} onChange={handleChange} onDelete={isCeo ? handleDelete : undefined}
          exportFileName="거래처관리" onFetchAllForExport={() => getAllDocuments<Partner>('partners', [fsOrderBy('code', 'asc')])}
        />
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button>
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
              const p = totalPages <= 10 ? i : Math.max(0, Math.min(page - 4, totalPages - 10)) + i
              return <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 text-sm rounded ${p === page ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p + 1}</button>
            })}
            <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>다음</Button>
          </div>
        )}
      </Card>

      {/* 거래처 일괄 추가 모달 */}
      <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="거래처 일괄 추가" size="xl">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">거래처 코드는 자동 생성됩니다. 여러 행을 추가한 후 한번에 저장하세요.</p>
          <div className="overflow-auto max-h-[50vh]">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">거래처명 *</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-16">약칭</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-20">유형</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-28">사업자번호</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-20">대표자</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">주소</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-28">전화번호</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-20">담당자</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {newRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-1 py-1"><input value={row.name} onChange={(e) => updateNewRow(row.id, 'name', e.target.value)} placeholder="거래처명" className="w-full px-1 py-1 text-sm border rounded" /></td>
                    <td className="px-1 py-1"><input value={row.abbr} onChange={(e) => updateNewRow(row.id, 'abbr', e.target.value.toUpperCase().slice(0, 3))} placeholder="ABC" maxLength={3} className="w-full px-1 py-1 text-sm border rounded uppercase" /></td>
                    <td className="px-1 py-1">
                      <select value={row.type} onChange={(e) => updateNewRow(row.id, 'type', e.target.value)} className="w-full px-1 py-1 text-sm border rounded">
                        {PARTNER_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1"><input value={row.businessNo} onChange={(e) => updateNewRow(row.id, 'businessNo', e.target.value)} className="w-full px-1 py-1 text-sm border rounded" /></td>
                    <td className="px-1 py-1"><input value={row.representative} onChange={(e) => updateNewRow(row.id, 'representative', e.target.value)} className="w-full px-1 py-1 text-sm border rounded" /></td>
                    <td className="px-1 py-1"><input value={row.roadAddress} onChange={(e) => updateNewRow(row.id, 'roadAddress', e.target.value)} className="w-full px-1 py-1 text-sm border rounded" /></td>
                    <td className="px-1 py-1"><input value={row.phone} onChange={(e) => updateNewRow(row.id, 'phone', e.target.value)} className="w-full px-1 py-1 text-sm border rounded" /></td>
                    <td className="px-1 py-1"><input value={row.contactPerson} onChange={(e) => updateNewRow(row.id, 'contactPerson', e.target.value)} className="w-full px-1 py-1 text-sm border rounded" /></td>
                    <td className="px-1 py-1"><button onClick={() => removeNewRow(row.id)} className="text-gray-400 hover:text-red-500">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={addNewRow}>+ 빈 행 추가</Button>
            <Button variant="ghost" size="sm" onClick={duplicateFirstRow}>+ 첫 줄 복사 추가</Button>
          </div>
          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-sm text-gray-500">{newRows.filter((r) => r.name.trim()).length}건 저장 가능</span>
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
