import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { exportToExcel } from '@/utils/exportExcel'
import { useColumnWidths } from '@/hooks/useColumnWidths'

interface EditableColumn<T> {
  key: string
  label: string
  width?: string
  editable?: boolean
  type?: 'text' | 'number' | 'select' | 'checkbox'
  options?: { value: string; label: string }[]
  render?: (value: unknown, row: T) => ReactNode
  required?: boolean
}

interface EditableTableProps<T> {
  columns: EditableColumn<T>[]
  data: T[]
  keyField?: string
  onChange: (rowIndex: number, key: string, value: unknown) => void
  onDelete?: (rowIndex: number) => void
  emptyMessage?: string
  allData?: T[]
  onFetchAllForExport?: () => Promise<T[]>
  exportFileName?: string
  tableId?: string
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
  tableId,
}: EditableTableProps<T>) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)
  const [exporting, setExporting] = useState(false)

  // 컬럼 너비
  const defaultWidths = useMemo(() => {
    const w: Record<string, number> = {}
    columns.forEach((col) => { w[col.key] = parseInt(col.width ?? '120', 10) || 120 })
    return w
  }, [columns])

  const autoTableId = tableId ?? `edit_${columns.map((c) => c.key).join('_')}`
  const { widths, updateWidth } = useColumnWidths(autoTableId, defaultWidths)

  // 드래그 리사이즈
  const dragRef = useRef<{ key: string; startX: number; startW: number } | null>(null)
  const onResizeMouseDown = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { key, startX: e.clientX, startW: widths[key] ?? 120 }
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      updateWidth(dragRef.current.key, dragRef.current.startW + (ev.clientX - dragRef.current.startX))
    }
    const onMouseUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [widths, updateWidth])

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select()
    }
  }, [editingCell])

  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault()
      setEditingCell(null)
      const editableCols = columns.filter((c) => c.editable !== false && c.key !== 'actions')
      if (e.key === 'Tab') {
        const nextColIdx = colIdx + 1
        if (nextColIdx < editableCols.length) setEditingCell({ row: rowIdx, col: editableCols[nextColIdx].key })
        else if (rowIdx + 1 < data.length) setEditingCell({ row: rowIdx + 1, col: editableCols[0].key })
      } else if (e.key === 'Enter') {
        const ci = editableCols.findIndex((c) => c.key === columns[colIdx]?.key)
        if (rowIdx + 1 < data.length) setEditingCell({ row: rowIdx + 1, col: editableCols[ci >= 0 ? ci : 0].key })
      }
    } else if (e.key === 'Escape') setEditingCell(null)
  }

  const handleExport = async () => {
    const exportCols = columns.filter((c) => c.label !== '')
    if (onFetchAllForExport) {
      setExporting(true)
      try { exportToExcel(exportCols, await onFetchAllForExport() as Record<string, unknown>[], exportFileName ?? 'export') }
      finally { setExporting(false) }
    } else {
      exportToExcel(exportCols, (allData ?? data) as Record<string, unknown>[], exportFileName ?? 'export')
    }
  }

  const renderCell = (col: EditableColumn<T>, row: T, rowIdx: number, colIdx: number) => {
    const value = row[col.key]
    const isEditing = editingCell?.row === rowIdx && editingCell?.col === col.key
    const isEditable = col.editable !== false

    if (col.type === 'checkbox') {
      return <input type="checkbox" checked={!!value} onChange={(e) => onChange(rowIdx, col.key, e.target.checked)} className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500" />
    }

    if (!isEditable) return col.render ? col.render(value, row) : <span className="text-gray-500">{String(value ?? '')}</span>

    if (isEditing) {
      if (col.type === 'select' && col.options) {
        return <select ref={inputRef as React.RefObject<HTMLSelectElement>} value={String(value ?? '')} onChange={(e) => { onChange(rowIdx, col.key, e.target.value); setEditingCell(null) }} onBlur={() => setEditingCell(null)} onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)} className="w-full px-1 py-0.5 text-sm border border-teal-400 rounded focus:outline-none focus:ring-1 focus:ring-teal-500">
          {col.options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      }
      return <input ref={inputRef as React.RefObject<HTMLInputElement>} type={col.type === 'number' ? 'number' : 'text'} value={String(value ?? '')} onChange={(e) => onChange(rowIdx, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)} onBlur={() => setEditingCell(null)} onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)} className="w-full px-1 py-0.5 text-sm border border-teal-400 rounded focus:outline-none focus:ring-1 focus:ring-teal-500" />
    }

    if (col.render) return <div className="cursor-pointer hover:bg-teal-50 px-1 py-0.5 rounded -mx-1 truncate" onClick={() => setEditingCell({ row: rowIdx, col: col.key })}>{col.render(value, row)}</div>
    return <div className="cursor-pointer hover:bg-teal-50 px-1 py-0.5 rounded -mx-1 min-h-[1.5rem] truncate" onClick={() => setEditingCell({ row: rowIdx, col: col.key })}>{value != null && value !== '' ? String(value) : <span className="text-gray-300">—</span>}</div>
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
        <table className="divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'fixed', width: columns.reduce((sum, col) => sum + (widths[col.key] ?? 120), 0) + (onDelete ? 30 : 0) }}>
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-[0_1px_0_0_#e5e7eb]">
            <tr>
              {columns.map((col) => {
                const w = widths[col.key] ?? 120
                return (
                  <th key={col.key} style={{ width: w, minWidth: 40, position: 'relative' }} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <span className="truncate block">{col.label}</span>
                    <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400 active:bg-teal-500 transition-colors" onMouseDown={(e) => onResizeMouseDown(e, col.key)} />
                  </th>
                )
              })}
              {onDelete && <th style={{ width: 30 }} />}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr><td colSpan={columns.length + (onDelete ? 1 : 0)} className="px-3 py-6 text-center text-sm text-gray-500">{emptyMessage}</td></tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr key={String(row[keyField] ?? rowIdx)} className="hover:bg-gray-50">
                  {columns.map((col, colIdx) => (
                    <td key={col.key} style={{ width: widths[col.key] ?? 120 }} className="px-3 py-1.5 text-sm text-gray-700 overflow-hidden">
                      {renderCell(col, row, rowIdx, colIdx)}
                    </td>
                  ))}
                  {onDelete && (
                    <td style={{ width: 30 }} className="px-1 py-1.5">
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
