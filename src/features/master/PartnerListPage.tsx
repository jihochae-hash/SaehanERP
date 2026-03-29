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

export default function PartnerListPage() {
  const [search, setSearch] = useState('')
  const isCeo = useAuthStore((s) => s.isCeo())

  const { data: partners = [], isLoading } = useCollection<Partner>('partners', [orderBy('code', 'asc')], ['all'])
  const createMutation = useCreateDocument('partners')
  const updateMutation = useUpdateDocument('partners')
  const deleteMutation = useDeleteDocument('partners')

  const existingCodes = partners.map((p) => p.code)

  const filtered = partners.filter(
    (p) => p.name.includes(search) || p.code.includes(search) || (p.businessNo?.includes(search) ?? false),
  )

  const handleChange = useCallback(async (rowIndex: number, key: string, value: unknown) => {
    const partner = filtered[rowIndex]
    if (!partner) return

    if (key === 'code') {
      const newCode = String(value).toUpperCase()
      if (existingCodes.some((c) => c.toUpperCase() === newCode && c.toUpperCase() !== partner.code.toUpperCase())) {
        alert('이미 사용중인 거래처코드입니다.')
        return
      }
      value = newCode
    }

    await updateMutation.mutateAsync({ docId: partner.id, data: { [key]: value } })
  }, [filtered, existingCodes, updateMutation])

  const handleAdd = async () => {
    // 순차 코드 생성
    const maxNum = partners.reduce((max, p) => {
      const num = parseInt(p.code.replace(/\D/g, ''), 10)
      return isNaN(num) ? max : Math.max(max, num)
    }, 0)
    const code = `P${String(maxNum + 1).padStart(4, '0')}`
    await createMutation.mutateAsync({ code, name: '', type: 'supplier' as PartnerType, isActive: true })
  }

  const handleDelete = async (rowIndex: number) => {
    const partner = filtered[rowIndex]
    if (!partner) return
    if (!isCeo) { alert('CEO만 삭제할 수 있습니다.'); return }
    if (!confirm(`"${partner.code} ${partner.name}" 거래처를 삭제하시겠습니까?`)) return
    await deleteMutation.mutateAsync(partner.id)
  }

  const columns = [
    { key: 'code', label: '거래처코드', width: '110px' },
    { key: 'name', label: '거래처명' },
    { key: 'type', label: '유형', width: '100px', type: 'select' as const, options: PARTNER_TYPE_OPTIONS },
    { key: 'businessNo', label: '사업자번호', width: '130px' },
    { key: 'representative', label: '대표자', width: '90px' },
    { key: 'phone', label: '전화번호', width: '130px' },
    { key: 'email', label: '이메일', width: '160px' },
    { key: 'contactPerson', label: '담당자', width: '90px' },
    { key: 'contactPhone', label: '담당자연락처', width: '130px' },
    { key: 'address', label: '주소' },
    { key: 'isActive', label: '활성', width: '60px', type: 'checkbox' as const },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">거래처관리</h1>
        <Button onClick={handleAdd} loading={createMutation.isPending}>거래처 추가</Button>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <Input placeholder="거래처코드, 거래처명, 사업자번호 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <p className="text-xs text-gray-400">셀을 클릭하여 직접 편집 · Tab/Enter로 이동</p>
        </div>
        <EditableTable
          columns={columns}
          data={filtered}
          onChange={handleChange}
          onDelete={isCeo ? handleDelete : undefined}
        />
        {!isLoading && filtered.length > 0 && (
          <div className="mt-3 text-sm text-gray-500 text-right">총 {filtered.length}건</div>
        )}
      </Card>
    </div>
  )
}
