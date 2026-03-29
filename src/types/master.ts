import type { BaseDocument } from './common'

/**
 * 품목 유형
 * 코드 첫자리와 매핑: 1:제품, 2:원자재, 3:부자재, 4:충진품, 5:벌크, 6:상품, 9:기타
 */
export type ItemType = 'finished' | 'raw_material' | 'sub_material' | 'filling' | 'bulk' | 'merchandise' | 'other'

/** 품목유형 코드 매핑 */
export const ITEM_TYPE_CODE: Record<ItemType, string> = {
  finished: '1',
  raw_material: '2',
  sub_material: '3',
  filling: '4',
  bulk: '5',
  merchandise: '6',
  other: '9',
}

/** 품목유형 라벨 */
export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  finished: '제품',
  raw_material: '원자재',
  sub_material: '부자재',
  filling: '충진품',
  bulk: '벌크',
  merchandise: '상품',
  other: '기타',
}

/** 단위 */
export type UnitType = 'kg' | 'g' | 'L' | 'mL' | 'ea' | 'box' | 'set' | 'pack'

/**
 * 품목 마스터 (items 컬렉션)
 * 코드 형식: ABBB-CCCCCD
 *   A: 품목구분(1~9), BBB: 고객사 약칭(3자리 알파벳), CCCCC: 순차번호(5자리), D: Sub번호(A~Z)
 */
export interface Item extends BaseDocument {
  /** 품목코드 (ABBB-CCCCCD 형식, 시스템 내 유일) */
  code: string
  name: string
  type: ItemType
  unit: UnitType
  specification?: string
  barcode?: string
  category?: string
  /** 고객사 약칭 (코드의 BBB 부분) */
  customerAbbr?: string
  safetyStock?: number
  leadTimeDays?: number
  defaultWarehouseId?: string
  /** LOT번호 관리 여부 — false이면 LOT 없이 입출고 가능 */
  requiresLotTracking: boolean
  isActive: boolean
}

/** 거래처 유형 */
export type PartnerType = 'supplier' | 'customer' | 'both'

/** 거래처 마스터 (partners 컬렉션) */
export interface Partner extends BaseDocument {
  code: string
  name: string
  type: PartnerType
  businessNo?: string
  representative?: string
  address?: string
  phone?: string
  fax?: string
  email?: string
  contactPerson?: string
  contactPhone?: string
  bankName?: string
  bankAccount?: string
  notes?: string
  isActive: boolean
}

/** 창고 마스터 (warehouses 컬렉션) */
export interface Warehouse extends BaseDocument {
  code: string
  name: string
  location?: string
  managerUid?: string
  isActive: boolean
}

/** 계정과목 (accounts 컬렉션) */
export interface Account extends BaseDocument {
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  parentCode?: string
  level: number
  isActive: boolean
}
