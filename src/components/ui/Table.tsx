import { useState, useMemo, type ReactNode } from 'react'
import { exportToExcel } from '@/utils/exportExcel'

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
  /** 엑셀 다운로드 파일명 (false로 설정하면 숨김) */
  exportFileName?: string | false
  /** 전체 데이터 가져오기 (엑셀 다운로드 시 전체 데이터 로드) */
  onFetchAllForExport?: () => Promise<T[]>
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
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedData = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDir === 'asc' ? 1 : -1
      if (bVal == null) return sortDir === 'asc' ? -1 : 1
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal)
      const bStr = String(bVal)
      return sortDir === 'asc' ? aStr.localeCompare(bStr, 'ko') : bStr.localeCompare(aStr, 'ko')
    })
  }, [data, sortKey, sortDir])

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

  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    const exportCols = columns.filter((c) => c.label !== '')
    const name = (typeof exportFileName === 'string' ? exportFileName : undefined) ?? 'export'
    if (onFetchAllForExport) {
      setExporting(true)
      try {
        const allData = await onFetchAllForExport()
        exportToExcel(exportCols, allData as Record<string, unknown>[], name)
      } finally {
        setExporting(false)
      }
    } else {
      exportToExcel(exportCols, sortedData as Record<string, unknown>[], name)
    }
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
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10 shadow-[0_1px_0_0_#e5e7eb]">
          <tr>
            {columns.map((col) => {
              // label이 비어있으면 (액션 컬럼) 정렬 비활성
              const isSortable = col.sortable !== false && col.label !== ''
              const isActive = sortKey === col.key
              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`
                    px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider
                    ${isSortable ? 'cursor-pointer select-none hover:text-gray-900 hover:bg-gray-100 transition-colors' : ''}
                  `}
                  onClick={isSortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {isSortable && (
                      <span className={`inline-flex flex-col text-[10px] leading-none ${isActive ? 'text-teal-600' : 'text-gray-300'}`}>
                        <span className={isActive && sortDir === 'asc' ? 'text-teal-600' : 'text-gray-300'}>▲</span>
                        <span className={isActive && sortDir === 'desc' ? 'text-teal-600' : 'text-gray-300'}>▼</span>
                      </span>
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, idx) => (
              <tr
                key={String(row[keyField] ?? idx)}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-teal-50' : 'hover:bg-gray-50'}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
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
