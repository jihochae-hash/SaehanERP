import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Badge, Input, Select } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { useNavigate } from 'react-router-dom'
import { formatDate } from '@/utils/format'
import type { Formula, FormulaStatus, FormulaType, ProductCategory } from '@/types'

const STATUS_BADGE: Record<FormulaStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' }> = {
  draft: { label: '작성중', color: 'gray' },
  review: { label: '검토중', color: 'blue' },
  approved: { label: '승인', color: 'green' },
  archived: { label: '보관', color: 'yellow' },
}

const FORMULA_TYPE_BADGE: Record<FormulaType, { label: string; color: 'blue' | 'purple' | 'yellow' }> = {
  manufacturing: { label: '제조처방', color: 'blue' },
  label: { label: '표기처방', color: 'purple' },
  alternative: { label: '대체처방', color: 'yellow' },
}

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  skincare: '스킨케어',
  makeup: '메이크업',
  haircare: '헤어케어',
  bodycare: '바디케어',
  suncare: '선케어',
  cleansing: '클렌징',
  other: '기타',
}

const TYPE_FILTER_OPTIONS = [
  { value: '', label: '전체 유형' },
  { value: 'manufacturing', label: '제조처방' },
  { value: 'label', label: '표기처방' },
  { value: 'alternative', label: '대체처방' },
]

export default function FormulaListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: formulas = [], isLoading } = useCollection<Formula>(
    'formulas',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )

  const filtered = formulas.filter((f) => {
    const matchSearch = f.name.includes(search) || f.code.includes(search) || (f.linkedProductItemName?.includes(search) ?? false)
    const matchType = !typeFilter || f.formulaType === typeFilter
    return matchSearch && matchType
  })

  // 연결된 완제품별로 그룹핑 (같은 제품에 여러 처방이 있는 경우 표시)
  const productGroups = new Map<string, Formula[]>()
  for (const f of formulas) {
    if (f.linkedProductItemId) {
      const key = f.linkedProductItemId
      if (!productGroups.has(key)) productGroups.set(key, [])
      productGroups.get(key)!.push(f)
    }
  }

  const columns = [
    { key: 'code', label: '처방코드', width: '120px' },
    { key: 'name', label: '처방명' },
    {
      key: 'formulaType', label: '처방유형', width: '100px',
      render: (val: unknown) => {
        const info = FORMULA_TYPE_BADGE[val as FormulaType]
        return info ? <Badge color={info.color}>{info.label}</Badge> : <Badge color="gray">미지정</Badge>
      },
    },
    {
      key: 'linkedProductItemName', label: '연결 완제품', width: '150px',
      render: (val: unknown, row: Formula) => {
        if (!val) return <span className="text-gray-400">미연결</span>
        // 같은 완제품에 여러 처방이 있으면 개수 표시
        const group = row.linkedProductItemId ? productGroups.get(row.linkedProductItemId) : null
        const count = group ? group.length : 0
        return (
          <span>
            {String(val)}
            {count > 1 && <span className="ml-1 text-xs text-teal-600">({count}건)</span>}
          </span>
        )
      },
    },
    {
      key: 'category', label: '제품유형', width: '90px',
      render: (val: unknown) => CATEGORY_LABEL[val as ProductCategory] ?? val,
    },
    { key: 'version', label: 'Ver.', width: '50px', render: (val: unknown) => `v${val}` },
    {
      key: 'totalPercentage', label: '합계', width: '70px',
      render: (val: unknown) => {
        const pct = val as number
        return <span className={pct === 100 ? 'text-green-600' : 'text-red-600'}>{pct}%</span>
      },
    },
    {
      key: 'status', label: '상태', width: '70px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as FormulaStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '작성일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: Formula) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/rnd/formulas/${row.id}`) }}>
          상세
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">처방 관리</h1>
        <Button onClick={() => navigate('/rnd/formulas/new')}>처방 작성</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="처방코드, 처방명, 완제품명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-40">
            <Select options={TYPE_FILTER_OPTIONS} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} onRowClick={(row) => navigate(`/rnd/formulas/${row.id}`)} />
      </Card>
    </div>
  )
}
