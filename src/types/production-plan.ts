import type { BaseDocument } from './common'

/**
 * 생산계획 원부자재입고현황 모듈 타입 정의
 * 기존 독립 프로그램의 데이터 구조를 ERP에 맞게 정의
 */

// ─── 자재 입고 상태 ───
export type MaterialStatus = 'pending' | 'ordered' | 'in_transit' | 'received' | 'in_stock' | 'special' | 'deleted'

export const MATERIAL_STATUS_LABEL: Record<MaterialStatus, string> = {
  pending: '미입고',
  ordered: '발주완료',
  in_transit: '입고예정',
  received: '입고완료',
  in_stock: '재고있음',
  special: '별도처리',
  deleted: '삭제',
}

export const MATERIAL_STATUS_COLOR: Record<MaterialStatus, string> = {
  pending: 'red',
  ordered: 'yellow',
  in_transit: 'blue',
  received: 'green',
  in_stock: 'green',
  special: 'purple',
  deleted: 'gray',
}

// ─── BOM 데이터 (엑셀 업로드용 플랫 구조) ───
export interface PlanBomRow {
  productCode: string
  productName: string
  matCode: string
  matName: string
  matQty: number
  /** 생산 | 구매 | 사급 */
  matType: string
}

// ─── 수주 (Production Order) ───
export interface ProductionOrder extends BaseDocument {
  /** 완제품 코드 */
  productCode: string
  productName: string
  /** 규격 (g) */
  spec: number
  /** 비중 */
  density: number
  /** 주문 수량 */
  qty: number
  /** 납기일 */
  dueDate: string
  /** 고객사 */
  customer: string
  /** 수주번호 */
  orderNo: string
  /** 비고 */
  note: string
  /** 1개당 충진량 (g) = spec × density */
  fillPerUnit: number
  /** 총 충진량 (g) = fillPerUnit × qty */
  totalFill: number
  /** 벌크 제조일 */
  bulkDate: string
}

// ─── 수주별 부자재 입고 상태 ───
export interface OrderMaterial extends BaseDocument {
  orderId: string
  matCode: string
  matName: string
  matQty: number
  /** 생산 | 구매 | 사급 */
  matType: string
  status: MaterialStatus
  /** 입고 예정일 */
  eta: string
  /** 입고일 */
  receivedDate: string
  note: string
}

// ─── 벌크 입고 상태 (5번 코드, 제품별이 아닌 벌크별 통합) ───
export interface BulkStatus extends BaseDocument {
  matCode: string
  matName: string
  status: MaterialStatus
  eta: string
  receivedDate: string
  note: string
}

// ─── 일정 타입 ───
export type ScheduleWorkType = 'bulk' | 'fill+pack' | 'fill' | 'pack' | 'label'

export const WORK_TYPE_LABEL: Record<ScheduleWorkType, string> = {
  bulk: '벌크 제조',
  'fill+pack': '충진+포장',
  fill: '충진',
  pack: '포장',
  label: '라벨링',
}

export const WORK_TYPE_COLOR: Record<ScheduleWorkType, { bg: string; border: string; text: string }> = {
  bulk: { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-700' },
  'fill+pack': { bg: 'bg-teal-50', border: 'border-teal-500', text: 'text-teal-700' },
  fill: { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-700' },
  pack: { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-700' },
  label: { bg: 'bg-gray-50', border: 'border-gray-500', text: 'text-gray-700' },
}

// ─── 제조일정 (벌크 제조 캘린더) ───
export interface MfgSchedule extends BaseDocument {
  /** 연결된 수주 ID 목록 (콤마 구분) */
  orderIds: string
  /** 제품 정보 표시용 */
  productInfo: string
  /** 일정 날짜 (YYYY-MM-DD) */
  date: string
  /** 작업 유형 — 제조일정에서는 항상 'bulk' */
  workType: 'bulk'
  /** 벌크 그룹 (같은 벌크를 공유하는 주문 묶음) */
  bulkGroup: string
  /** 수량 정보 표시용 */
  qtyInfo: string
  /** 생산 라인/탱크 */
  line: string
}

// ─── 충포장일정 (충진/포장 캘린더) ───
export interface FpSchedule extends BaseDocument {
  /** 연결된 수주 ID 목록 (콤마 구분) */
  orderIds: string
  /** 제품 정보 표시용 */
  productInfo: string
  /** 일정 날짜 (YYYY-MM-DD) */
  date: string
  /** 작업 유형 */
  workType: ScheduleWorkType
  /** 벌크 그룹 */
  bulkGroup: string
  /** 수량 정보 표시용 */
  qtyInfo: string
  /** 생산 라인 */
  line: string
}

// ─── 비중 데이터 (로컬 저장) ───
export interface SgData {
  [bulkName: string]: number
}

// ─── 벌크 중심 주문 등록 폼 ───
export interface BulkOrderProduct {
  code: string
  name: string
  spec: number
  qty: number
  density: number
  customer: string
  dueDate: string
  orderNo: string
  note: string
}

// ─── 주문의 입고 진행률 계산용 ───
export interface OrderWithMaterials extends ProductionOrder {
  materials: OrderMaterial[]
  bulkMaterials: {
    matCode: string
    matName: string
    matQty: number
    status: MaterialStatus
    eta: string
    receivedDate: string
  }[]
}

// ─── Resolved BOM 결과 ───
export interface ResolvedBom {
  bulks: PlanBomRow[]
  materials: PlanBomRow[]
}
