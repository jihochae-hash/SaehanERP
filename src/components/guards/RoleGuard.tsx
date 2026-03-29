import { useAuthStore } from '@/stores/auth'
import type { ModuleCode } from '@/types'

interface RoleGuardProps {
  children: React.ReactNode
  module?: ModuleCode
  ceoOnly?: boolean
  fallback?: React.ReactNode
}

/** 역할/모듈 기반 접근 제어. 권한 없으면 fallback 표시 */
export default function RoleGuard({ children, module, ceoOnly, fallback }: RoleGuardProps) {
  const { hasModule, isCeo } = useAuthStore()

  if (ceoOnly && !isCeo()) {
    return <>{fallback ?? <AccessDenied />}</>
  }

  if (module && !hasModule(module)) {
    return <>{fallback ?? <AccessDenied />}</>
  }

  return <>{children}</>
}

function AccessDenied() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">접근 권한이 없습니다</h2>
        <p className="text-gray-500">관리자에게 문의하세요.</p>
      </div>
    </div>
  )
}
