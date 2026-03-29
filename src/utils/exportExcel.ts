/**
 * 테이블 데이터를 CSV로 내보내기 (엑셀 호환)
 * 별도 라이브러리 없이 순수 CSV 생성 → .csv 파일로 다운로드
 * 엑셀에서 열면 자동으로 표 형식으로 표시됨
 */
export function exportToExcel(
  columns: { key: string; label: string }[],
  data: Record<string, unknown>[],
  fileName: string = 'export',
) {
  // BOM (엑셀에서 한글 깨짐 방지)
  const BOM = '\uFEFF'

  // 헤더
  const headers = columns.map((col) => escapeCSV(col.label))

  // 데이터 행
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key]
      if (val == null) return ''
      if (typeof val === 'boolean') return val ? 'Y' : 'N'
      if (typeof val === 'object') {
        // Firestore Timestamp
        if ('toDate' in (val as Record<string, unknown>)) {
          return escapeCSV(String((val as { toDate: () => Date }).toDate()))
        }
        // 배열
        if (Array.isArray(val)) return escapeCSV(`${val.length}건`)
        return ''
      }
      return escapeCSV(String(val))
    })
  )

  const csv = BOM + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

  // 다운로드
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName}_${formatDateForFile()}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatDateForFile(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
