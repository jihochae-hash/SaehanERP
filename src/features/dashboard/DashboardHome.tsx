import { Card } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'

export default function DashboardHome() {
  const { user, claims } = useAuthStore()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard title="환영합니다" value={user?.displayName ?? '사용자'} sub={claims?.role ?? ''} color="blue" />
        <SummaryCard title="오늘 날짜" value={formatDate(new Date())} sub={getDayOfWeek(new Date())} color="green" />
        <SummaryCard title="재고 알림" value="—" sub="준비 중" color="yellow" />
        <SummaryCard title="결재 대기" value="—" sub="준비 중" color="purple" />
      </div>

      <Card title="시스템 안내">
        <div className="text-sm text-gray-600 space-y-2">
          <p>새한화장품 통합 경영관리 시스템 Phase 1 — 기반 구축 + 재고관리(WMS)</p>
          <p>좌측 메뉴에서 기초정보 관리 및 재고 관리 기능을 이용하실 수 있습니다.</p>
        </div>
      </Card>
    </div>
  )
}

function SummaryCard({ title, value, sub, color }: { title: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-l-blue-500',
    green: 'border-l-green-500',
    yellow: 'border-l-yellow-500',
    purple: 'border-l-purple-500',
  }
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 ${colors[color]} p-4`}>
      <p className="text-xs font-medium text-gray-500 uppercase">{title}</p>
      <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}

function formatDate(date: Date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function getDayOfWeek(date: Date) {
  return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()] + '요일'
}
