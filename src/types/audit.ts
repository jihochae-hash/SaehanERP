/** 감사 로그 이벤트 유형 */
export type AuditEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'ROLE_CHANGED'
  | 'INVENTORY_IN'
  | 'INVENTORY_OUT'
  | 'INVENTORY_ADJUST'
  | 'MASTER_CREATED'
  | 'MASTER_UPDATED'
  | 'MASTER_DELETED'
  | 'FORMULA_ACCESSED'
  | 'FORMULA_MODIFIED'
  | 'APPROVAL_CREATED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  | 'JOURNAL_CREATED'
  | 'JOURNAL_LOCKED'

/** 감사 로그 문서 (auditLogs 컬렉션 - Cloud Functions만 쓰기) */
export interface AuditLog {
  id: string
  event: AuditEventType
  userId: string
  userEmail: string
  userName: string
  targetCollection?: string
  targetDocId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  timestamp: string
}
