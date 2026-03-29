import { Card } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { ROLE_CONFIG } from '@/constants'
import type { UserRole } from '@/types'

export default function DashboardHome() {
  const { user, claims } = useAuthStore()
  const roleLabel = claims?.role ? ROLE_CONFIG[claims.role as UserRole]?.label ?? claims.role : ''

  return (
    <div>
      {/* 상단 환영 배너 */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="" className="w-12 h-12 brightness-0 invert opacity-80 hidden sm:block" />
            <div>
              <h1 className="text-xl font-bold">{user?.displayName ?? '사용자'}님, 환영합니다</h1>
              <p className="text-teal-100 text-sm mt-0.5">{roleLabel} · Saehan ERP</p>
            </div>
          </div>
          <img src="/logo_full.png" alt="Sae Han Cosmetics" className="h-8 brightness-0 invert opacity-70 hidden md:block" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <SummaryCard title="오늘 날짜" value={formatDate(new Date())} sub={getDayOfWeek(new Date())} icon="calendar" />
        <SummaryCard title="재고 알림" value="—" sub="준비 중" icon="package" />
        <SummaryCard title="결재 대기" value="—" sub="준비 중" icon="check" />
      </div>

      <Card title="시스템 안내">
        <div className="text-sm text-gray-600 space-y-2">
          <p>(주)새한화장품 통합 운영관리 시스템 Phase 1 — 기반 구축 + 재고관리(WMS)</p>
          <p>좌측 메뉴에서 기초정보 관리 및 재고 관리 기능을 이용하실 수 있습니다.</p>
        </div>
      </Card>
    </div>
  )
}

function SummaryCard({ title, value, sub, icon }: { title: string; value: string; sub: string; icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    calendar: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    package: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    check: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start gap-4">
      <div className="p-2.5 bg-teal-50 text-teal-600 rounded-lg">
        {icons[icon]}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">{title}</p>
        <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  )
}

function formatDate(date: Date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function getDayOfWeek(date: Date) {
  return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()] + '요일'
}
