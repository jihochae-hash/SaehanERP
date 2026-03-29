export { ROLE_CONFIG, ROLE_OPTIONS } from './roles'

/** 세션 타임아웃 (8시간, 밀리초) */
export const SESSION_TIMEOUT = 28800 * 1000

/** 세션 체크 간격 (1분) */
export const SESSION_CHECK_INTERVAL = 60 * 1000

/** 페이지당 기본 행 수 */
export const DEFAULT_PAGE_SIZE = 20

/** LOT 번호 구분 코드 */
export const LOT_PREFIX = {
  raw_material: 'RM',
  sub_material: 'SM',
  semi_finished: 'SF',
  finished: 'FP',
  packaging: 'PK',
} as const

/** 사이드바 메뉴 구조 */
export const SIDEBAR_MENUS = [
  {
    id: 'dashboard',
    label: '대시보드',
    icon: 'LayoutDashboard',
    path: '/dashboard',
    module: null, // 모든 사용자
  },
  {
    id: 'master',
    label: '기초정보',
    icon: 'Database',
    children: [
      { id: 'items', label: '품목관리', path: '/master/items', module: 'inventory' as const },
      { id: 'partners', label: '거래처관리', path: '/master/partners', module: null },
      { id: 'warehouses', label: '창고관리', path: '/master/warehouses', module: 'inventory' as const },
    ],
  },
  {
    id: 'rnd',
    label: 'R&D / 처방',
    icon: 'Flask',
    children: [
      { id: 'ingredients', label: '원료 마스터', path: '/rnd/ingredients', module: 'rnd' as const },
      { id: 'formulas', label: '처방 관리', path: '/rnd/formulas', module: 'rnd' as const },
    ],
  },
  {
    id: 'production',
    label: '생산관리',
    icon: 'Factory',
    children: [
      { id: 'bom', label: 'BOM 관리', path: '/production/bom', module: 'production' as const },
      { id: 'work-orders', label: '작업지시서', path: '/production/work-orders', module: 'production' as const },
      { id: 'plans', label: '생산계획(MPS)', path: '/production/plans', module: 'production' as const },
    ],
  },
  {
    id: 'inventory',
    label: '재고관리',
    icon: 'Package',
    module: 'inventory' as const,
    children: [
      { id: 'inv-in', label: '입고처리', path: '/inventory/incoming', module: 'inventory' as const },
      { id: 'inv-out', label: '출고처리', path: '/inventory/outgoing', module: 'inventory' as const },
      { id: 'inv-stock', label: '재고현황', path: '/inventory/stock', module: 'inventory' as const },
      { id: 'inv-tx', label: '입출고이력', path: '/inventory/transactions', module: 'inventory' as const },
      { id: 'inv-lot', label: 'LOT추적', path: '/inventory/lot', module: 'inventory' as const },
    ],
  },
  {
    id: 'admin',
    label: '시스템관리',
    icon: 'Settings',
    ceoOnly: true,
    children: [
      { id: 'users', label: '사용자관리', path: '/admin/users', module: null },
      { id: 'audit', label: '감사로그', path: '/admin/audit', module: null },
    ],
  },
] as const
