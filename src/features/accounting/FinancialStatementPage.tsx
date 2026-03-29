import { orderBy } from 'firebase/firestore'
import { Card, Table, Badge } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { formatDate, formatNumber } from '@/utils/format'

// --- 인라인 타입 ---

type EntryType = 'general' | 'sales' | 'purchase'

interface JournalEntry {
  id: string
  entryNo: string
  entryDate: string
  type: EntryType
  description: string
  debitAccount: string
  debitAmount: number
  creditAccount: string
  creditAmount: number
  isLocked: boolean
  createdAt: unknown
}

const TYPE_BADGE: Record<EntryType, { label: string; color: 'gray' | 'blue' | 'green' }> = {
  general: { label: '일반', color: 'gray' },
  sales: { label: '매출', color: 'blue' },
  purchase: { label: '매입', color: 'green' },
}

export default function FinancialStatementPage() {
  const { data: entries = [], isLoading } = useCollection<JournalEntry>(
    'journalEntries',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )

  /** 전표 요약 집계 */
  const totalDebit = entries.reduce((sum, e) => sum + (e.debitAmount ?? 0), 0)
  const totalCredit = entries.reduce((sum, e) => sum + (e.creditAmount ?? 0), 0)
  const salesEntries = entries.filter((e) => e.type === 'sales')
  const purchaseEntries = entries.filter((e) => e.type === 'purchase')
  const totalSales = salesEntries.reduce((sum, e) => sum + (e.creditAmount ?? 0), 0)
  const totalExpense = purchaseEntries.reduce((sum, e) => sum + (e.debitAmount ?? 0), 0)
  const netIncome = totalSales - totalExpense

  const summaryCards = [
    { label: '총자산 (차변합계)', value: totalDebit, color: 'text-blue-600' },
    { label: '총부채 (대변합계)', value: totalCredit, color: 'text-red-600' },
    { label: '자본 (차이)', value: totalDebit - totalCredit, color: 'text-gray-900' },
    { label: '매출', value: totalSales, color: 'text-green-600' },
    { label: '비용', value: totalExpense, color: 'text-orange-600' },
    { label: '손익', value: netIncome, color: netIncome >= 0 ? 'text-blue-700' : 'text-red-600' },
  ]

  /** 계정별 그룹 집계 */
  const accountSummary = entries.reduce<Record<string, { debit: number; credit: number; count: number }>>((acc, e) => {
    // 차변 계정 집계
    if (e.debitAccount) {
      if (!acc[e.debitAccount]) acc[e.debitAccount] = { debit: 0, credit: 0, count: 0 }
      acc[e.debitAccount].debit += e.debitAmount ?? 0
      acc[e.debitAccount].count += 1
    }
    // 대변 계정 집계
    if (e.creditAccount) {
      if (!acc[e.creditAccount]) acc[e.creditAccount] = { debit: 0, credit: 0, count: 0 }
      acc[e.creditAccount].credit += e.creditAmount ?? 0
      acc[e.creditAccount].count += 1
    }
    return acc
  }, {})

  const accountRows = Object.entries(accountSummary)
    .map(([account, data]) => ({
      id: account,
      account,
      debitTotal: data.debit,
      creditTotal: data.credit,
      balance: data.debit - data.credit,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count)

  const accountColumns = [
    { key: 'account', label: '계정과목' },
    {
      key: 'debitTotal', label: '차변합계', width: '140px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    {
      key: 'creditTotal', label: '대변합계', width: '140px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    {
      key: 'balance', label: '잔액', width: '140px',
      render: (val: unknown) => {
        const v = val as number
        return <span className={v >= 0 ? 'text-blue-600' : 'text-red-600'}>{formatNumber(v)}원</span>
      },
    },
    { key: 'count', label: '건수', width: '80px' },
  ]

  const entryColumns = [
    { key: 'entryNo', label: '전표번호', width: '120px' },
    { key: 'entryDate', label: '전표일자', width: '100px' },
    {
      key: 'type', label: '구분', width: '80px',
      render: (val: unknown) => {
        const info = TYPE_BADGE[val as EntryType]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'description', label: '적요' },
    { key: 'debitAccount', label: '차변계정', width: '110px' },
    {
      key: 'debitAmount', label: '차변금액', width: '120px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    { key: 'creditAccount', label: '대변계정', width: '110px' },
    {
      key: 'creditAmount', label: '대변금액', width: '120px',
      render: (val: unknown) => `${formatNumber(val as number)}원`,
    },
    { key: 'createdAt', label: '작성일', width: '100px', render: (val: unknown) => formatDate(val) },
  ]

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">재무제표</h1>
        <p className="text-sm text-gray-500 mt-1">전표 데이터 기반 재무 요약 (읽기 전용)</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-lg font-bold ${card.color}`}>
                {formatNumber(card.value)}원
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* 계정별 집계 */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">계정별 집계</h3>
        <Table columns={accountColumns} data={accountRows} loading={isLoading} emptyMessage="전표 데이터가 없습니다." />
      </Card>

      {/* 전표 목록 */}
      <div className="mt-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">전표 목록</h3>
          <Table columns={entryColumns} data={entries} loading={isLoading} emptyMessage="전표가 없습니다." />
        </Card>
      </div>
    </div>
  )
}
