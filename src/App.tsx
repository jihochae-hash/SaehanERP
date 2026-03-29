import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { MainLayout } from '@/components/layout'
import { AuthGuard } from '@/components/guards'
import { RoleGuard } from '@/components/guards'
import LoginPage from '@/features/auth/LoginPage'
import UserManagePage from '@/features/auth/UserManagePage'
import DashboardHome from '@/features/dashboard/DashboardHome'
import ItemListPage from '@/features/master/ItemListPage'
import PartnerListPage from '@/features/master/PartnerListPage'
import WarehouseListPage from '@/features/master/WarehouseListPage'
import StockListPage from '@/features/inventory/StockListPage'
import IncomingPage from '@/features/inventory/IncomingPage'
import OutgoingPage from '@/features/inventory/OutgoingPage'
import TransactionListPage from '@/features/inventory/TransactionListPage'
import LotTrackingPage from '@/features/inventory/LotTrackingPage'
import IngredientListPage from '@/features/rnd/IngredientListPage'
import FormulaListPage from '@/features/rnd/FormulaListPage'
import FormulaDetailPage from '@/features/rnd/FormulaDetailPage'
import BomListPage from '@/features/production/BomListPage'
import WorkOrderListPage from '@/features/production/WorkOrderListPage'
import ProductionPlanPage from '@/features/production/ProductionPlanPage'
import PurchaseOrderPage from '@/features/purchasing/PurchaseOrderPage'
import MrpPage from '@/features/purchasing/MrpPage'
import InspectionListPage from '@/features/quality/InspectionListPage'
import CapaListPage from '@/features/quality/CapaListPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

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
              <Route path="/master/items" element={<RoleGuard module="inventory"><ItemListPage /></RoleGuard>} />
              <Route path="/master/partners" element={<PartnerListPage />} />
              <Route path="/master/warehouses" element={<RoleGuard module="inventory"><WarehouseListPage /></RoleGuard>} />

              {/* R&D / 처방관리 */}
              <Route path="/rnd/ingredients" element={<RoleGuard module="rnd"><IngredientListPage /></RoleGuard>} />
              <Route path="/rnd/formulas" element={<RoleGuard module="rnd"><FormulaListPage /></RoleGuard>} />
              <Route path="/rnd/formulas/:id" element={<RoleGuard module="rnd"><FormulaDetailPage /></RoleGuard>} />

              {/* 생산관리 */}
              <Route path="/production/bom" element={<RoleGuard module="production"><BomListPage /></RoleGuard>} />
              <Route path="/production/work-orders" element={<RoleGuard module="production"><WorkOrderListPage /></RoleGuard>} />
              <Route path="/production/plans" element={<RoleGuard module="production"><ProductionPlanPage /></RoleGuard>} />

              {/* 구매관리 */}
              <Route path="/purchasing/orders" element={<RoleGuard module="purchasing"><PurchaseOrderPage /></RoleGuard>} />
              <Route path="/purchasing/mrp" element={<RoleGuard module="mrp"><MrpPage /></RoleGuard>} />

              {/* 품질관리 */}
              <Route path="/quality/inspections" element={<RoleGuard module="quality"><InspectionListPage /></RoleGuard>} />
              <Route path="/quality/capa" element={<RoleGuard module="quality"><CapaListPage /></RoleGuard>} />

              {/* 재고관리 */}
              <Route path="/inventory/incoming" element={<RoleGuard module="inventory"><IncomingPage /></RoleGuard>} />
              <Route path="/inventory/outgoing" element={<RoleGuard module="inventory"><OutgoingPage /></RoleGuard>} />
              <Route path="/inventory/stock" element={<RoleGuard module="inventory"><StockListPage /></RoleGuard>} />
              <Route path="/inventory/transactions" element={<RoleGuard module="inventory"><TransactionListPage /></RoleGuard>} />
              <Route path="/inventory/lot" element={<RoleGuard module="inventory"><LotTrackingPage /></RoleGuard>} />

              {/* 시스템관리 (CEO 전용) */}
              <Route path="/admin/users" element={<RoleGuard ceoOnly><UserManagePage /></RoleGuard>} />
              <Route path="/admin/audit" element={<RoleGuard ceoOnly><Placeholder title="감사로그" /></RoleGuard>} />
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
