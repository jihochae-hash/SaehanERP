import { Card, Badge } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { useCollection } from '@/hooks/useFirestore'
import { orderBy } from 'firebase/firestore'
import { ROLE_CONFIG } from '@/constants'
import { formatNumber } from '@/utils/format'
import type { UserRole } from '@/types'

export default function DashboardHome() {
  const { user, claims } = useAuthStore()
  const roleLabel = claims?.role ? ROLE_CONFIG[claims.role as UserRole]?.label ?? claims.role : ''

  // 실시간 데이터 조회 (각 200건 제한)
  const { data: workOrders = [] } = useCollection<Record<string, unknown>>('workOrders', [orderBy('createdAt', 'desc')], ['dash-wo'])
  const { data: salesOrders = [] } = useCollection<Record<string, unknown>>('salesOrders', [orderBy('createdAt', 'desc')], ['dash-so'])
  const { data: inspections = [] } = useCollection<Record<string, unknown>>('qualityInspections', [orderBy('createdAt', 'desc')], ['dash-qi'])
  const { data: transfers = [] } = useCollection<Record<string, unknown>>('warehouseTransfers', [orderBy('createdAt', 'desc')], ['dash-tf'])
  const { data: approvals = [] } = useCollection<Record<string, unknown>>('approvalRequests', [orderBy('createdAt', 'desc')], ['dash-ap'])
  const { data: serviceReqs = [] } = useCollection<Record<string, unknown>>('serviceRequests', [orderBy('createdAt', 'desc')], ['dash-sr'])

  // KPI 계산
  const productionActive = workOrders.filter((wo) => wo.status === 'in_progress').length
  const productionPlanned = workOrders.filter((wo) => wo.status === 'planned').length
  const productionCompleted = workOrders.filter((wo) => wo.status === 'completed').length

  const salesPending = salesOrders.filter((so) => so.status === 'confirmed' || so.status === 'processing').length
  const salesCompleted = salesOrders.filter((so) => so.status === 'completed').length

  const inspectionsFailed = inspections.filter((i) => i.overallResult === 'fail').length

  const inTransit = transfers.filter((t) => t.status === 'in_transit').length

  const approvalPending = approvals.filter((a) => a.status === 'pending').length

  const serviceOpen = serviceReqs.filter((s) => s.status === 'received' || s.status === 'processing').length

  return (
    <div>
      {/* 환영 배너 */}
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

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="생산 진행" value={productionActive} sub={`계획 ${productionPlanned}건`} color="blue" />
        <KpiCard title="생산 완료" value={productionCompleted} sub="금월 기준" color="green" />
        <KpiCard title="수주 처리" value={salesPending} sub={`완료 ${salesCompleted}건`} color="purple" />
        <KpiCard title="결재 대기" value={approvalPending} sub="미결건" color={approvalPending > 0 ? 'red' : 'gray'} />
        <KpiCard title="창고 이동중" value={inTransit} sub="미입고 건" color={inTransit > 0 ? 'yellow' : 'gray'} />
        <KpiCard title="A/S 미처리" value={serviceOpen} sub="접수/처리중" color={serviceOpen > 0 ? 'red' : 'gray'} />
      </div>

      {/* 상세 현황 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* 생산 현황 */}
        <Card title="생산 현황">
          {workOrders.filter((wo) => wo.status === 'planned' || wo.status === 'in_progress').length === 0 ? (
            <p className="text-sm text-gray-500 py-4">진행중인 작업지시가 없습니다.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {workOrders.filter((wo) => wo.status === 'planned' || wo.status === 'in_progress').slice(0, 8).map((wo, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <span className="font-medium">{String(wo.orderNo ?? '')}</span>
                    <span className="text-gray-500 ml-2">{String(wo.productItemName ?? '')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatNumber(wo.plannedQuantity as number)} {String(wo.unit ?? '')}</span>
                    <Badge color={wo.status === 'in_progress' ? 'blue' : 'gray'}>{wo.status === 'in_progress' ? '진행중' : '계획'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 품질 현황 */}
        <Card title="품질검사 현황">
          {inspections.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">검사 기록이 없습니다.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <div className="flex gap-3 mb-3">
                <div className="flex-1 bg-green-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-green-700">{inspections.filter((i) => i.overallResult === 'pass').length}</p>
                  <p className="text-xs text-green-600">합격</p>
                </div>
                <div className="flex-1 bg-red-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-red-700">{inspectionsFailed}</p>
                  <p className="text-xs text-red-600">불합격</p>
                </div>
                <div className="flex-1 bg-yellow-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-yellow-700">{inspections.filter((i) => i.overallResult === 'conditional_pass').length}</p>
                  <p className="text-xs text-yellow-600">조건부</p>
                </div>
              </div>
              {inspections.slice(0, 5).map((insp, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                  <span>{String(insp.inspectionNo ?? '')} — {String(insp.itemName ?? '')}</span>
                  <Badge color={insp.overallResult === 'pass' ? 'green' : insp.overallResult === 'fail' ? 'red' : 'yellow'}>
                    {insp.overallResult === 'pass' ? '합격' : insp.overallResult === 'fail' ? '불합격' : '조건부'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 알림/안내 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="금일 요약">
          <div className="text-sm text-gray-600 space-y-2">
            <p>📅 {formatDateFull(new Date())}</p>
            <p>🏭 생산 진행 {productionActive}건 / 계획 {productionPlanned}건</p>
            <p>📦 수주 처리대기 {salesPending}건</p>
            <p>🚚 창고이동 대기 {inTransit}건</p>
          </div>
        </Card>

        <Card title="주의사항">
          <div className="space-y-2">
            {inspectionsFailed > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <Badge color="red">경고</Badge> 불합격 검사 {inspectionsFailed}건
              </div>
            )}
            {approvalPending > 0 && (
              <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
                <Badge color="yellow">대기</Badge> 미결재 {approvalPending}건
              </div>
            )}
            {serviceOpen > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <Badge color="red">A/S</Badge> 미처리 {serviceOpen}건
              </div>
            )}
            {inspectionsFailed === 0 && approvalPending === 0 && serviceOpen === 0 && (
              <p className="text-sm text-green-600 py-2">✅ 특이사항 없음</p>
            )}
          </div>
        </Card>

        <Card title="시스템 안내">
          <div className="text-sm text-gray-600 space-y-1">
            <p>(주)새한화장품 통합 운영관리 시스템</p>
            <p className="text-xs text-gray-400 mt-2">Phase 1~7 전체 모듈 구현 완료</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({ title, value, sub, color }: { title: string; value: number; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-l-blue-500 bg-blue-50',
    green: 'border-l-green-500 bg-green-50',
    red: 'border-l-red-500 bg-red-50',
    yellow: 'border-l-yellow-500 bg-yellow-50',
    purple: 'border-l-purple-500 bg-purple-50',
    gray: 'border-l-gray-300 bg-gray-50',
  }
  const textColors: Record<string, string> = {
    blue: 'text-blue-700', green: 'text-green-700', red: 'text-red-700',
    yellow: 'text-yellow-700', purple: 'text-purple-700', gray: 'text-gray-700',
  }
  return (
    <div className={`rounded-xl border-l-4 p-3 ${colors[color]}`}>
      <p className="text-xs font-medium text-gray-500">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${textColors[color]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}

function formatDateFull(d: Date) {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`
}
