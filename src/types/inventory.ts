import type { BaseDocument } from './common'
import type { UnitType } from './master'

/** 재고 트랜잭션 유형 */
export type TransactionType =
  | 'incoming'        // 입고
  | 'outgoing'        // 출고
  | 'transfer'        // 이동
  | 'adjustment_plus' // 조정 (증가)
  | 'adjustment_minus'// 조정 (감소)
  | 'return'          // 반품

/** 입고 구분 */
export type IncomingType = 'purchase' | 'production' | 'return' | 'other'

/** 출고 구분 */
export type OutgoingType = 'sales' | 'production' | 'disposal' | 'sample' | 'other'

/** 재고 데이터 (inventory 컬렉션 - Cloud Functions만 쓰기) */
export interface Inventory extends BaseDocument {
  itemId: string
  itemCode: string
  itemName: string
  warehouseId: string
  warehouseName: string
  lotNo: string
  quantity: number
  unit: UnitType
  expiryDate?: string
  manufactureDate?: string
  location?: string
}

/** 재고 트랜잭션 (inventoryTransactions 컬렉션 - Cloud Functions만 쓰기) */
export interface InventoryTransaction extends BaseDocument {
  type: TransactionType
  itemId: string
  itemCode: string
  itemName: string
  warehouseId: string
  warehouseName: string
  lotNo: string
  quantity: number
  unit: UnitType
  incomingType?: IncomingType
  outgoingType?: OutgoingType
  referenceNo?: string
  referenceType?: string
  fromWarehouseId?: string
  toWarehouseId?: string
  notes?: string
}

/** 입출고 요청 (클라이언트 → Cloud Function) */
export interface InventoryTxRequest {
  type: TransactionType
  itemId: string
  warehouseId: string
  lotNo?: string
  quantity: number
  incomingType?: IncomingType
  outgoingType?: OutgoingType
  referenceNo?: string
  referenceType?: string
  fromWarehouseId?: string
  toWarehouseId?: string
  expiryDate?: string
  manufactureDate?: string
  notes?: string
}
