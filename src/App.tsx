import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { MainLayout } from '@/components/layout'
import { AuthGuard } from '@/components/guards'
import LoginPage from '@/features/auth/LoginPage'
import DashboardHome from '@/features/dashboard/DashboardHome'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분
      retry: 1,
    },
  },
})

/** Auth 상태 초기화 래퍼 */
function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuth()
  return <>{children}</>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* 공개 라우트 */}
            <Route path="/login" element={<LoginPage />} />

            {/* 인증 필요 라우트 */}
            <Route
              element={
                <AuthGuard>
                  <MainLayout />
                </AuthGuard>
              }
            >
              <Route path="/dashboard" element={<DashboardHome />} />

              {/* 기초정보 */}
              <Route path="/master/items" element={<Placeholder title="품목관리" />} />
              <Route path="/master/partners" element={<Placeholder title="거래처관리" />} />
              <Route path="/master/warehouses" element={<Placeholder title="창고관리" />} />

              {/* 재고관리 */}
              <Route path="/inventory/incoming" element={<Placeholder title="입고처리" />} />
              <Route path="/inventory/outgoing" element={<Placeholder title="출고처리" />} />
              <Route path="/inventory/stock" element={<Placeholder title="재고현황" />} />
              <Route path="/inventory/transactions" element={<Placeholder title="입출고이력" />} />
              <Route path="/inventory/lot" element={<Placeholder title="LOT추적" />} />

              {/* 시스템관리 */}
              <Route path="/admin/users" element={<Placeholder title="사용자관리" />} />
              <Route path="/admin/audit" element={<Placeholder title="감사로그" />} />
            </Route>

            {/* 기본 리다이렉트 */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

/** 임시 플레이스홀더 (Phase 1에서 순차 구현) */
function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500">구현 예정</p>
      </div>
    </div>
  )
}

export default App
