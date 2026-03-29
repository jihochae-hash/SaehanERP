import type { BaseDocument } from './common'
import type { UnitType } from './master'

/** 재고 트랜잭션 유형 */
export type TransactionType =
  | 'incoming'        // 입고
  | 'outgoing'        // 출고
  | 'transfer_out'    // 창고이동 출고
  | 'transfer_in'     // 창고이동 입고
  | 'adjustment_plus' // 조정 (증가)
  | 'adjustment_minus'// 조정 (감소)
  | 'return'          // 반품

/** 입고 구분 */
export type IncomingType = 'purchase' | 'production' | 'return' | 'transfer' | 'other'

/** 출고 구분 */
export type OutgoingType = 'sales' | 'production' | 'disposal' | 'sample' | 'transfer' | 'other'

/**
 * WMS 재고 데이터 (inventory 컬렉션 - Cloud Functions만 쓰기)
 * 단일 WMS 체계: 모든 재고는 반드시 창고+위치 정보를 가진다
 */
export interface Inventory extends BaseDocument {
  itemId: string
  itemCode: string
  itemName: string
  warehouseId: string
  warehouseName: string
  /** WMS 위치 코드 (필수 — 예: A-01-03, 파레트-12) */
  location: string
  lotNo: string
  quantity: number
  unit: UnitType
  expiryDate?: string
  manufactureDate?: string
  /** 바코드 (품목 바코드 또는 LOT 바코드) */
  barcode?: string
}

/** 창고이동 상태 */
export type TransferStatus = 'in_transit' | 'completed' | 'cancelled'

/**
 * 창고이동 (warehouseTransfers 컬렉션)
 * 출발 창고에서 출고 → 이동중 → 도착 창고에서 입고 확인
 */
export interface WarehouseTransfer extends BaseDocument {
  transferNo: string
  status: TransferStatus
  /** 출발 */
  fromWarehouseId: string
  fromWarehouseName: string
  /** 도착 */
  toWarehouseId: string
  toWarehouseName: string
  /** 이동 품목 목록 */
  items: TransferItem[]
  /** 출고일시 */
  shippedAt: string
  shippedBy: string
  /** 입고확인 일시 */
  receivedAt?: string
  receivedBy?: string
  notes?: string
}

/** 이동 품목 항목 */
export interface TransferItem {
  itemId: string
  itemCode: string
  itemName: string
  lotNo: string
  quantity: number
  unit: string
  /** 바코드 스캔 여부 */
  scannedOut: boolean
  scannedIn: boolean
  /** 출발 위치 */
  fromLocation: string
  /** 도착 위치 (입고 시 지정) */
  toLocation?: string
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
  /** WMS 위치 */
  location?: string
  notes?: string
}

/** 입출고 요청 (클라이언트 → Cloud Function) */
export interface InventoryTxRequest {
  type: TransactionType
  itemId: string
  warehouseId: string
  lotNo?: string
  quantity: number
  /** WMS 위치 (필수) */
  location?: string
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
