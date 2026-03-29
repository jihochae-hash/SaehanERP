import type { ItemType } from '@/types'
import { ITEM_TYPE_CODE } from '@/types/master'

/**
 * 품목코드 형식: ABBB-CCCCCD
 * A: 품목구분 (1:제품, 2:원자재, 3:부자재, 4:충진품, 5:벌크, 6:상품, 9:기타)
 * BBB: 3자리 알파벳 (고객사 약칭)
 * CCCCC: 5자리 순차번호
 * D: Sub번호 (A, B, C...)
 */
const CODE_REGEX = /^[1-9][A-Z]{3}-\d{5}[A-Z]$/

/** 품목코드 형식 검증 */
export function validateItemCode(code: string): { valid: boolean; message?: string } {
  if (!code) return { valid: false, message: '품목코드를 입력하세요' }
  const upper = code.toUpperCase()
  if (!CODE_REGEX.test(upper)) {
    return { valid: false, message: '형식: ABBB-CCCCCD (예: 2ABC-00001A)' }
  }
  return { valid: true }
}

/** 품목코드에서 품목구분 코드 추출 */
export function getTypeFromCode(code: string): string {
  return code.charAt(0)
}

/** 품목유형으로 코드 첫자리 결정 */
export function getCodePrefix(type: ItemType): string {
  return ITEM_TYPE_CODE[type] ?? '9'
}

/** 다음 순차번호 생성 */
export function generateNextCode(existingCodes: string[], type: ItemType, customerAbbr: string): string {
  const prefix = getCodePrefix(type)
  const abbr = customerAbbr.toUpperCase().padEnd(3, 'X').slice(0, 3)
  const pattern = `${prefix}${abbr}-`

  // 같은 prefix+abbr의 기존 코드에서 최대 순번 찾기
  let maxSeq = 0
  for (const code of existingCodes) {
    if (code.startsWith(pattern)) {
      const seqPart = code.slice(5, 10)
      const seq = parseInt(seqPart, 10)
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(5, '0')
  return `${prefix}${abbr}-${nextSeq}A`
}

/** 중복 코드 체크 (자기 자신 제외) */
export function isDuplicateCode(code: string, existingCodes: string[], excludeCode?: string): boolean {
  const upper = code.toUpperCase()
  return existingCodes.some((c) => c.toUpperCase() === upper && c.toUpperCase() !== excludeCode?.toUpperCase())
}
