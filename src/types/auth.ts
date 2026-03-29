/** 사용자 역할 */
export type UserRole =
  | 'ceo'
  | 'researcher'
  | 'prod_manager'
  | 'warehouse'
  | 'purchaser'
  | 'sales'
  | 'accountant'
  | 'staff'

/** 접근 권한 레벨 */
export type AccessLevel = 1 | 2 | 3

/** 모듈 코드 */
export type ModuleCode =
  | 'rnd'
  | 'inventory'
  | 'production'
  | 'purchasing'
  | 'mrp'
  | 'quality'
  | 'sales'
  | 'crm'
  | 'cost'
  | 'outsourcing'
  | 'accounting'
  | 'tax'
  | 'banking'
  | 'hr'
  | 'payroll'
  | 'equipment'
  | 'approval'
  | 'groupware'
  | 'messenger'
  | 'contract'
  | 'dashboard'
  | 'scale'

/** Firebase Custom Claims 구조 */
export interface UserClaims {
  role: UserRole
  level: AccessLevel
  modules: ModuleCode[]
}

/** Firestore users 컬렉션 문서 */
export interface UserProfile {
  uid: string
  email: string
  displayName: string
  department?: string
  position?: string
  phone?: string
  photoURL?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** 인증 상태 */
export interface AuthState {
  user: UserProfile | null
  claims: UserClaims | null
  isLoading: boolean
  isAuthenticated: boolean
}

/** 로그인 요청 */
export interface LoginRequest {
  email: string
  password: string
}
