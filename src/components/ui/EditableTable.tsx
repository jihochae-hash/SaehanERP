import { useState, useRef, useEffect, type ReactNode } from 'react'
import { exportToExcel } from '@/utils/exportExcel'

interface EditableColumn<T> {
  key: string
  label: string
  width?: string
  /** 편집 가능 여부 (기본 true) */
  editable?: boolean
  /** 셀 타입 */
  type?: 'text' | 'number' | 'select' | 'checkbox'
  /** select 옵션 */
  options?: { value: string; label: string }[]
  /** 읽기 전용 렌더링 */
  render?: (value: unknown, row: T) => ReactNode
  /** 필수 여부 */
  required?: boolean
}

interface EditableTableProps<T> {
  columns: EditableColumn<T>[]
  data: T[]
  keyField?: string
  onChange: (rowIndex: number, key: string, value: unknown) => void
  onDelete?: (rowIndex: number) => void
  emptyMessage?: string
  /** 전체 데이터 (엑셀 다운로드용, 페이지네이션과 별개) */
  allData?: T[]
  /** 전체 데이터 가져오기 (비동기, allData보다 우선) */
  onFetchAllForExport?: () => Promise<T[]>
  exportFileName?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function EditableTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id',
  onChange,
  onDelete,
  allData,
  onFetchAllForExport,
  exportFileName,
  emptyMessage = '데이터가 없습니다.',
}: EditableTableProps<T>) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }
  }, [editingCell])

  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault()
      setEditingCell(null)
      // 다음 편집 가능 셀로 이동
      const editableCols = columns.filter((c) => c.editable !== false && c.key !== 'actions')
      if (e.key === 'Tab') {
        const nextColIdx = colIdx + 1
        if (nextColIdx < editableCols.length) {
          setEditingCell({ row: rowIdx, col: editableCols[nextColIdx].key })
        } else if (rowIdx + 1 < data.length) {
          setEditingCell({ row: rowIdx + 1, col: editableCols[0].key })
        }
      } else if (e.key === 'Enter') {
        const currentEditableCol = editableCols.findIndex((c) => c.key === columns[colIdx]?.key)
        if (rowIdx + 1 < data.length) {
          setEditingCell({ row: rowIdx + 1, col: editableCols[currentEditableCol >= 0 ? currentEditableCol : 0].key })
        }
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }

  const renderCell = (col: EditableColumn<T>, row: T, rowIdx: number, colIdx: number) => {
    const value = row[col.key]
    const isEditing = editingCell?.row === rowIdx && editingCell?.col === col.key
    const isEditable = col.editable !== false

    // 체크박스는 항상 인라인
    if (col.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(rowIdx, col.key, e.target.checked)}
          className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
        />
      )
    }

    // 편집 불가 + 커스텀 렌더
    if (!isEditable) {
      return col.render ? col.render(value, row) : <span className="text-gray-500">{String(value ?? '')}</span>
    }

    // 편집 모드
    if (isEditing) {
      if (col.type === 'select' && col.options) {
        return (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={String(value ?? '')}
            onChange={(e) => { onChange(rowIdx, col.key, e.target.value); setEditingCell(null) }}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
            className="w-full px-1 py-0.5 text-sm border border-teal-400 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {col.options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )
      }
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={col.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(rowIdx, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)}
          onBlur={() => setEditingCell(null)}
          onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
          className="w-full px-1 py-0.5 text-sm border border-teal-400 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      )
    }

    // 읽기 모드 (클릭 시 편집)
    if (col.render) {
      return (
        <div className="cursor-pointer hover:bg-teal-50 px-1 py-0.5 rounded -mx-1" onClick={() => setEditingCell({ row: rowIdx, col: col.key })}>
          {col.render(value, row)}
        </div>
      )
    }
    return (
      <div className="cursor-pointer hover:bg-teal-50 px-1 py-0.5 rounded -mx-1 min-h-[1.5rem]" onClick={() => setEditingCell({ row: rowIdx, col: col.key })}>
        {value != null && value !== '' ? String(value) : <span className="text-gray-300">—</span>}
      </div>
    )
  }

  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    const exportCols = columns.filter((c) => c.label !== '')
    let exportData: Record<string, unknown>[]
    if (onFetchAllForExport) {
      setExporting(true)
      try {
        exportData = await onFetchAllForExport() as Record<string, unknown>[]
      } finally {
        setExporting(false)
      }
    } else {
      exportData = (allData ?? data) as Record<string, unknown>[]
    }
    exportToExcel(exportCols, exportData, exportFileName ?? 'export')
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={handleExport} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          {exporting ? '전체 데이터 가져오는 중...' : '엑셀 다운로드 (전체)'}
        </button>
      </div>
    <div className="overflow-auto max-h-[70vh]">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10 shadow-[0_1px_0_0_#e5e7eb]">
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {col.label}
              </th>
            ))}
            {onDelete && <th className="w-10" />}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {data.length === 0 ? (
            <tr><td colSpan={columns.length + (onDelete ? 1 : 0)} className="px-3 py-6 text-center text-sm text-gray-500">{emptyMessage}</td></tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr key={String(row[keyField] ?? rowIdx)} className="hover:bg-gray-50">
                {columns.map((col, colIdx) => (
                  <td key={col.key} className="px-3 py-1.5 text-sm text-gray-700">
                    {renderCell(col, row, rowIdx, colIdx)}
                  </td>
                ))}
                {onDelete && (
                  <td className="px-1 py-1.5">
                    <button onClick={() => onDelete(rowIdx)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    </div>
  )
}
