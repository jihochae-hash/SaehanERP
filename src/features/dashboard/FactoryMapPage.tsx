/**
 * 공장 맵 — 로그인 후 첫 화면
 * 공장 이미지 위에 각 부서 영역을 오버레이하여
 * 마우스 호버 시 관련 ERP 메뉴를 표시
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface DeptZone {
  id: string
  label: string
  /** 이미지 기준 % 좌표 (left, top, width, height) */
  x: number
  y: number
  w: number
  h: number
  menus: { label: string; path: string }[]
  popupAlign?: 'left' | 'right' | 'center'
  /** 팝업 수직 방향 — 기본 'above', 'below'로 설정하면 아래쪽에 표시 */
  popupVertical?: 'above' | 'below'
}

const DEPT_ZONES: DeptZone[] = [
  {
    id: 'receiving',
    label: '물류(입고)',
    x: 1, y: 0, w: 18, h: 32,
    popupAlign: 'left',
    menus: [
      { label: '입고처리', path: '/inventory/incoming' },
      { label: '발주서 관리', path: '/purchasing/orders' },
      { label: 'MRP 소요량', path: '/purchasing/mrp' },
      { label: '입출고이력', path: '/inventory/transactions' },
    ],
  },
  {
    id: 'inventory',
    label: '재고관리',
    x: 19, y: 0, w: 22, h: 28,
    menus: [
      { label: '재고현황', path: '/inventory/stock' },
      { label: '수불부', path: '/inventory/ledger' },
      { label: 'LOT추적', path: '/inventory/lot' },
      { label: '안전재고알림', path: '/inventory/safety-stock' },
      { label: '재고실사', path: '/inventory/count' },
      { label: '창고관리', path: '/master/warehouses' },
    ],
  },
  {
    id: 'rnd',
    label: '연구개발',
    x: 62, y: 0, w: 24, h: 28,
    popupAlign: 'right',
    menus: [
      { label: '처방 관리', path: '/rnd/formulas' },
      { label: '원료 마스터', path: '/rnd/ingredients' },
      { label: 'BOM 관리', path: '/production/bom' },
    ],
  },
  {
    id: 'qc',
    label: '품질관리',
    x: 76, y: 22, w: 22, h: 26,
    popupAlign: 'right',
    menus: [
      { label: '품질검사', path: '/quality/inspections' },
      { label: '부적합/CAPA', path: '/quality/capa' },
      { label: 'CGMP 문서', path: '/quality/cgmp' },
    ],
  },
  {
    id: 'office',
    label: '사무실',
    x: 0, y: 32, w: 20, h: 42,
    popupAlign: 'left',
    menus: [
      { label: '대시보드', path: '/dashboard' },
      { label: '견적관리', path: '/sales/quotations' },
      { label: '수주관리', path: '/sales/orders' },
      { label: '전표입력', path: '/accounting/journal' },
      { label: '사원정보', path: '/hr/employees' },
      { label: '전자결재', path: '/approval/requests' },
      { label: '게시판', path: '/groupware/notice' },
    ],
  },
  {
    id: 'bulk-storage',
    label: '벌크원료장',
    x: 20, y: 28, w: 20, h: 26,
    menus: [
      { label: '재고현황', path: '/inventory/stock' },
      { label: '창고이동', path: '/inventory/transfer' },
      { label: '수주/생산계획', path: '/production/plan-main' },
    ],
  },
  {
    id: 'bulk-mfg',
    label: '벌크제조',
    x: 40, y: 20, w: 22, h: 34,
    popupVertical: 'below',
    menus: [
      { label: '수주/생산계획', path: '/production/plan-main' },
      { label: '작업지시서', path: '/production/work-orders' },
      { label: '칭량관리(POP)', path: '/production/weighing' },
      { label: '제조실적', path: '/production/manufacturing' },
      { label: '공정모니터링', path: '/production/monitor' },
    ],
  },
  {
    id: 'filling',
    label: '충진',
    x: 55, y: 48, w: 18, h: 22,
    menus: [
      { label: '수주/생산계획', path: '/production/plan-main' },
      { label: '충진/포장', path: '/production/packaging' },
      { label: '공정모니터링', path: '/production/monitor' },
    ],
  },
  {
    id: 'packaging',
    label: '포장',
    x: 32, y: 62, w: 26, h: 24,
    menus: [
      { label: '수주/생산계획', path: '/production/plan-main' },
      { label: '충진/포장', path: '/production/packaging' },
      { label: '공정모니터링', path: '/production/monitor' },
      { label: '설비대장', path: '/equipment/list' },
    ],
  },
  {
    id: 'shipping',
    label: '물류(출고)',
    x: 68, y: 72, w: 30, h: 28,
    popupAlign: 'right',
    menus: [
      { label: '출고처리', path: '/inventory/outgoing' },
      { label: '출하관리', path: '/sales/shipments' },
      { label: '거래명세서', path: '/sales/statements' },
      { label: '매출현황', path: '/sales/analysis' },
    ],
  },
]

