import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { Button, Input } from '@/components/ui'
import * as authService from '@/services/auth.service'
import type { LoginRequest } from '@/types'

const loginSchema = z.object({
  email: z.email('올바른 이메일을 입력하세요'),
  password: z.string().min(6, '비밀번호는 6자 이상입니다'),
})

export default function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>()

  const onSubmit = async (data: LoginRequest) => {
    // zod 수동 검증
    const result = loginSchema.safeParse(data)
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }

    setError('')
    setLoading(true)
    try {
      await authService.login(data.email, data.password)
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">새한 ERP</h1>
          <p className="mt-2 text-sm text-gray-500">(주)새한화장품 통합 경영관리 시스템</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <Input
            id="email"
            label="이메일"
            type="email"
            placeholder="email@saehan.co.kr"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email', { required: '이메일을 입력하세요' })}
          />
          <Input
            id="password"
            label="비밀번호"
            type="password"
            placeholder="비밀번호 입력"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password', { required: '비밀번호를 입력하세요' })}
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            로그인
          </Button>
        </form>
      </div>
    </div>
  )
}
