import type { BaseDocument } from './common'

/** 원료 마스터 (ingredients 컬렉션) */
export interface Ingredient extends BaseDocument {
  code: string
  nameKo: string
  nameEn: string
  inciName: string
  casNo?: string
  supplier?: string
  category?: string
  /** 금지 성분 여부 */
  isProhibited: boolean
  /** 배합한도 (%, null이면 제한 없음) */
  maxUsagePercent?: number | null
  /** EU 알러젠 여부 (81종) */
  isAllergen: boolean
  /** 알러젠 유형 (화학물질/자연추출물질) */
  allergenType?: 'chemical' | 'natural' | null
  /** Leave-on 표기 기준 (%) */
  allergenLeaveOnThreshold?: number | null
  /** Rinse-off 표기 기준 (%) */
  allergenRinseOffThreshold?: number | null
  /** 기능 */
  function?: string
  /** 비고 */
  notes?: string
  isActive: boolean
}

/** 처방 상태 */
export type FormulaStatus = 'draft' | 'review' | 'approved' | 'archived'

/** 처방 제품 유형 */
export type ProductCategory = 'skincare' | 'makeup' | 'haircare' | 'bodycare' | 'suncare' | 'cleansing' | 'other'

/** 처방 사용 유형 */
export type ProductUsageType = 'leave_on' | 'rinse_off'

/** 처방 성분 항목 */
export interface FormulaIngredient {
  ingredientId: string
  ingredientCode: string
  nameKo: string
  nameEn: string
  inciName: string
  /** 배합 비율 (%) */
  percentage: number
  /** 기능/용도 */
  purpose?: string
}

/** 처방 데이터 (formulas 컬렉션) */
export interface Formula extends BaseDocument {
  code: string
  name: string
  version: number
  status: FormulaStatus
  category: ProductCategory
  usageType: ProductUsageType
  /** 처방 성분 목록 */
  composition: FormulaIngredient[]
  /** 총 배합 비율 (100%여야 함) */
  totalPercentage: number
  /** 제조 메모 */
  manufacturingNotes?: string
  /** 설명 */
  description?: string
  /** 이전 버전 ID */
  previousVersionId?: string | null
}

/** 성분 검증 결과 항목 */
export interface VerificationIssue {
  type: 'prohibited' | 'limit_exceeded' | 'allergen_labeling'
  ingredientCode: string
  ingredientName: string
  message: string
  severity: 'error' | 'warning'
}

/** BOM 자재 항목 */
export interface BomItem {
  itemId: string
  itemCode: string
  itemName: string
  unit: string
  /** 기준 생산량 대비 소요량 */
  quantity: number
  /** 손실률 (%) */
  lossRate: number
  notes?: string
}

/** BOM (boms 컬렉션) */
export interface Bom extends BaseDocument {
  /** 완제품 품목 ID */
  productItemId: string
  productItemCode: string
  productItemName: string
  /** 기준 생산량 */
  baseQuantity: number
  baseUnit: string
  /** 연결된 처방 ID */
  formulaId?: string
  /** BOM 자재 목록 */
  items: BomItem[]
  version: number
  isActive: boolean
}

/** 작업지시 상태 */
export type WorkOrderStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

/** 작업지시서 (workOrders 컬렉션) */
export interface WorkOrder extends BaseDocument {
  /** 작업지시 번호 */
  orderNo: string
  /** 생산 품목 */
  productItemId: string
  productItemCode: string
  productItemName: string
  /** BOM ID */
  bomId: string
  /** 생산 수량 */
  plannedQuantity: number
  actualQuantity?: number
  unit: string
  /** 계획 일자 */
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate?: string
  actualEndDate?: string
  status: WorkOrderStatus
  /** 배정 라인/탱크 */
  productionLine?: string
  /** 작업자 */
  assignedTo?: string
  notes?: string
}

/** 생산계획 (productionPlans 컬렉션) */
export interface ProductionPlan extends BaseDocument {
  /** 계획명 */
  name: string
  /** 계획 기간 */
  startDate: string
  endDate: string
  /** 계획 품목 목록 */
  items: ProductionPlanItem[]
  status: 'draft' | 'confirmed' | 'completed'
  notes?: string
}

/** 생산계획 품목 */
export interface ProductionPlanItem {
  productItemId: string
  productItemCode: string
  productItemName: string
  plannedQuantity: number
  unit: string
  /** 연결된 작업지시 ID */
  workOrderId?: string
}
