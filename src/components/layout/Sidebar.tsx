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

  const hasAccess = (module: string | null | undefined): boolean => {
    if (!module) return true
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
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-60 bg-slate-900 text-white
          transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* 로고 */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-slate-700/50">
          <img src="/logo.png" alt="새한화장품" className="w-8 h-8 brightness-0 invert opacity-90" />
          <h1 className="text-base font-semibold tracking-wide text-white/90">Saehan ERP</h1>
        </div>

        {/* 메뉴 */}
        <nav className="py-3 overflow-y-auto h-[calc(100%-3.5rem)]">
          {SIDEBAR_MENUS.map((menu) => {
            if ('ceoOnly' in menu && menu.ceoOnly && !isCeo) return null
            if ('module' in menu && !hasAccess(menu.module)) return null

            if ('children' in menu && menu.children) {
              const visibleChildren = menu.children.filter((child) => hasAccess(child.module))
              if (visibleChildren.length === 0) return null
              const isExpanded = expandedMenus.has(menu.id)

              return (
                <div key={menu.id}>
                  <button
                    onClick={() => toggleExpand(menu.id)}
                    className="w-full flex items-center justify-between px-5 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
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
                    <div>
                      {visibleChildren.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => handleNavigate(child.path)}
                          className={`
                            w-full text-left px-8 py-2 text-sm transition-colors
                            ${location.pathname === child.path
                              ? 'text-teal-400 bg-teal-500/10 border-r-2 border-teal-400'
                              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}
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

            return (
              <button
                key={menu.id}
                onClick={() => 'path' in menu && handleNavigate(menu.path)}
                className={`
                  w-full text-left px-5 py-2.5 text-sm transition-colors
                  ${('path' in menu && location.pathname === menu.path)
                    ? 'text-teal-400 bg-teal-500/10 border-r-2 border-teal-400'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'}
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
