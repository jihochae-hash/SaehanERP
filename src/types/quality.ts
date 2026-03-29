import type { BaseDocument } from './common'

/** 검사 유형 */
export type InspectionType = 'incoming' | 'process' | 'outgoing'

/** 검사 결과 */
export type InspectionResult = 'pass' | 'fail' | 'conditional_pass'

/** 검사 항목 */
export interface InspectionItem {
  name: string
  standard: string
  method?: string
  result: string
  judgement: 'pass' | 'fail'
  notes?: string
}

/** 품질검사 기록 (qualityInspections 컬렉션) */
export interface QualityInspection extends BaseDocument {
  inspectionNo: string
  type: InspectionType
  /** 검사 대상 품목 */
  itemId: string
  itemCode: string
  itemName: string
  lotNo: string
  /** 검사 수량 */
  sampleQuantity: number
  inspectionDate: string
  inspectorId?: string
  inspectorName?: string
  /** 검사 항목 목록 */
  items: InspectionItem[]
  /** 종합 판정 */
  overallResult: InspectionResult
  /** 연결된 발주/작업지시 */
  referenceType?: 'purchase' | 'workOrder' | 'shipment'
  referenceId?: string
  referenceNo?: string
  notes?: string
}

/** 부적합 상태 */
export type NonconformityStatus = 'open' | 'investigating' | 'corrective_action' | 'closed'

/** 부적합/CAPA (cgmpDocuments 컬렉션) */
export interface CgmpDocument extends BaseDocument {
  documentNo: string
  type: 'nonconformity' | 'capa' | 'deviation'
  title: string
  description: string
  /** 관련 검사 ID */
  relatedInspectionId?: string
  /** 관련 LOT */
  relatedLotNo?: string
  /** 근본 원인 */
  rootCause?: string
  /** 시정 조치 */
  correctiveAction?: string
  /** 예방 조치 */
  preventiveAction?: string
  /** 담당자 */
  assignedTo?: string
  assignedToName?: string
  /** 기한 */
  dueDate?: string
  completedDate?: string
  status: NonconformityStatus
}
