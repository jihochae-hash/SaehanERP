import { useState, useCallback } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Input, EditableTable } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument, useDeleteDocument } from '@/hooks/useFirestore'
import { useAuthStore } from '@/stores/auth'
import type { Partner, PartnerType } from '@/types'

const PARTNER_TYPE_OPTIONS = [
  { value: 'supplier', label: '공급처' },
  { value: 'customer', label: '고객' },
  { value: 'both', label: '공급/고객' },
]

const PAGE_SIZE = 50

export default function PartnerListPage() {
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pendingChanges, setPendingChanges] = useState<Map<string, Record<string, unknown>>>(new Map())
  const [saving, setSaving] = useState(false)
  const isCeo = useAuthStore((s) => s.isCeo())

  const maxDocs = activeSearch ? 0 : 200
  const { data: partners = [] } = useCollection<Partner>('partners', [orderBy('code', 'asc')], ['all', activeSearch], maxDocs)
  const createMutation = useCreateDocument('partners')
  const updateMutation = useUpdateDocument('partners')
  const deleteMutation = useDeleteDocument('partners')

  const existingCodes = partners.map((p) => p.code)

  const handleSearch = () => {
    setActiveSearch(search.trim())
    setPage(0)
  }

  const filtered = activeSearch
    ? partners.filter(
        (p) =>
          p.name.includes(activeSearch) ||
          p.code.includes(activeSearch) ||
          (p.abbr?.toLowerCase().includes(activeSearch.toLowerCase()) ?? false) ||
          (p.businessNo?.includes(activeSearch) ?? false) ||
          (p.contactPerson?.includes(activeSearch) ?? false) ||
          (p.internalManager?.includes(activeSearch) ?? false),
      )
    : partners

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const displayData = paged.map((p) => {
    const changes = pendingChanges.get(p.id)
    if (!changes) return p
    return { ...p, ...changes } as Partner
  })

  const hasChanges = pendingChanges.size > 0

  const handleChange = useCallback((rowIndex: number, key: string, value: unknown) => {
    const partner = paged[rowIndex]
    if (!partner) return
    if (key === 'code') {
      const newCode = String(value)
      if (existingCodes.some((c) => c === newCode && c !== partner.code)) {
        alert('이미 사용중인 거래처코드입니다.')
        return
      }
    }
    setPendingChanges((prev) => {
      const next = new Map(prev)
      const existing = next.get(partner.id) ?? {}
      next.set(partner.id, { ...existing, [key]: value })
      return next
    })
  }, [paged, existingCodes])

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

  const handleCancel = () => setPendingChanges(new Map())

  const handleAdd = async () => {
    const maxNum = partners.reduce((max, p) => {
      const num = parseInt(p.code.replace(/\D/g, ''), 10)
      return isNaN(num) ? max : Math.max(max, num)
    }, 0)
    const code = String(maxNum + 1).padStart(6, '0')
    await createMutation.mutateAsync({ code, name: '', type: 'supplier' as PartnerType, isActive: true })
  }

  const handleDelete = async (rowIndex: number) => {
    const partner = paged[rowIndex]
    if (!partner) return
    if (!isCeo) { alert('CEO만 삭제할 수 있습니다.'); return }
    if (!confirm(`"${partner.code} ${partner.name}" 거래처를 삭제하시겠습니까?`)) return
    await deleteMutation.mutateAsync(partner.id)
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
          {hasChanges && (
            <>
              <span className="text-sm text-orange-600 font-medium">{pendingChanges.size}건 변경됨</span>
              <Button variant="secondary" onClick={handleCancel}>취소</Button>
              <Button onClick={handleSave} loading={saving}>저장</Button>
            </>
          )}
          {!hasChanges && <Button onClick={handleAdd} loading={createMutation.isPending}>거래처 추가</Button>}
        </div>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <Input
              placeholder="코드, 상호, 약칭, 사업자번호, 담당자 검색 (Enter)"
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
        <EditableTable columns={columns} data={displayData} onChange={handleChange} onDelete={isCeo ? handleDelete : undefined} />
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
