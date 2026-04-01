/**
 * 제조일정 수립 탭 — 벌크 제조 캘린더
 * 벌크(5번 코드)를 중심으로 제조일정을 수립하는 주간 캘린더
 * 기존 프로그램의 충포장일정 캘린더와 동일한 UI를 벌크 제조 전용으로 구현
 */

import { useState, useCallback, useMemo } from 'react'
import type { OrderWithMaterials, MfgSchedule, PlanBomRow } from '@/types/production-plan'
import { usePlanMutations } from './use-plan-data'

interface Props {
  orders: OrderWithMaterials[]
  schedules: MfgSchedule[]
  bomRows: PlanBomRow[]
  bomIndex: Record<string, PlanBomRow[]>
}

// ─── 상수 ───
const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일']
const TANK_LINES = ['1000L', '500L', '300L', '100L', '기타']
const HOLIDAYS_FIXED: Record<string, string> = {
  '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날', '06-06': '현충일',
  '08-15': '광복절', '10-03': '개천절', '10-09': '한글날', '12-25': '성탄절',
}
const HOLIDAYS_LUNAR: Record<string, Record<string, string>> = {
  '2025': { '01-28': '설날', '01-29': '설날', '01-30': '설날', '05-05': '부처님오신날', '10-05': '추석', '10-06': '추석', '10-07': '추석' },
  '2026': { '02-16': '설날', '02-17': '설날', '02-18': '설날', '05-24': '부처님오신날', '09-24': '추석', '09-25': '추석', '09-26': '추석' },
  '2027': { '02-06': '설날', '02-07': '설날', '02-08': '설날', '05-13': '부처님오신날', '10-13': '추석', '10-14': '추석', '10-15': '추석' },
}

// ─── 유틸 ───
function getMonday(d: Date): Date {
  const dt = new Date(d)
  const day = dt.getDay()
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1)
  dt.setDate(diff)
  dt.setHours(0, 0, 0, 0)
  return dt
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function getHolidayName(ds: string): string | null {
  const md = ds.slice(5)
  if (HOLIDAYS_FIXED[md]) return HOLIDAYS_FIXED[md]
  const yr = ds.slice(0, 4)
  if (HOLIDAYS_LUNAR[yr]?.[md]) return HOLIDAYS_LUNAR[yr][md]
  return null
}

// ─── 벌크 그룹핑: 같은 벌크(5번)를 사용하는 주문을 묶기 ───
function groupOrdersByBulk(orders: OrderWithMaterials[]) {
  const bulkGroups = new Map<string, { bulkCode: string; bulkName: string; orders: OrderWithMaterials[]; totalFill: number }>()

  orders.forEach(o => {
    const bulks = o.bulkMaterials || []
    if (!bulks.length) return

    bulks.forEach(b => {
      if (!bulkGroups.has(b.matCode)) {
        bulkGroups.set(b.matCode, { bulkCode: b.matCode, bulkName: b.matName, orders: [], totalFill: 0 })
      }
      const g = bulkGroups.get(b.matCode)!
      if (!g.orders.some(x => x.id === o.id)) {
        g.orders.push(o)
        g.totalFill += (o.totalFill || 0)
      }
    })
  })

  return Array.from(bulkGroups.values()).sort((a, b) => b.totalFill - a.totalFill)
}

// ─── 입고 상태 확인 ───
function getOrderMatStatus(o: OrderWithMaterials): 'ok' | 'ng' {
  const all = [...(o.materials || []), ...(o.bulkMaterials || []).map(b => ({ status: b.status }))]
  if (!all.length) return 'ok'
  return all.every(m => m.status === 'received' || m.status === 'in_stock' || m.status === 'special') ? 'ok' : 'ng'
}

function getGroupMatStatus(orderIds: string[], allOrders: OrderWithMaterials[]): 'ok' | 'ng' {
  return orderIds.every(id => {
    const o = allOrders.find(x => x.id === id)
    return !o || getOrderMatStatus(o) === 'ok'
  }) ? 'ok' : 'ng'
}