export default function FactoryMapPage() {
  const navigate = useNavigate()
  const [hoveredDept, setHoveredDept] = useState<string | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  /** 마우스 진입: 즉시 표시 + 기존 타이머 취소 */
  const handleDeptEnter = useCallback((id: string) => {
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
    setHoveredDept(id)
  }, [])

  /** 마우스 이탈: 300ms 후 닫기 (팝업에 다시 진입하면 취소됨) */
  const handleDeptLeave = useCallback(() => {
    leaveTimerRef.current = setTimeout(() => setHoveredDept(null), 300)
  }, [])
  const containerRef = useRef<HTMLDivElement>(null)
  const [imgRect, setImgRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  // 이미지 실제 표시 영역 계산
  const updateImgRect = useCallback(() => {
    const img = imgRef.current
    const container = containerRef.current
    if (!img || !container) return

    const cRect = container.getBoundingClientRect()
    const naturalW = img.naturalWidth || img.width
    const naturalH = img.naturalHeight || img.height
    if (!naturalW || !naturalH) return

    const scale = Math.min(cRect.width / naturalW, cRect.height / naturalH)
    const displayW = naturalW * scale
    const displayH = naturalH * scale
    const left = (cRect.width - displayW) / 2
    const top = (cRect.height - displayH) / 2

    setImgRect({ left, top, width: displayW, height: displayH })
  }, [])

  useEffect(() => {
    window.addEventListener('resize', updateImgRect)
    return () => window.removeEventListener('resize', updateImgRect)
  }, [updateImgRect])

  const handleMenuClick = useCallback((path: string) => {
    navigate(path)
  }, [navigate])

  return (
    <div className="flex flex-col -m-4 lg:-m-6" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* 상단 바 */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="w-7 h-7 brightness-0 invert opacity-80" />
          <div>
            <h1 className="text-base font-bold">(주)새한화장품 통합 경영관리</h1>
            <p className="text-[10px] text-slate-400">각 부서에 마우스를 올려 해당 업무로 이동하세요</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-3 py-1.5 text-xs bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition"
        >
          대시보드 →
        </button>
      </div>

      {/* 공장 맵 */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-slate-600"
      >
        <img
          ref={imgRef}
          src="/factory-map.png"
          alt="새한화장품 공장 레이아웃"
          className="absolute inset-0 w-full h-full object-contain select-none"
          draggable={false}
          onLoad={updateImgRect}
        />

        {/* 부서 오버레이 — 이미지 실제 표시 영역에 맞춤 */}
        {imgRect && (
          <div
            className="absolute"
            style={{
              left: imgRect.left,
              top: imgRect.top,
              width: imgRect.width,
              height: imgRect.height,
            }}
          >
            {DEPT_ZONES.map(zone => {
              const isHovered = hoveredDept === zone.id

              return (
                <div
                  key={zone.id}
                  className="absolute"
                  style={{
                    left: `${zone.x}%`,
                    top: `${zone.y}%`,
                    width: `${zone.w}%`,
                    height: `${zone.h}%`,
                  }}
                  onMouseEnter={() => handleDeptEnter(zone.id)}
                  onMouseLeave={handleDeptLeave}
                >
                  {/* 핫스팟 영역 */}
                  <div
                    className={`
                      w-full h-full rounded-lg border-2 transition-all duration-200 cursor-pointer
                      ${isHovered
                        ? 'border-teal-400 bg-teal-400/25 shadow-lg shadow-teal-400/30'
                        : 'border-transparent hover:border-white/40 hover:bg-white/10'}
                    `}
                  >
                    {/* 부서명 라벨 */}
                    <div className={`
                      absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap
                      px-2.5 py-1 rounded-md text-[11px] font-bold transition-all duration-200
                      ${isHovered
                        ? 'bg-teal-600 text-white shadow-lg scale-110'
                        : 'bg-black/60 text-white/90 backdrop-blur-sm'}
                    `}>
                      {zone.label}
                    </div>
                  </div>

                  {/* 팝업 메뉴 */}
                  {isHovered && (
                    <DeptPopup zone={zone} onMenuClick={handleMenuClick} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** 부서 호버 시 나타나는 메뉴 팝업 */
function DeptPopup({
  zone,
  onMenuClick,
}: {
  zone: DeptZone
  onMenuClick: (path: string) => void
}) {
  const align = zone.popupAlign || 'center'
  const vertical = zone.popupVertical || 'above'
  let posStyle: React.CSSProperties = {}

  if (align === 'left') {
    posStyle = { top: '0', left: '105%' }
  } else if (align === 'right') {
    posStyle = { top: '0', right: '105%' }
  } else if (vertical === 'below') {
    posStyle = { top: '105%', left: '50%', transform: 'translateX(-50%)' }
  } else {
    posStyle = { bottom: '105%', left: '50%', transform: 'translateX(-50%)' }
  }

  return (
    <div className="absolute z-50 animate-fadeIn" style={posStyle}>
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden min-w-[180px]">
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-2.5">
          <div className="text-white font-bold text-sm">{zone.label}</div>
        </div>
        <div className="py-1">
          {zone.menus.map((menu, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); onMenuClick(menu.path) }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-2 group"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0 group-hover:scale-125 transition-transform" />
              {menu.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
