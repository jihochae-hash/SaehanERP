/**
 * 충포장일정 수립 탭 — 충진/포장 캘린더
 * 기존 프로그램의 충포장일정 캘린더 UI를 그대로 재현
 * 라인별(A-2, C-1, C-2) 주간 캘린더 + 드래그&드롭
 */

import { useState, useCallback, useMemo } from 'react'
import type { OrderWithMaterials, FpSchedule, MfgSchedule, ScheduleWorkType } from '@/types/production-plan'
import { WORK_TYPE_LABEL } from '@/types/production-plan'
import { usePlanMutations } from './use-plan-data'

interface Props {
  orders: OrderWithMaterials[]
  schedules: FpSchedule[]
  mfgSchedules: MfgSchedule[]
}

// ─── 상수 ───
const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일']
const CAL_LINES = ['A-2', 'C-1', 'C-2']
const CAL_LINE_LABELS: Record<string, string> = { 'A-2': 'A-2', 'C-1': 'C-1', 'C-2': 'C-2/기타' }
const WORK_TYPES: ScheduleWorkType[] = ['fill+pack', 'fill', 'pack', 'label']
const HOLIDAYS_FIXED: Record<string, string> = {
  '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날', '06-06': '현충일',
  '08-15': '광복절', '10-03': '개천절', '10-09': '한글날', '12-25': '성탄절',
}
const HOLIDAYS_LUNAR: Record<string, Record<string, string>> = {
  '2025': { '01-28': '설날', '01-29': '설날', '01-30': '설날', '05-05': '부처님오신날', '10-05': '추석', '10-06': '추석', '10-07': '추석' },
  '2026': { '02-16': '설날', '02-17': '설날', '02-18': '설날', '05-24': '부처님오신날', '09-24': '추석', '09-25': '추석', '09-26': '추석' },
  '2027': { '02-06': '설날', '02-07': '설날', '02-08': '설날', '05-13': '부처님오신날', '10-13': '추석', '10-14': '추석', '10-15': '추석' },
}

function getMonday(d: Date): Date {
  const dt = new Date(d); const day = dt.getDay()
  dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1)); dt.setHours(0, 0, 0, 0); return dt
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtShortDate(ds: string): string {
  if (!ds) return '-'; const d = new Date(ds); if (isNaN(d.getTime())) return ds
  return `${d.getMonth() + 1}/${d.getDate()}`
}
function getHolidayName(ds: string): string | null {
  const md = ds.slice(5)
  if (HOLIDAYS_FIXED[md]) return HOLIDAYS_FIXED[md]
  const yr = ds.slice(0, 4)
  if (HOLIDAYS_LUNAR[yr]?.[md]) return HOLIDAYS_LUNAR[yr][md]
  return null
}

// ─── 벌크 공유 그룹 기반 주문 그룹핑 ───
function groupOrdersForSchedule(orders: OrderWithMaterials[]) {
  const bulkMap = new Map<string, string[]>()
  orders.forEach(o => {
    (o.bulkMaterials || []).forEach(b => {
      if (!bulkMap.has(b.matCode)) bulkMap.set(b.matCode, [])
      if (!bulkMap.get(b.matCode)!.includes(o.id)) bulkMap.get(b.matCode)!.push(o.id)
    })
  })

  const parent: Record<string, string> = {}
  const find = (x: string): string => { if (!parent[x]) parent[x] = x; return parent[x] === x ? x : (parent[x] = find(parent[x])) }
  const union = (a: string, b: string) => { parent[find(a)] = find(b) }
  bulkMap.forEach(ids => { for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]) })

  const groups = new Map<string, OrderWithMaterials[]>()
  orders.forEach(o => {
    const root = find(o.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(o)
  })

  return Array.from(groups.values())
}

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

