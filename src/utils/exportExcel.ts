import * as XLSX from 'xlsx'

/**
 * 테이블 데이터를 .xlsx 엑셀 파일로 다운로드
 */
export function exportToExcel(
  columns: { key: string; label: string }[],
  data: Record<string, unknown>[],
  fileName: string = 'export',
) {
  // 헤더
  const headers = columns.map((col) => col.label)

  // 데이터 행 변환
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key]
      if (val == null) return ''
      if (typeof val === 'boolean') return val ? 'Y' : 'N'
      if (typeof val === 'object') {
        if ('toDate' in (val as Record<string, unknown>)) {
          const d = (val as { toDate: () => Date }).toDate()
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        }
        if (Array.isArray(val)) return `${val.length}건`
        return ''
      }
      return val
    })
  )

  // 워크시트 생성
  const wsData = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // 컬럼 너비 자동 조절
  const colWidths = columns.map((col, i) => {
    let maxLen = col.label.length * 2 // 한글은 2배
    for (const row of rows) {
      const cellLen = String(row[i] ?? '').length
      if (cellLen > maxLen) maxLen = cellLen
    }
    return { wch: Math.min(Math.max(maxLen + 2, 8), 40) }
  })
  ws['!cols'] = colWidths

  // 워크북 생성 + 다운로드
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')

  const dateStr = formatDateForFile()
  XLSX.writeFile(wb, `${fileName}_${dateStr}.xlsx`)
}

function formatDateForFile(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
