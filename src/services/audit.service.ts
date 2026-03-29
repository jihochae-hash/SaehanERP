import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import type { AuditEventType } from '@/types'

/**
 * 감사 로그 기록 요청 (Cloud Function 호출)
 * 감사 로그는 보안상 Cloud Functions에서만 Firestore에 쓸 수 있다.
 * 클라이언트에서는 이 함수를 통해 Cloud Function을 호출한다.
 */
export async function writeAuditLog(params: {
  event: AuditEventType
  targetCollection?: string
  targetDocId?: string
  details?: Record<string, unknown>
}): Promise<void> {
  const fn = httpsCallable(functions, 'writeAuditLog')
  await fn(params)
}
