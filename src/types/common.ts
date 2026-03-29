/** Firestore 문서 공통 필드 */
export interface BaseDocument {
  id: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

/** 페이지네이션 */
export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** 정렬 */
export interface SortParams {
  field: string
  direction: 'asc' | 'desc'
}

/** 필터 */
export interface FilterParams {
  field: string
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains'
  value: unknown
}

/** API 응답 래퍼 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/** 선택 옵션 (Select, Dropdown 등) */
export interface SelectOption {
  label: string
  value: string
}

/** 테이블 컬럼 정의 */
export interface TableColumn<T = unknown> {
  key: string
  label: string
  width?: string
  sortable?: boolean
  render?: (value: unknown, row: T) => React.ReactNode
}
