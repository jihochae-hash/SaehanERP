import { useState, useCallback, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'

/**
 * 테이블 컬럼 너비를 사용자별로 localStorage에 저장/복원
 * key: `col-widths:${userId}:${tableId}`
 */
export function useColumnWidths(tableId: string, defaultWidths: Record<string, number>) {
  const userId = useAuthStore((s) => s.user?.uid ?? 'anonymous')
  const storageKey = `col-widths:${userId}:${tableId}`

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return { ...defaultWidths, ...JSON.parse(saved) }
    } catch { /* ignore */ }
    return defaultWidths
  })

  // userId 변경 시 다시 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setWidths({ ...defaultWidths, ...JSON.parse(saved) })
      else setWidths(defaultWidths)
    } catch { setWidths(defaultWidths) }
  }, [storageKey])

  const updateWidth = useCallback((key: string, width: number) => {
    setWidths((prev) => {
      const next = { ...prev, [key]: Math.max(width, 40) }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [storageKey])

  return { widths, updateWidth }
}
