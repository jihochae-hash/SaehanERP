/**
 * 생산계획 원부자재입고현황 — 메인 페이지
 * 3개 탭: 수주/입고관리 | 제조일정 수립 | 충포장일정 수립
 * BOM 데이터는 기존 생산관리 > BOM 관리 기능을 활용
 */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrdersWithMaterials, useMfgSchedules, useFpSchedules, usePlanBom } from './use-plan-data'
import OrderManagementTab from './OrderManagementTab'
import ManufacturingScheduleTab from './ManufacturingScheduleTab'
import FillPackScheduleTab from './FillPackScheduleTab'

type TabId = 'orders' | 'mfg' | 'fillpack'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'orders', label: '수주/입고관리', icon: '📋' },
  { id: 'mfg', label: '제조일정 수립', icon: '🔬' },
  { id: 'fillpack', label: '충포장일정 수립', icon: '📅' },
]

export default function ProductionPlanMainPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('orders')

  // 공통 데이터 로딩
  const { orders, isLoading: ordersLoading } = useOrdersWithMaterials()
  const { data: mfgSchedules = [], isLoading: mfgLoading } = useMfgSchedules()
  const { data: fpSchedules = [], isLoading: fpLoading } = useFpSchedules()
  const { bomRows, bomIndex, isLoading: bomLoading } = usePlanBom()

  // 통계
  const stats = useMemo(() => {
    const total = orders.length
    let ready = 0
    let pending = 0
    orders.forEach(o => {
      const pkgDone = (o.materials || []).every(m => m.status === 'received' || m.status === 'in_stock' || m.status === 'special')
      const bulkDone = (o.bulkMaterials || []).every(m => m.status === 'received' || m.status === 'in_stock' || m.status === 'special')
      const hasMats = (o.materials || []).length + (o.bulkMaterials || []).length > 0
      if (pkgDone && bulkDone && hasMats) ready++
      else pending++
    })
    const products = new Set(bomRows.map(r => r.productCode)).size
    return { total, ready, pending, products }
  }, [orders, bomRows])

  const isLoading = ordersLoading || mfgLoading || fpLoading || bomLoading

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-teal-800 to-teal-600 text-white rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold">원부자재 입고현황 및 생산계획 관리</h1>
          <p className="text-teal-200 text-xs mt-0.5">수주 등록 → 자재입고 추적 → 제조일정 → 충포장일정</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <div className="text-xl font-bold">{stats.products}</div>
            <div className="text-teal-200 text-[10px]">BOM 제품</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">{stats.total}</div>
            <div className="text-teal-200 text-[10px]">전체 수주</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-300">{stats.ready}</div>
            <div className="text-teal-200 text-[10px]">입고완료</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-amber-300">{stats.pending}</div>
            <div className="text-teal-200 text-[10px]">진행중</div>
          </div>
          <button
            onClick={() => navigate('/production/bom')}
            className="px-3 py-1.5 text-xs bg-white/15 border border-white/30 rounded-lg hover:bg-white/25 transition"
          >
            BOM 관리 →
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 로딩 표시 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-6 w-6 text-teal-600 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-gray-500 text-sm">데이터 로딩 중...</span>
        </div>
      )}

      {/* 탭 내용 */}
      <div className={isLoading ? 'opacity-50 pointer-events-none' : ''}>
        {activeTab === 'orders' && (
          <OrderManagementTab
            orders={orders}
            bomRows={bomRows}
            bomIndex={bomIndex}
            mfgSchedules={mfgSchedules}
            fpSchedules={fpSchedules}
          />
        )}
        {activeTab === 'mfg' && (
          <ManufacturingScheduleTab
            orders={orders}
            schedules={mfgSchedules}
            bomRows={bomRows}
            bomIndex={bomIndex}
          />
        )}
        {activeTab === 'fillpack' && (
          <FillPackScheduleTab
            orders={orders}
            schedules={fpSchedules}
            mfgSchedules={mfgSchedules}
          />
        )}
      </div>
    </div>
  )
}
