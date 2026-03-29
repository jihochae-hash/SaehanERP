import type { UserRole, ModuleCode, AccessLevel } from '@/types'

/** 역할별 기본 설정 */
export const ROLE_CONFIG = {
  ceo: {
    label: '대표이사',
    level: 3 as AccessLevel,
    modules: [] as ModuleCode[], // 전체 접근
  },
  researcher: {
    label: '연구원',
    level: 2 as AccessLevel,
    modules: ['rnd', 'quality'] as ModuleCode[],
  },
  prod_manager: {
    label: '생산관리자',
    level: 2 as AccessLevel,
    modules: ['production', 'inventory', 'quality', 'equipment'] as ModuleCode[],
  },
  warehouse: {
    label: '창고관리자',
    level: 2 as AccessLevel,
    modules: ['inventory'] as ModuleCode[],
  },
  purchaser: {
    label: '구매담당',
    level: 2 as AccessLevel,
    modules: ['purchasing', 'inventory', 'mrp'] as ModuleCode[],
  },
  sales: {
    label: '영업담당',
    level: 2 as AccessLevel,
    modules: ['sales', 'crm'] as ModuleCode[],
  },
  accountant: {
    label: '경리/회계',
    level: 2 as AccessLevel,
    modules: ['accounting', 'tax', 'banking', 'payroll', 'hr'] as ModuleCode[],
  },
  staff: {
    label: '일반직원',
    level: 1 as AccessLevel,
    modules: ['groupware', 'messenger'] as ModuleCode[],
  },
} as const satisfies Record<UserRole, { label: string; level: AccessLevel; modules: ModuleCode[] }>

/** 역할 선택 옵션 */
export const ROLE_OPTIONS = Object.entries(ROLE_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
}))
