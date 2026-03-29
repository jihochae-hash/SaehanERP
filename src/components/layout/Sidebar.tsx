import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { SIDEBAR_MENUS } from '@/constants'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { claims } = useAuthStore()
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set(['master', 'inventory']))

  const isCeo = claims?.role === 'ceo'

  /** 모듈 접근 권한 확인 */
  const hasAccess = (module: string | null | undefined): boolean => {
    if (!module) return true // null이면 모든 사용자 접근 가능
    if (isCeo) return true
    return claims?.modules?.includes(module as never) ?? false
  }

  const toggleExpand = (id: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleNavigate = (path: string) => {
    navigate(path)
    onClose()
  }

  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-60 bg-gray-900 text-white
          transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* 로고 */}
        <div className="h-14 flex items-center px-5 border-b border-gray-700">
          <h1 className="text-lg font-bold tracking-wide">새한 ERP</h1>
        </div>

        {/* 메뉴 */}
        <nav className="py-3 overflow-y-auto h-[calc(100%-3.5rem)]">
          {SIDEBAR_MENUS.map((menu) => {
            // CEO 전용 메뉴 체크
            if ('ceoOnly' in menu && menu.ceoOnly && !isCeo) return null
            // 모듈 접근 권한 체크
            if ('module' in menu && !hasAccess(menu.module)) return null

            // 자식 메뉴가 있는 경우
            if ('children' in menu && menu.children) {
              const visibleChildren = menu.children.filter((child) => hasAccess(child.module))
              if (visibleChildren.length === 0) return null
              const isExpanded = expandedMenus.has(menu.id)

              return (
                <div key={menu.id}>
                  <button
                    onClick={() => toggleExpand(menu.id)}
                    className="w-full flex items-center justify-between px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    <span>{menu.label}</span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="bg-gray-950">
                      {visibleChildren.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => handleNavigate(child.path)}
                          className={`
                            w-full text-left px-8 py-2 text-sm transition-colors
                            ${location.pathname === child.path
                              ? 'text-blue-400 bg-gray-800'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800'}
                          `}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            // 단일 메뉴
            return (
              <button
                key={menu.id}
                onClick={() => 'path' in menu && handleNavigate(menu.path)}
                className={`
                  w-full text-left px-5 py-2.5 text-sm transition-colors
                  ${('path' in menu && location.pathname === menu.path)
                    ? 'text-blue-400 bg-gray-800'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'}
                `}
              >
                {menu.label}
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
