import { useState, useMemo, useRef, useEffect } from 'react'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

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
    setSearchQuery('')
    onClose()
  }

  // Ctrl+K 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape' && searchFocused) {
        setSearchQuery('')
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchFocused])

  // 검색 결과: 메뉴명/경로에서 검색
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase()
    const results: { parentLabel: string; label: string; path: string }[] = []

    SIDEBAR_MENUS.forEach(menu => {
      if ('ceoOnly' in menu && menu.ceoOnly && !isCeo) return
      if ('module' in menu && !hasAccess(menu.module)) return

      if ('children' in menu && menu.children) {
        menu.children.forEach(child => {
          if (!hasAccess(child.module)) return
          const match = child.label.toLowerCase().includes(q) || menu.label.toLowerCase().includes(q) || child.path.toLowerCase().includes(q)
          if (match) {
            results.push({ parentLabel: menu.label, label: child.label, path: child.path })
          }
        })
      } else if ('path' in menu) {
        const match = menu.label.toLowerCase().includes(q) || menu.path.toLowerCase().includes(q)
        if (match) {
          results.push({ parentLabel: '', label: menu.label, path: menu.path })
        }
      }
    })
    return results
  }, [searchQuery, isCeo, claims])

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

        {/* 검색 */}
        <div className="px-3 py-2 border-b border-slate-700/30">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder="메뉴 검색 (Ctrl+K)"
              className="w-full pl-8 pr-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
            />
          </div>
        </div>

        {/* 검색 결과 or 일반 메뉴 */}
        <nav className="py-2 overflow-y-auto h-[calc(100%-3.5rem-3rem)]">
          {searchResults ? (
            searchResults.length === 0 ? (
              <div className="px-5 py-4 text-xs text-slate-600 text-center">검색 결과 없음</div>
            ) : (
              <div>
                <div className="px-5 py-1 text-[10px] text-slate-600 uppercase tracking-wider">검색 결과 ({searchResults.length})</div>
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleNavigate(r.path)}
                    className={`
                      w-full text-left px-5 py-2 text-sm transition-colors
                      ${location.pathname === r.path
                        ? 'text-teal-400 bg-teal-500/10 border-r-2 border-teal-400'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'}
                    `}
                  >
                    <div className="flex items-center gap-1.5">
                      {r.parentLabel && (
                        <span className="text-[10px] text-slate-600">{r.parentLabel} ›</span>
                      )}
                      <span>{highlightMatch(r.label, searchQuery)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            /* 일반 메뉴 */
            SIDEBAR_MENUS.map((menu) => {
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
            })
          )}
        </nav>
      </aside>
    </>
  )
}

/** 검색어 하이라이트 */
function highlightMatch(text: string, query: string) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-teal-400 font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}
