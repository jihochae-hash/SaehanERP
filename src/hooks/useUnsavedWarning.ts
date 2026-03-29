import { useEffect } from 'react'

/**
 * 미저장 변경사항이 있을 때 페이지 이탈 경고
 * - 브라우저 탭 닫기/새로고침 시 확인 팝업
 * - 사이드바 메뉴 클릭 시에도 변경사항 초기화 (pendingChanges는 컴포넌트 언마운트 시 자동 리셋)
 */
export function useUnsavedWarning(hasChanges: boolean) {
  useEffect(() => {
    if (!hasChanges) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])
}
