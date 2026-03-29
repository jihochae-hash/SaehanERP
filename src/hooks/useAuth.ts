import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth'
import * as authService from '@/services/auth.service'
import { SESSION_TIMEOUT, SESSION_CHECK_INTERVAL } from '@/constants'

/**
 * Firebase Auth 상태 감시 + 세션 타임아웃 관리
 * App 루트에서 한 번만 호출한다.
 */
export function useAuth() {
  const { setUser, setClaims, setLoading, updateActivity, logout, lastActivity, isAuthenticated } =
    useAuthStore()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Firebase Auth 상태 변경 리스너
  useEffect(() => {
    const unsubscribe = authService.onAuthChange(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const [profile, claims] = await Promise.all([
            authService.getUserProfile(firebaseUser.uid).catch(() => null),
            authService.getUserClaims(firebaseUser),
          ])
          // 프로필이 Firestore에 없으면 Auth 정보로 기본 프로필 생성
          setUser(profile ?? {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            displayName: firebaseUser.displayName ?? firebaseUser.email ?? '',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          setClaims(claims)
          updateActivity()
        } else {
          setUser(null)
          setClaims(null)
        }
      } catch (err) {
        console.error('Auth 초기화 오류:', err)
        setUser(null)
        setClaims(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [setUser, setClaims, setLoading, updateActivity])

  // 세션 타임아웃 체크 (8시간 미활동 시 자동 로그아웃)
  useEffect(() => {
    if (!isAuthenticated) return

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivity
      if (elapsed >= SESSION_TIMEOUT) {
        authService.logout()
        logout()
      }
    }, SESSION_CHECK_INTERVAL)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isAuthenticated, lastActivity, logout])

  // 사용자 활동 감지 (클릭, 키보드)
  useEffect(() => {
    if (!isAuthenticated) return

    const handleActivity = () => updateActivity()
    window.addEventListener('click', handleActivity)
    window.addEventListener('keydown', handleActivity)
    return () => {
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('keydown', handleActivity)
    }
  }, [isAuthenticated, updateActivity])
}