export default function FillPackScheduleTab({ orders, schedules, mfgSchedules }: Props) {
  const mutations = usePlanMutations()

  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [weekCount, setWeekCount] = useState(2)
  const [showWeekend, setShowWeekend] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dragSchId, setDragSchId] = useState<string | null>(null)

  // 일정 등록 상태
  const [mode, setMode] = useState<'order' | 'manual'>('order')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [singleMode, setSingleMode] = useState(false)
  const [workType, setWorkType] = useState<ScheduleWorkType>('fill+pack')
  const [scheduleDate, setScheduleDate] = useState(fmtDate(new Date()))
  const [scheduleLine, setScheduleLine] = useState('A-2')
  const [manualProductInfo, setManualProductInfo] = useState('')
  const [manualQtyInfo, setManualQtyInfo] = useState('')

  const dayCount = showWeekend ? 7 : 5

  // 일정 미등록 주문 목록
  const scheduledOrderIds = useMemo(() => {
    const set = new Set<string>()
    schedules.forEach(s => (s.orderIds || '').split(',').filter(Boolean).forEach(id => set.add(id)))
    return set
  }, [schedules])

  const unscheduledOrders = useMemo(() =>
    orders.filter(o => !scheduledOrderIds.has(o.id)),
    [orders, scheduledOrderIds],
  )

  // 선택된 주문의 벌크 공유 그룹
  const selectedOrderGroup = useMemo(() => {
    if (!selectedOrderId) return null
    const groups = groupOrdersForSchedule(orders)
    const group = groups.find(g => g.some(o => o.id === selectedOrderId))
    if (!group || group.length <= 1) return null
    return group
  }, [selectedOrderId, orders])

  // ─── 일정 등록 ───
  const addSchedule = useCallback(async () => {
    if (mode === 'order') {
      if (!selectedOrderId) return
      const o = orders.find(x => x.id === selectedOrderId)
      if (!o) return

      let orderIds: string
      let productInfo: string
      let qtyInfo: string
      let bulkGroup = ''

      if (selectedOrderGroup && !singleMode) {
        orderIds = selectedOrderGroup.map(x => x.id).join(',')
        // totalKg 계산 (추후 표시용)
        void (selectedOrderGroup.reduce((s, x) => s + (x.totalFill || 0), 0) / 1000)
        const bulkName = o.bulkMaterials?.[0]?.matName || ''
        productInfo = `${bulkName} (${selectedOrderGroup.length}건)`
        qtyInfo = selectedOrderGroup.map(x =>
          `${x.productName.length > 15 ? x.productName.slice(0, 15) + '...' : x.productName} ${x.qty?.toLocaleString()}개`,
        ).join(' / ')
        bulkGroup = o.bulkMaterials?.[0]?.matCode || ''
      } else {
        orderIds = o.id
        productInfo = o.productName
        qtyInfo = `${o.qty?.toLocaleString()}개 / ${((o.totalFill || 0) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}kg`
      }

      await mutations.createFpSchedule.mutateAsync({
        orderIds,
        productInfo,
        date: scheduleDate,
        workType,
        bulkGroup,
        qtyInfo,
        line: scheduleLine,
      })
      setSelectedOrderId('')
    } else {
      if (!manualProductInfo) return
      await mutations.createFpSchedule.mutateAsync({
        orderIds: '',
        productInfo: manualProductInfo,
        date: scheduleDate,
        workType,
        bulkGroup: '',
        qtyInfo: manualQtyInfo,
        line: scheduleLine,
      })
      setManualProductInfo('')
      setManualQtyInfo('')
    }
  }, [mode, selectedOrderId, selectedOrderGroup, singleMode, orders, scheduleDate, workType, scheduleLine, manualProductInfo, manualQtyInfo, mutations.createFpSchedule])

  const deleteSchedule = useCallback(async (id: string) => {
    if (!confirm('이 충포장일정을 삭제하시겠습니까?')) return
    await mutations.deleteFpSchedule.mutateAsync(id)
  }, [mutations.deleteFpSchedule])

  const handleDrop = useCallback(async (date: string, line: string) => {
    if (!dragSchId) return
    await mutations.updateFpSchedule.mutateAsync({ docId: dragSchId, data: { date, line } })
    setDragSchId(null)
  }, [dragSchId, mutations.updateFpSchedule])

  // ─── 캘린더 데이터 ───
  const calendarData = useMemo(() => {
    const weeks: {
      label: string
      days: { date: string; dayNum: number; isToday: boolean; isSat: boolean; isSun: boolean; holiday: string | null; events: Record<string, FpSchedule[]> }[]
    }[] = []
    const today = fmtDate(new Date())
    for (let w = 0; w < weekCount; w++) {
      const weekMon = addDays(weekStart, w * 7)
      const days = []
      for (let i = 0; i < dayCount; i++) {
        const d = addDays(weekMon, i); const ds = fmtDate(d); const dow = d.getDay()
        const events: Record<string, FpSchedule[]> = {}
        CAL_LINES.forEach(ln => { events[ln] = schedules.filter(s => s.date === ds && (s.line || 'A-2') === ln) })
        days.push({ date: ds, dayNum: d.getDate(), isToday: ds === today, isSat: dow === 6, isSun: dow === 0, holiday: getHolidayName(ds), events })
      }
      weeks.push({ label: `${weekMon.getMonth() + 1}/${weekMon.getDate()}~`, days })
    }
    return weeks
  }, [weekStart, weekCount, dayCount, schedules])

  const endDate = addDays(weekStart, weekCount * 7 - 1)
  const startMon = weekStart.getMonth() + 1; const endMon = endDate.getMonth() + 1
  const monthLabel = startMon === endMon
    ? `${weekStart.getFullYear()}년 ${startMon}월`
    : `${weekStart.getFullYear()}년 ${startMon}월 ~ ${endMon}월`

  return (
    <div className="space-y-4">
      {/* ─── 캘린더 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <span className="text-lg font-semibold text-teal-700">📅 충포장일정 캘린더</span>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="일정 검색 (제품명)" className="px-2 py-1 text-xs border border-gray-200 rounded-lg w-48 focus:border-teal-500 focus:outline-none" />
            <select value={weekCount} onChange={e => setWeekCount(Number(e.target.value))}
              className="px-2 py-1 text-xs border border-gray-200 rounded-lg">
              <option value={1}>1주</option><option value={2}>2주</option><option value={3}>3주</option><option value={4}>4주</option>
            </select>
            <label className="text-[10px] text-gray-500 flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={showWeekend} onChange={e => setShowWeekend(e.target.checked)} /> 주말
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">◀</button>
            <button onClick={() => setWeekStart(getMonday(new Date()))} className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700">오늘</button>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">▶</button>
          </div>
          <span className="text-sm font-semibold text-gray-700">{monthLabel}</span>
        </div>

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
                  <tr key={`d-${wi}`}>
                    <td className="text-center text-[10px] text-gray-500 font-semibold bg-gray-50 border border-gray-200 p-0.5">{week.label}</td>
                    {week.days.map(day => (
                      <td key={day.date} className={`border border-gray-200 p-1 ${day.isToday ? 'bg-teal-50' : ''} ${day.isSat || day.isSun || day.holiday ? 'bg-gray-50' : ''}`} style={{ borderBottom: 'none' }}>
                        <div className={`text-xs font-bold ${day.isToday ? 'text-teal-600' : day.isSun || day.holiday ? 'text-red-600' : day.isSat ? 'text-teal-600' : 'text-gray-500'}`}>
                          {day.dayNum}{day.isToday && <span className="inline-block w-1 h-1 bg-teal-600 rounded-full ml-0.5 align-top" />}
                        </div>
                        {day.holiday && <div className="text-[8px] text-red-500 font-medium">{day.holiday}</div>}
                      </td>
                    ))}
                  </tr>
                  {CAL_LINES.map((ln, li) => (
                    <tr key={`${wi}-${ln}`}>
                      <td className={`text-center text-[9px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 p-0.5 ${li === CAL_LINES.length - 1 ? 'border-b-2 border-b-gray-300' : ''}`}>
                        {CAL_LINE_LABELS[ln]}
                      </td>
                      {week.days.map(day => (
                        <td key={`${day.date}-${ln}`}
                          className={`border border-gray-100 p-0.5 align-top ${day.isToday ? 'bg-teal-50' : ''} ${day.isSat || day.isSun || day.holiday ? 'bg-gray-50' : ''} ${li === CAL_LINES.length - 1 ? 'border-b-2 border-b-gray-300' : ''}`}
                          style={{ borderTop: '1px dashed #e5e7eb' }}
                          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-teal-100') }}
                          onDragLeave={e => e.currentTarget.classList.remove('bg-teal-100')}
                          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('bg-teal-100'); handleDrop(day.date, ln) }}
                        >
                          {day.events[ln]?.map(s => {
                            const oIds = (s.orderIds || '').split(',').filter(Boolean)
                            const matSt = oIds.length ? getGroupMatStatus(oIds, orders) : 'ok'
                            const matched = searchQuery ? s.productInfo.toLowerCase().includes(searchQuery.toLowerCase()) : false
                            // 벌크 제조일 표시
                            let bulkDateTxt = ''
                            if (oIds.length) {
                              const mfg = mfgSchedules.find(ms => oIds.some(oid => (ms.orderIds || '').split(',').includes(oid)))
                              if (mfg) bulkDateTxt = `벌크 ${fmtShortDate(mfg.date)}`
                            }

                            return (
                              <div key={s.id} draggable onDragStart={() => setDragSchId(s.id)}
                                className={`p-1 mb-0.5 rounded text-[10px] cursor-grab border-l-3 transition ${matched ? 'ring-2 ring-teal-400' : ''} ${
                                  matSt === 'ok' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'
                                } hover:shadow-md group relative`}>
                                <div className="font-semibold truncate" title={s.productInfo}>{s.productInfo}</div>
                                {s.qtyInfo && <div className="text-[9px] font-bold">{s.qtyInfo.split('/').map((x, i) => <span key={i}>{x.trim()}<br /></span>)}</div>}
                                {bulkDateTxt && <div className="text-[9px] text-teal-600 font-semibold">{bulkDateTxt}</div>}
                                <div className="text-[8px] opacity-70">{WORK_TYPE_LABEL[s.workType] || s.workType}{s.bulkGroup ? ' 🔗' : ''}</div>
                                <button onClick={e => { e.stopPropagation(); deleteSchedule(s.id) }}
                                  className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-[10px] text-red-500 hover:text-red-700 transition">✕</button>
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

      {/* ─── 일정 등록 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="text-teal-600">+</span> 충포장일정 등록
        </h3>

        <div className="flex gap-2 mb-3">
          <button onClick={() => setMode('order')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${mode === 'order' ? 'bg-teal-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>
            주문 연동
          </button>
          <button onClick={() => setMode('manual')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${mode === 'manual' ? 'bg-teal-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>
            수동 입력
          </button>
        </div>

        {mode === 'order' ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">주문목록에서 완제품을 선택하여 캘린더에 일정을 등록합니다.</p>
            <div>
              <label className="text-xs text-gray-500 block mb-1">주문 선택</label>
              <select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:outline-none">
                <option value="">-- 주문 선택 --</option>
                {unscheduledOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    [{o.orderNo || '-'}] {o.productCode} {o.productName} ({o.qty?.toLocaleString()}개)
                  </option>
                ))}
              </select>
            </div>

            {selectedOrderGroup && (
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="text-xs font-semibold text-purple-700 mb-1">
                  🔗 벌크 공유 주문 ({selectedOrderGroup.length}건) — 함께 등록됩니다
                </div>
                {selectedOrderGroup.map(o => (
                  <div key={o.id} className="text-xs text-gray-700">{o.productCode} {o.productName} ({o.qty?.toLocaleString()}개)</div>
                ))}
                <label className="text-[10px] text-gray-500 flex items-center gap-1 mt-2 cursor-pointer">
                  <input type="checkbox" checked={singleMode} onChange={e => setSingleMode(e.target.checked)} />
                  선택한 완제품만 개별 등록
                </label>
              </div>
            )}

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">작업일</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">작업유형</label>
                <select value={workType} onChange={e => setWorkType(e.target.value as ScheduleWorkType)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:outline-none">
                  {WORK_TYPES.map(wt => <option key={wt} value={wt}>{WORK_TYPE_LABEL[wt]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">작업장</label>
                <select value={scheduleLine} onChange={e => setScheduleLine(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:outline-none">
                  {CAL_LINES.map(ln => <option key={ln} value={ln}>{CAL_LINE_LABELS[ln]}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={addSchedule} disabled={!selectedOrderId}
                  className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed">
                  일정 등록
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">주문과 연동하지 않는 충포장일정을 수동으로 입력합니다.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">제품명</label>
                <input value={manualProductInfo} onChange={e => setManualProductInfo(e.target.value)}
                  placeholder="예: XX크림 50ml" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">수량 정보</label>
                <input value={manualQtyInfo} onChange={e => setManualQtyInfo(e.target.value)}
                  placeholder="예: 5000개" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">작업일</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">작업유형</label>
                <select value={workType} onChange={e => setWorkType(e.target.value as ScheduleWorkType)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:outline-none">
                  {WORK_TYPES.map(wt => <option key={wt} value={wt}>{WORK_TYPE_LABEL[wt]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">작업장</label>
                <select value={scheduleLine} onChange={e => setScheduleLine(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:outline-none">
                  {CAL_LINES.map(ln => <option key={ln} value={ln}>{CAL_LINE_LABELS[ln]}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={addSchedule} disabled={!manualProductInfo}
                  className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed">
                  일정 등록
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