export default function ManufacturingScheduleTab({ orders, schedules, bomRows: _bomRows, bomIndex: _bomIndex }: Props) {
  const mutations = usePlanMutations()

  // ─── 캘린더 상태 ───
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [weekCount, setWeekCount] = useState(2)
  const [showWeekend, setShowWeekend] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dragSchId, setDragSchId] = useState<string | null>(null)

  // ─── 일정 등록 상태 ───
  const [selectedBulkGroup, setSelectedBulkGroup] = useState<string>('')
  const [scheduleDate, setScheduleDate] = useState(fmtDate(new Date()))
  const [scheduleLine, setScheduleLine] = useState('1000L')
  const [manualProductInfo, setManualProductInfo] = useState('')
  const [manualQtyInfo, setManualQtyInfo] = useState('')
  const [mode, setMode] = useState<'bulk' | 'manual'>('bulk')

  const dayCount = showWeekend ? 7 : 5

  // ─── 벌크 그룹 목록 (일정 미등록 주문만) ───
  const bulkGroups = useMemo(() => {
    const scheduledOrderIds = new Set<string>()
    schedules.forEach(s => (s.orderIds || '').split(',').filter(Boolean).forEach(id => scheduledOrderIds.add(id)))
    const unscheduledOrders = orders.filter(o => !scheduledOrderIds.has(o.id))
    return groupOrdersByBulk(unscheduledOrders)
  }, [orders, schedules])

  // ─── 선택된 벌크 그룹 정보 ───
  const selectedGroup = useMemo(() => {
    return bulkGroups.find(g => g.bulkCode === selectedBulkGroup)
  }, [bulkGroups, selectedBulkGroup])

  // ─── 일정 등록 ───
  const addSchedule = useCallback(async () => {
    if (mode === 'bulk') {
      if (!selectedGroup) return
      const orderIds = selectedGroup.orders.map(o => o.id).join(',')
      const productInfo = selectedGroup.orders.length > 1
        ? `${selectedGroup.bulkName} (${selectedGroup.orders.length}건)`
        : selectedGroup.orders[0]?.productName || selectedGroup.bulkName
      const totalKg = (selectedGroup.totalFill / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })
      const qtyInfo = `${totalKg}kg / ${selectedGroup.orders.reduce((s, o) => s + o.qty, 0).toLocaleString()}개`

      await mutations.createMfgSchedule.mutateAsync({
        orderIds,
        productInfo,
        date: scheduleDate,
        workType: 'bulk',
        bulkGroup: selectedGroup.bulkCode,
        qtyInfo,
        line: scheduleLine,
      })
      setSelectedBulkGroup('')
    } else {
      if (!manualProductInfo) return
      await mutations.createMfgSchedule.mutateAsync({
        orderIds: '',
        productInfo: manualProductInfo,
        date: scheduleDate,
        workType: 'bulk',
        bulkGroup: '',
        qtyInfo: manualQtyInfo,
        line: scheduleLine,
      })
      setManualProductInfo('')
      setManualQtyInfo('')
    }
  }, [mode, selectedGroup, scheduleDate, scheduleLine, manualProductInfo, manualQtyInfo, mutations.createMfgSchedule])

  // ─── 일정 삭제 ───
  const deleteSchedule = useCallback(async (id: string) => {
    if (!confirm('이 제조일정을 삭제하시겠습니까?')) return
    await mutations.deleteMfgSchedule.mutateAsync(id)
  }, [mutations.deleteMfgSchedule])

  // ─── 드래그&드롭 ───
  const handleDrop = useCallback(async (date: string, line: string) => {
    if (!dragSchId) return
    await mutations.updateMfgSchedule.mutateAsync({
      docId: dragSchId,
      data: { date, line },
    })
    setDragSchId(null)
  }, [dragSchId, mutations.updateMfgSchedule])

  // ─── 캘린더 렌더링 ───
  const calendarData = useMemo(() => {
    const weeks: {
      label: string
      days: {
        date: string
        dayNum: number
        isToday: boolean
        isSat: boolean
        isSun: boolean
        holiday: string | null
        events: Record<string, MfgSchedule[]>
      }[]
    }[] = []

    const today = fmtDate(new Date())

    for (let w = 0; w < weekCount; w++) {
      const weekMon = addDays(weekStart, w * 7)
      const days = []
      for (let i = 0; i < dayCount; i++) {
        const d = addDays(weekMon, i)
        const ds = fmtDate(d)
        const dow = d.getDay()
        const events: Record<string, MfgSchedule[]> = {}
        TANK_LINES.forEach(ln => {
          events[ln] = schedules.filter(s => s.date === ds && (s.line || '1000L') === ln)
        })
        days.push({
          date: ds,
          dayNum: d.getDate(),
          isToday: ds === today,
          isSat: dow === 6,
          isSun: dow === 0,
          holiday: getHolidayName(ds),
          events,
        })
      }
      weeks.push({ label: `${weekMon.getMonth() + 1}/${weekMon.getDate()}~`, days })
    }
    return weeks
  }, [weekStart, weekCount, dayCount, schedules])

  const endDate = addDays(weekStart, weekCount * 7 - 1)
  const startMon = weekStart.getMonth() + 1
  const endMon = endDate.getMonth() + 1
  const monthLabel = startMon === endMon
    ? `${weekStart.getFullYear()}년 ${startMon}월`
    : `${weekStart.getFullYear()}년 ${startMon}월 ~ ${endMon}월`

  return (
    <div className="space-y-4">
      {/* ─── 캘린더 헤더 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-purple-700">🔬 벌크 제조일정 캘린더</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="일정 검색 (제품명)"
              className="px-2 py-1 text-xs border border-gray-200 rounded-lg w-48 focus:border-purple-500 focus:outline-none"
            />
            <select value={weekCount} onChange={e => setWeekCount(Number(e.target.value))}
              className="px-2 py-1 text-xs border border-gray-200 rounded-lg">
              <option value={1}>1주</option>
              <option value={2}>2주</option>
              <option value={3}>3주</option>
              <option value={4}>4주</option>
            </select>
            <label className="text-[10px] text-gray-500 flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={showWeekend} onChange={e => setShowWeekend(e.target.checked)} /> 주말
            </label>
          </div>
        </div>

        {/* 주 이동 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">◀</button>
            <button onClick={() => setWeekStart(getMonday(new Date()))}
              className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700">오늘</button>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">▶</button>
          </div>
          <span className="text-sm font-semibold text-gray-700">{monthLabel}</span>
        </div>

        {/* ─── 캘린더 그리드 ─── */}
        <div className="overflow-auto">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr>
                <th className="w-14 text-xs font-semibold text-gray-700 p-1 border-b-2 border-gray-200" />
                {Array.from({ length: dayCount }, (_, i) => (
                  <th key={i} className={`text-xs font-semibold p-1 border-b-2 border-gray-200 text-center ${i === 5 ? 'text-teal-600' : i === 6 ? 'text-red-600' : 'text-gray-700'}`}>
                    {DAY_NAMES[i]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendarData.map((week, wi) => (
                <>
                  {/* 날짜 행 */}
                  <tr key={`d-${wi}`}>
                    <td className="text-center text-[10px] text-gray-500 font-semibold bg-gray-50 border border-gray-200 p-0.5">
                      {week.label}
                    </td>
                    {week.days.map(day => (
                      <td key={day.date}
                        className={`border border-gray-200 p-1 ${day.isToday ? 'bg-purple-50' : ''} ${day.isSat || day.isSun || day.holiday ? 'bg-gray-50' : ''}`}
                        style={{ borderBottom: 'none' }}
                      >
                        <div className={`text-xs font-bold ${day.isToday ? 'text-purple-600' : day.isSun || day.holiday ? 'text-red-600' : day.isSat ? 'text-teal-600' : 'text-gray-500'}`}>
                          {day.dayNum}
                          {day.isToday && <span className="inline-block w-1 h-1 bg-purple-600 rounded-full ml-0.5 align-top" />}
                        </div>
                        {day.holiday && <div className="text-[8px] text-red-500 font-medium">{day.holiday}</div>}
                      </td>
                    ))}
                  </tr>

                  {/* 탱크별 행 */}
                  {TANK_LINES.map((ln, li) => (
                    <tr key={`${wi}-${ln}`}>
                      <td className={`text-center text-[9px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 p-0.5 ${li === TANK_LINES.length - 1 ? 'border-b-2 border-b-gray-300' : ''}`}>
                        {ln}
                      </td>
                      {week.days.map(day => (
                        <td
                          key={`${day.date}-${ln}`}
                          className={`border border-gray-100 p-0.5 align-top min-h-[36px] ${day.isToday ? 'bg-purple-50' : ''} ${day.isSat || day.isSun || day.holiday ? 'bg-gray-50' : ''} ${li === TANK_LINES.length - 1 ? 'border-b-2 border-b-gray-300' : ''}`}
                          style={{ borderTop: '1px dashed #e5e7eb' }}
                          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-purple-100') }}
                          onDragLeave={e => e.currentTarget.classList.remove('bg-purple-100')}
                          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('bg-purple-100'); handleDrop(day.date, ln) }}
                        >
                          {day.events[ln]?.map(s => {
                            const oIds = (s.orderIds || '').split(',').filter(Boolean)
                            const matSt = oIds.length ? getGroupMatStatus(oIds, orders) : 'ok'
                            const matched = searchQuery ? s.productInfo.toLowerCase().includes(searchQuery.toLowerCase()) : false

                            return (
                              <div
                                key={s.id}
                                draggable
                                onDragStart={() => setDragSchId(s.id)}
                                className={`p-1 mb-0.5 rounded text-[10px] cursor-grab border-l-3 transition ${matched ? 'ring-2 ring-purple-400' : ''} ${
                                  matSt === 'ok'
                                    ? 'bg-purple-50 border-purple-500 text-purple-700'
                                    : 'bg-red-50 border-red-500 text-red-700'
                                } hover:shadow-md group relative`}
                              >
                                <div className="font-semibold truncate" title={s.productInfo}>{s.productInfo}</div>
                                {s.qtyInfo && <div className="text-[9px] font-bold">{s.qtyInfo}</div>}
                                <div className="text-[8px] opacity-70">벌크 제조</div>
                                <button
                                  onClick={e => { e.stopPropagation(); deleteSchedule(s.id) }}
                                  className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-[10px] text-red-500 hover:text-red-700 transition"
                                >
                                  ✕
                                </button>
                              </div>
                            )
                          })}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 일정 등록 패널 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="text-purple-600">+</span> 제조일정 등록
        </h3>

        {/* 모드 전환 */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setMode('bulk')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${mode === 'bulk' ? 'bg-purple-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
          >
            벌크 연동
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${mode === 'manual' ? 'bg-purple-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
          >
            수동 입력
          </button>
        </div>

        {mode === 'bulk' ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">수주에 등록된 벌크(원자재) 그룹을 선택하여 제조일정을 등록합니다.</p>

            <div>
              <label className="text-xs text-gray-500 block mb-1">벌크 그룹 선택</label>
              <select
                value={selectedBulkGroup}
                onChange={e => setSelectedBulkGroup(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
              >
                <option value="">-- 벌크 선택 --</option>
                {bulkGroups.map(g => (
                  <option key={g.bulkCode} value={g.bulkCode}>
                    {g.bulkName} ({g.orders.length}건, {(g.totalFill / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}kg)
                  </option>
                ))}
              </select>
            </div>

            {/* 선택된 벌크 그룹 상세 */}
            {selectedGroup && (
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="text-xs font-semibold text-purple-700 mb-2">
                  🧪 {selectedGroup.bulkName} — {selectedGroup.orders.length}개 제품
                </div>
                <div className="space-y-1">
                  {selectedGroup.orders.map(o => (
                    <div key={o.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                      <div>
                        <span className="text-teal-600 font-semibold mr-1">{o.productCode}</span>
                        <span>{o.productName}</span>
                      </div>
                      <div className="text-gray-500">
                        {o.qty?.toLocaleString()}개 / {((o.totalFill || 0) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}kg
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right text-xs font-bold text-purple-700">
                  합계: {(selectedGroup.totalFill / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}kg
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">제조일</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">탱크/설비</label>
                <select value={scheduleLine} onChange={e => setScheduleLine(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none">
                  {TANK_LINES.map(ln => <option key={ln} value={ln}>{ln}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={addSchedule}
                  disabled={!selectedGroup}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  일정 등록
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">벌크 목록에 없는 제조일정을 수동으로 입력합니다.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">제품/벌크명</label>
                <input value={manualProductInfo} onChange={e => setManualProductInfo(e.target.value)}
                  placeholder="예: XX크림 벌크" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">수량 정보</label>
                <input value={manualQtyInfo} onChange={e => setManualQtyInfo(e.target.value)}
                  placeholder="예: 500kg" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">제조일</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">탱크/설비</label>
                <select value={scheduleLine} onChange={e => setScheduleLine(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none">
                  {TANK_LINES.map(ln => <option key={ln} value={ln}>{ln}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={addSchedule}
                  disabled={!manualProductInfo}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  일정 등록
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── 등록된 제조일정 목록 ─── */}
      {schedules.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">📋 등록된 제조일정 ({schedules.length}건)</h3>
          <div className="space-y-2">
            {schedules
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(s => {
                const oIds = (s.orderIds || '').split(',').filter(Boolean)
                const matSt = oIds.length ? getGroupMatStatus(oIds, orders) : 'ok'
                return (
                  <div key={s.id} className={`flex items-center justify-between rounded-lg p-3 border ${matSt === 'ok' ? 'bg-purple-50 border-purple-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-semibold text-gray-500 w-20">{s.date}</div>
                      <div className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">{s.line || '1000L'}</div>
                      <div className="text-sm font-medium">{s.productInfo}</div>
                      {s.qtyInfo && <div className="text-xs text-gray-500">{s.qtyInfo}</div>}
                      {matSt === 'ng' && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">자재 미입고</span>}
                    </div>
                    <button onClick={() => deleteSchedule(s.id)}
                      className="text-gray-400 hover:text-red-500 transition">✕</button>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
