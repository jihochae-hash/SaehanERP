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
  filling: 'FL',
  finished: 'FP',
  bulk: 'BK',
} as const

/** 사이드바 메뉴 구조 */
export const SIDEBAR_MENUS = [
  {
    id: 'dashboard',
    label: '대시보드',
    icon: 'LayoutDashboard',
    path: '/dashboard',
    module: null,
  },
  {
    id: 'master',
    label: '기초정보',
    icon: 'Database',
    children: [
      { id: 'items', label: '품목관리', path: '/master/items', module: 'inventory' as const },
      { id: 'partners', label: '거래처관리', path: '/master/partners', module: null },
      { id: 'warehouses', label: '창고관리', path: '/master/warehouses', module: 'inventory' as const },
      { id: 'item-settings', label: '품목구분 설정', path: '/master/item-settings', module: null },
    ],
  },
  {
    id: 'sales',
    label: '영업관리',
    icon: 'TrendingUp',
    children: [
      { id: 'quotation', label: '견적관리', path: '/sales/quotations', module: 'sales' as const },
      { id: 'sales-order', label: '수주관리', path: '/sales/orders', module: 'sales' as const },
      { id: 'shipment', label: '출하관리', path: '/sales/shipments', module: 'sales' as const },
      { id: 'statement', label: '거래명세서', path: '/sales/statements', module: 'sales' as const },
      { id: 'sales-analysis', label: '매출현황', path: '/sales/analysis', module: 'sales' as const },
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
      { id: 'plans', label: '생산계획(MPS)', path: '/production/plans', module: 'production' as const },
      { id: 'work-orders', label: '작업지시서', path: '/production/work-orders', module: 'production' as const },
      { id: 'bom', label: 'BOM 관리', path: '/production/bom', module: 'production' as const },
      { id: 'weighing', label: '칭량관리(POP)', path: '/production/weighing', module: 'production' as const },
      { id: 'manufacturing', label: '제조실적', path: '/production/manufacturing', module: 'production' as const },
      { id: 'packaging', label: '충진/포장', path: '/production/packaging', module: 'production' as const },
      { id: 'monitor', label: '공정모니터링', path: '/production/monitor', module: 'production' as const },
    ],
  },
  {
    id: 'purchasing',
    label: '구매관리',
    icon: 'ShoppingCart',
    children: [
      { id: 'po', label: '발주서 관리', path: '/purchasing/orders', module: 'purchasing' as const },
      { id: 'mrp', label: 'MRP 소요량', path: '/purchasing/mrp', module: 'mrp' as const },
    ],
  },
  {
    id: 'quality',
    label: '품질관리',
    icon: 'ClipboardCheck',
    children: [
      { id: 'inspection', label: '품질검사', path: '/quality/inspections', module: 'quality' as const },
      { id: 'capa', label: '부적합/CAPA', path: '/quality/capa', module: 'quality' as const },
      { id: 'cgmp', label: 'CGMP 문서', path: '/quality/cgmp', module: 'quality' as const },
    ],
  },
  {
    id: 'inventory',
    label: '재고관리',
    icon: 'Package',
    children: [
      { id: 'inv-in', label: '입고처리', path: '/inventory/incoming', module: 'inventory' as const },
      { id: 'inv-out', label: '출고처리', path: '/inventory/outgoing', module: 'inventory' as const },
      { id: 'inv-stock', label: '재고현황', path: '/inventory/stock', module: 'inventory' as const },
      { id: 'inv-tx', label: '입출고이력', path: '/inventory/transactions', module: 'inventory' as const },
      { id: 'inv-transfer', label: '창고이동', path: '/inventory/transfer', module: 'inventory' as const },
      { id: 'inv-ledger', label: '수불부', path: '/inventory/ledger', module: 'inventory' as const },
      { id: 'inv-count', label: '재고실사', path: '/inventory/count', module: 'inventory' as const },
      { id: 'inv-safety', label: '안전재고알림', path: '/inventory/safety-stock', module: 'inventory' as const },
      { id: 'inv-lot', label: 'LOT추적', path: '/inventory/lot', module: 'inventory' as const },
    ],
  },
  {
    id: 'crm',
    label: 'CRM / A/S',
    icon: 'Users',
    children: [
      { id: 'contact-log', label: '연락/활동기록', path: '/crm/contacts', module: 'crm' as const },
      { id: 'customer-grade', label: '고객등급관리', path: '/crm/grades', module: 'crm' as const },
      { id: 'service-request', label: 'A/S 접수/처리', path: '/crm/service', module: 'crm' as const },
    ],
  },
  {
    id: 'cost',
    label: '원가관리',
    icon: 'Calculator',
    children: [
      { id: 'cost-calc', label: '원가산출', path: '/cost/calculation', module: 'cost' as const },
    ],
  },
  {
    id: 'outsourcing',
    label: '외주관리',
    icon: 'Truck',
    children: [
      { id: 'outsource-order', label: '외주발주/입고', path: '/outsourcing/orders', module: 'outsourcing' as const },
    ],
  },
  {
    id: 'accounting',
    label: '회계/세무',
    icon: 'BookOpen',
    children: [
      { id: 'journal', label: '전표입력', path: '/accounting/journal', module: 'accounting' as const },
      { id: 'financial', label: '재무제표', path: '/accounting/financial', module: 'accounting' as const },
      { id: 'tax-invoice', label: '세금계산서', path: '/accounting/tax-invoice', module: 'tax' as const },
    ],
  },
  {
    id: 'hr',
    label: '인사/급여',
    icon: 'UserCircle',
    children: [
      { id: 'employees', label: '사원정보', path: '/hr/employees', module: 'hr' as const },
      { id: 'attendance', label: '근태관리', path: '/hr/attendance', module: 'hr' as const },
      { id: 'payroll', label: '급여관리', path: '/hr/payroll', module: 'payroll' as const },
    ],
  },
  {
    id: 'equipment',
    label: '설비관리',
    icon: 'Wrench',
    children: [
      { id: 'equip-list', label: '설비대장', path: '/equipment/list', module: 'equipment' as const },
      { id: 'maintenance', label: '정비/고장이력', path: '/equipment/maintenance', module: 'equipment' as const },
    ],
  },
  {
    id: 'approval',
    label: '전자결재',
    icon: 'FileCheck',
    children: [
      { id: 'approval-req', label: '결재요청/처리', path: '/approval/requests', module: 'approval' as const },
    ],
  },
  {
    id: 'contract',
    label: '전자계약',
    icon: 'FileSignature',
    children: [
      { id: 'contract-list', label: '계약관리', path: '/contract/list', module: 'contract' as const },
    ],
  },
  {
    id: 'groupware',
    label: '그룹웨어',
    icon: 'MessageSquare',
    children: [
      { id: 'notice', label: '게시판', path: '/groupware/notice', module: 'groupware' as const },
      { id: 'schedule', label: '일정관리', path: '/groupware/schedule', module: null },
      { id: 'fileshare', label: '파일공유', path: '/groupware/files', module: 'groupware' as const },
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
