import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Badge, Input } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { useNavigate } from 'react-router-dom'
import { formatDate } from '@/utils/format'
import type { Formula, FormulaStatus, ProductCategory } from '@/types'

const STATUS_BADGE: Record<FormulaStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' }> = {
  draft: { label: '작성중', color: 'gray' },
  review: { label: '검토중', color: 'blue' },
  approved: { label: '승인', color: 'green' },
  archived: { label: '보관', color: 'yellow' },
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

export default function FormulaListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data: formulas = [], isLoading } = useCollection<Formula>(
    'formulas',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )

  const filtered = formulas.filter(
    (f) => f.name.includes(search) || f.code.includes(search),
  )

  const columns = [
    { key: 'code', label: '처방코드', width: '120px' },
    { key: 'name', label: '처방명' },
    {
      key: 'category', label: '제품유형', width: '100px',
      render: (val: unknown) => CATEGORY_LABEL[val as ProductCategory] ?? val,
    },
    { key: 'version', label: 'Ver.', width: '60px', render: (val: unknown) => `v${val}` },
    {
      key: 'composition', label: '성분수', width: '70px',
      render: (val: unknown) => Array.isArray(val) ? `${val.length}종` : '0종',
    },
    {
      key: 'totalPercentage', label: '합계(%)', width: '80px',
      render: (val: unknown) => {
        const pct = val as number
        return <span className={pct === 100 ? 'text-green-600' : 'text-red-600'}>{pct}%</span>
      },
    },
    {
      key: 'status', label: '상태', width: '80px',
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
        <div className="mb-4">
          <Input placeholder="처방코드, 처방명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} onRowClick={(row) => navigate(`/rnd/formulas/${row.id}`)} />
      </Card>
    </div>
  )
}
