import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from '@/firebase'
import type { UserProfile, UserClaims } from '@/types'

/** 이메일/비밀번호 로그인 */
export async function login(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

/** 로그아웃 */
export async function logout(): Promise<void> {
  await signOut(auth)
}

/** Firebase Auth 상태 변경 리스너 */
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

/** Custom Claims 가져오기 (토큰에서 추출) */
export async function getUserClaims(user: User): Promise<UserClaims | null> {
  const tokenResult = await user.getIdTokenResult(true)
  const claims = tokenResult.claims
  if (!claims.role) return null
  return {
    role: claims.role as UserClaims['role'],
    level: (claims.level as number) ?? 1,
    modules: (claims.modules as string[]) ?? [],
  } as UserClaims
}

/** Firestore에서 사용자 프로필 조회 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return { ...snap.data(), uid: snap.id } as UserProfile
}

/** CEO가 사용자 역할 설정 (Cloud Function 호출) */
export async function setUserRole(targetUid: string, role: string, modules: string[]) {
  const fn = httpsCallable(functions, 'setUserRole')
  return fn({ targetUid, role, modules })
}
