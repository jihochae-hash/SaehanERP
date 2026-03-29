import { useState, useMemo, useCallback, useRef, type ReactNode } from 'react'
import { exportToExcel } from '@/utils/exportExcel'
import { useColumnWidths } from '@/hooks/useColumnWidths'

interface Column<T> {
  key: string
  label: string
  width?: string
  sortable?: boolean
  render?: (value: unknown, row: T, index: number) => ReactNode
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField?: string
  emptyMessage?: string
  loading?: boolean
  onRowClick?: (row: T) => void
  exportFileName?: string | false
  onFetchAllForExport?: () => Promise<T[]>
  /** 열 너비 저장용 테이블 고유 ID (미지정 시 자동 생성) */
  tableId?: string
}

type SortDirection = 'asc' | 'desc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Table<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id',
  emptyMessage = '데이터가 없습니다.',
  loading,
  onRowClick,
  exportFileName,
  onFetchAllForExport,
  tableId,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [exporting, setExporting] = useState(false)

  // 컬럼 기본 너비
  const defaultWidths = useMemo(() => {
    const w: Record<string, number> = {}
    columns.forEach((col) => {
      w[col.key] = parseInt(col.width ?? '120', 10) || 120
    })
    return w
  }, [columns])

  const autoTableId = tableId ?? columns.map((c) => c.key).join('_')
  const { widths, updateWidth } = useColumnWidths(autoTableId, defaultWidths)

  // 드래그 리사이즈
  const dragRef = useRef<{ key: string; startX: number; startW: number } | null>(null)

  const onMouseDown = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { key, startX: e.clientX, startW: widths[key] ?? 120 }

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const diff = ev.clientX - dragRef.current.startX
      updateWidth(dragRef.current.key, dragRef.current.startW + diff)
    }
    const onMouseUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [widths, updateWidth])

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortedData = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]; const bVal = b[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDir === 'asc' ? 1 : -1
      if (bVal == null) return sortDir === 'asc' ? -1 : 1
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal), 'ko') : String(bVal).localeCompare(String(aVal), 'ko')
    })
  }, [data, sortKey, sortDir])

  const handleExport = async () => {
    const exportCols = columns.filter((c) => c.label !== '')
    const name = (typeof exportFileName === 'string' ? exportFileName : undefined) ?? 'export'
    if (onFetchAllForExport) {
      setExporting(true)
      try { exportToExcel(exportCols, await onFetchAllForExport() as Record<string, unknown>[], name) }
      finally { setExporting(false) }
    } else {
      exportToExcel(exportCols, sortedData as Record<string, unknown>[], name)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        로딩 중...
      </div>
    )
  }

  return (
    <div>
      {exportFileName !== false && (
        <div className="flex justify-end mb-2">
          <button onClick={handleExport} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {exporting ? '전체 데이터 가져오는 중...' : '엑셀 다운로드'}
          </button>
        </div>
      )}
      <div className="overflow-auto max-h-[70vh]">
        <table className="divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'fixed', width: columns.reduce((sum, col) => sum + (widths[col.key] ?? 120), 0) }}>
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-[0_1px_0_0_#e5e7eb]">
            <tr>
              {columns.map((col) => {
                const isSortable = col.sortable !== false && col.label !== ''
                const isActive = sortKey === col.key
                const w = widths[col.key] ?? 120
                return (
                  <th
                    key={col.key}
                    style={{ width: w, minWidth: 40, position: 'relative' }}
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${isSortable ? 'cursor-pointer select-none hover:text-gray-900 hover:bg-gray-100 transition-colors' : ''}`}
                    onClick={isSortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1 truncate">
                      {col.label}
                      {isSortable && (
                        <span className={`inline-flex flex-col text-[10px] leading-none ${isActive ? 'text-teal-600' : 'text-gray-300'}`}>
                          <span className={isActive && sortDir === 'asc' ? 'text-teal-600' : 'text-gray-300'}>▲</span>
                          <span className={isActive && sortDir === 'desc' ? 'text-teal-600' : 'text-gray-300'}>▼</span>
                        </span>
                      )}
                    </span>
                    {/* 드래그 리사이즈 핸들 */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400 active:bg-teal-500 transition-colors"
                      onMouseDown={(e) => onMouseDown(e, col.key)}
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">{emptyMessage}</td>
              </tr>
            ) : (
              sortedData.map((row, idx) => (
                <tr key={String(row[keyField] ?? idx)} onClick={() => onRowClick?.(row)} className={onRowClick ? 'cursor-pointer hover:bg-teal-50' : 'hover:bg-gray-50'}>
                  {columns.map((col) => (
                    <td key={col.key} style={{ width: widths[col.key] ?? 120 }} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis">
                      {col.render ? col.render(row[col.key], row, idx) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
