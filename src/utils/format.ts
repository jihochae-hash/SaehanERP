/** Firestore Timestamp 또는 ISO 문자열을 표시용 날짜로 변환 */
export function formatDate(value: unknown): string {
  if (!value) return ''
  // Firestore Timestamp 객체
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate()
    return dateToString(date)
  }
  // ISO 문자열
  if (typeof value === 'string') {
    const date = new Date(value)
    if (isNaN(date.getTime())) return value
    return dateToString(date)
  }
  return ''
}

function dateToString(d: Date): string {
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** 숫자를 천단위 콤마 포맷 */
export function formatNumber(value: number | undefined | null): string {
  if (value == null) return '0'
  return value.toLocaleString('ko-KR')
}
