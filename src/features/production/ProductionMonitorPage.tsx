import { orderBy, where } from 'firebase/firestore'
import { Card, Badge } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { formatNumber } from '@/utils/format'
import type { WorkOrder } from '@/types'
import type { BaseDocument } from '@/types'

/** 공정 단계 */
type ProductionStage = 'weighing' | 'manufacturing' | 'packaging'

const STAGE_LABEL: Record<ProductionStage, string> = {
  weighing: '칭량',
  manufacturing: '제조',
  packaging: '충진/포장',
}

const STAGE_ORDER: ProductionStage[] = ['weighing', 'manufacturing', 'packaging']

/** 생산기록 (공정 모니터링용 최소 타입) */
interface ProductionRecord extends BaseDocument {
  stage: ProductionStage
  workOrderNo: string
  status: string
}

/** 작업지시별 공정 진행 현황 계산 */
function calculateProgress(workOrderNo: string, records: ProductionRecord[]) {
  const related = records.filter((r) => r.workOrderNo === workOrderNo)
  const completedStages = new Set<ProductionStage>()
  let currentStage: ProductionStage | null = null

  for (const stage of STAGE_ORDER) {
    const stageRecords = related.filter((r) => r.stage === stage)
    if (stageRecords.length === 0) {
      if (!currentStage) currentStage = stage
      continue
    }
    const allCompleted = stageRecords.every((r) => r.status === 'completed')
    if (allCompleted) {
      completedStages.add(stage)
    } else {
      currentStage = stage
    }
  }

  const completedCount = completedStages.size
  const percentage = Math.round((completedCount / STAGE_ORDER.length) * 100)

  return { completedStages, currentStage, percentage }
}

export default function ProductionMonitorPage() {
  // 진행중 작업지시만 조회
  const { data: workOrders = [], isLoading: woLoading } = useCollection<WorkOrder>(
    'workOrders',
    [where('status', 'in', ['planned', 'in_progress']), orderBy('createdAt', 'desc')],
    ['active'],
  )

  // 모든 생산기록 조회
  const { data: records = [], isLoading: recLoading } = useCollection<ProductionRecord>(
    'productionRecords',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )

  const isLoading = woLoading || recLoading

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">공정모니터링</h1>
        <Badge color="blue">실시간</Badge>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-500">데이터를 불러오는 중...</div>
      )}

      {!isLoading && workOrders.length === 0 && (
        <Card>
          <div className="text-center py-12 text-gray-500">진행중인 작업지시가 없습니다.</div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workOrders.map((wo) => {
          const { completedStages, currentStage, percentage } = calculateProgress(wo.orderNo, records)

          return (
            <Card key={wo.id}>
              <div className="space-y-3">
                {/* 헤더 */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{wo.productItemName}</h3>
                    <p className="text-sm text-gray-500">{wo.orderNo}</p>
                  </div>
                  <Badge color={wo.status === 'in_progress' ? 'blue' : 'gray'}>
                    {wo.status === 'in_progress' ? '진행중' : '계획'}
                  </Badge>
                </div>

                {/* 수량 정보 */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">계획수량</span>
                  <span className="font-medium">{formatNumber(wo.plannedQuantity)} {wo.unit}</span>
                </div>
                {wo.actualQuantity != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">실적수량</span>
                    <span className="font-medium">{formatNumber(wo.actualQuantity)} {wo.unit}</span>
                  </div>
                )}

                {/* 일정 */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">계획기간</span>
                  <span className="text-gray-700">{wo.plannedStartDate} ~ {wo.plannedEndDate}</span>
                </div>

                {/* 생산라인 */}
                {wo.productionLine && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">생산라인</span>
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{wo.productionLine}</span>
                  </div>
                )}

                {/* 진행률 바 */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">공정 진행률</span>
                    <span className="font-semibold text-blue-600">{percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* 공정 단계 표시 */}
                <div className="flex gap-2">
                  {STAGE_ORDER.map((stage) => {
                    const isCompleted = completedStages.has(stage)
                    const isCurrent = currentStage === stage
                    let color: 'green' | 'blue' | 'gray' = 'gray'
                    if (isCompleted) color = 'green'
                    else if (isCurrent) color = 'blue'

                    return (
                      <Badge key={stage} color={color}>
                        {STAGE_LABEL[stage]}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
