import type { BaseDocument } from './common'

/** 품목 유형 */
export type ItemType = 'raw_material' | 'sub_material' | 'semi_finished' | 'finished' | 'packaging'

/** 단위 */
export type UnitType = 'kg' | 'g' | 'L' | 'mL' | 'ea' | 'box' | 'set' | 'pack'

/** 품목 마스터 (items 컬렉션) */
export interface Item extends BaseDocument {
  code: string
  name: string
  type: ItemType
  unit: UnitType
  specification?: string
  barcode?: string
  category?: string
  safetyStock?: number
  leadTimeDays?: number
  defaultWarehouseId?: string
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
