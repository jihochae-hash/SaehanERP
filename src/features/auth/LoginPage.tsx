import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input } from '@/components/ui'
import * as authService from '@/services/auth.service'

export default function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    const email = (document.getElementById('email') as HTMLInputElement)?.value?.trim() ?? ''
    const password = (document.getElementById('password') as HTMLInputElement)?.value ?? ''

    if (!email) { setError('이메일을 입력하세요'); return }
    if (!password || password.length < 6) { setError('비밀번호는 6자 이상입니다'); return }

    setError('')
    setLoading(true)
    try {
      await authService.login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      } else if (code === 'auth/too-many-requests') {
        setError('로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.')
      } else {
        setError('로그인에 실패했습니다. 다시 시도하세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* 좌측: 브랜드 영역 */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-600 to-teal-800 items-center justify-center p-12">
        <div className="text-center">
          <img src="/logo.png" alt="새한화장품" className="w-28 h-28 mx-auto mb-8 brightness-0 invert" />
          <h2 className="text-3xl font-bold text-white mb-3">Saehan ERP</h2>
          <p className="text-teal-200 text-sm leading-relaxed">
            (주)새한화장품<br />통합 운영관리 시스템
          </p>
        </div>
      </div>

      {/* 우측: 로그인 폼 */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* 모바일에서만 보이는 로고 */}
          <div className="lg:hidden text-center mb-8">
            <img src="/logo_full.png" alt="Sae Han Cosmetics" className="h-10 mx-auto mb-4" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
            <p className="mt-1 text-sm text-gray-500">계정 정보를 입력하세요</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="space-y-5">
            <Input
              id="email"
              label="이메일"
              type="email"
              placeholder="email@sae-han.com"
              autoComplete="email"
            />
            <Input
              id="password"
              label="비밀번호"
              type="password"
              placeholder="비밀번호 입력"
              autoComplete="current-password"
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <Button type="submit" loading={loading} className="w-full">
              로그인
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Sae Han Cosmetics Co., Ltd.
          </p>
        </div>
      </div>
    </div>
  )
}
