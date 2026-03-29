import type { BaseDocument } from './common'

/** 발주 상태 */
export type PurchaseOrderStatus = 'draft' | 'approved' | 'ordered' | 'partial_received' | 'received' | 'cancelled'

/** 발주 품목 항목 */
export interface PurchaseOrderItem {
  itemId: string
  itemCode: string
  itemName: string
  unit: string
  quantity: number
  unitPrice: number
  amount: number
  receivedQuantity?: number
  notes?: string
}

/** 발주서 (purchaseOrders 컬렉션) */
export interface PurchaseOrder extends BaseDocument {
  orderNo: string
  partnerId: string
  partnerName: string
  orderDate: string
  expectedDate: string
  status: PurchaseOrderStatus
  items: PurchaseOrderItem[]
  totalAmount: number
  notes?: string
}

/** 구매입고 (purchaseReceipts 컬렉션) */
export interface PurchaseReceipt extends BaseDocument {
  receiptNo: string
  purchaseOrderId: string
  purchaseOrderNo: string
  partnerId: string
  partnerName: string
  receiptDate: string
  items: PurchaseReceiptItem[]
  notes?: string
}

export interface PurchaseReceiptItem {
  itemId: string
  itemCode: string
  itemName: string
  unit: string
  orderedQuantity: number
  receivedQuantity: number
  lotNo?: string
  notes?: string
}

/** MRP 산출 결과 항목 */
export interface MrpResultItem {
  itemId: string
  itemCode: string
  itemName: string
  unit: string
  /** 총 소요량 */
  requiredQuantity: number
  /** 현재 재고 */
  currentStock: number
  /** 부족 수량 */
  shortageQuantity: number
  /** 발주 추천 여부 */
  needsOrder: boolean
  /** 리드타임 (일) */
  leadTimeDays?: number
}

/** MRP 산출 결과 (mrpResults 컬렉션) */
export interface MrpResult extends BaseDocument {
  name: string
  calculatedAt: string
  /** 기준 기간 */
  startDate: string
  endDate: string
  items: MrpResultItem[]
  status: 'calculated' | 'confirmed' | 'ordered'
}
