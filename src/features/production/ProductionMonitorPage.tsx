import { orderBy } from 'firebase/firestore'
import { Card, Badge } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { formatNumber } from '@/utils/format'

interface WorkOrder { id: string; orderNo: string; productItemName: string; plannedQuantity: number; actualQuantity?: number; unit: string; status: string; productionLine?: string; plannedStartDate?: string; plannedEndDate?: string }
interface ProductionRecord { id: string; workOrderNo?: string; stage: string; status: string }
interface QualityInspection { id: string; referenceNo?: string; overallResult?: string }

const STAGES = [
  { key: 'planned', label: '계획', color: 'gray' },
  { key: 'weighing', label: '칭량', color: 'blue' },
  { key: 'manufacturing', label: '제조', color: 'purple' },
  { key: 'packaging', label: '충진/포장', color: 'yellow' },
  { key: 'inspection', label: '품질검사', color: 'blue' },
  { key: 'completed', label: '완료', color: 'green' },
] as const

export default function ProductionMonitorPage() {
  const { data: workOrders = [] } = useCollection<WorkOrder>('workOrders', [orderBy('createdAt', 'desc')], ['monitor-wo'])
  const { data: prodRecords = [] } = useCollection<ProductionRecord>('productionRecords', [orderBy('createdAt', 'desc')], ['monitor-pr'])
  const { data: inspections = [] } = useCollection<QualityInspection>('qualityInspections', [orderBy('createdAt', 'desc')], ['monitor-qi'])

  const activeOrders = workOrders.filter((wo) => wo.status !== 'cancelled')

  const getStage = (wo: WorkOrder): string => {
    if (wo.status === 'completed') return 'completed'
    const records = prodRecords.filter((r) => r.workOrderNo === wo.orderNo)
    const hasInspection = inspections.some((i) => i.referenceNo === wo.orderNo)
    if (hasInspection) return 'inspection'
    if (records.some((r) => r.stage === 'packaging')) return 'packaging'
    if (records.some((r) => r.stage === 'manufacturing')) return 'manufacturing'
    if (records.some((r) => r.stage === 'weighing')) return 'weighing'
    return 'planned'
  }

  const getProgress = (stage: string): number => {
    const idx = STAGES.findIndex((s) => s.key === stage)
    return Math.round(((idx + 1) / STAGES.length) * 100)
  }

  const stageCounts: Record<string, number> = {}
  STAGES.forEach((s) => { stageCounts[s.key] = 0 })
  activeOrders.forEach((wo) => { const s = getStage(wo); stageCounts[s] = (stageCounts[s] ?? 0) + 1 })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">공정 모니터링</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {STAGES.map((stage) => (
          <div key={stage.key} className="bg-white rounded-xl border p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{stage.label}</p>
            <p className="text-3xl font-bold text-gray-900">{stageCounts[stage.key]}</p>
            <Badge color={stage.color as 'gray' | 'blue' | 'purple' | 'yellow' | 'green'}>{stage.label}</Badge>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {activeOrders.slice(0, 20).map((wo) => {
          const stage = getStage(wo)
          const progress = getProgress(stage)
          const stageInfo = STAGES.find((s) => s.key === stage)
          return (
            <Card key={wo.id}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-gray-900">{wo.orderNo}</span>
                  <span className="text-gray-500 ml-2">{wo.productItemName}</span>
                  {wo.productionLine && <span className="text-xs text-gray-400 ml-2">({wo.productionLine})</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">{formatNumber(wo.plannedQuantity)} {wo.unit}</span>
                  <Badge color={stageInfo?.color as 'gray' | 'blue' | 'green'}>{stageInfo?.label ?? stage}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {STAGES.map((s, i) => {
                  const stageIdx = STAGES.findIndex((st) => st.key === stage)
                  const isActive = i <= stageIdx
                  const isCurrent = i === stageIdx
                  return (
                    <div key={s.key} className="flex-1">
                      <div className={`h-2 rounded-full ${isActive ? (isCurrent ? 'bg-teal-500 animate-pulse' : 'bg-teal-400') : 'bg-gray-200'}`} />
                      <p className={`text-[10px] mt-1 text-center ${isCurrent ? 'text-teal-700 font-semibold' : isActive ? 'text-teal-500' : 'text-gray-400'}`}>{s.label}</p>
                    </div>
                  )
                })}
              </div>
              {wo.plannedStartDate && (
                <p className="text-xs text-gray-400 mt-2">일정: {wo.plannedStartDate} ~ {wo.plannedEndDate ?? '미정'}<span className="ml-2 text-teal-600 font-medium">{progress}%</span></p>
              )}
            </Card>
          )
        })}
        {activeOrders.length === 0 && <Card><p className="text-sm text-gray-500 text-center py-8">진행중인 작업지시가 없습니다.</p></Card>}
      </div>
    </div>
  )
}
