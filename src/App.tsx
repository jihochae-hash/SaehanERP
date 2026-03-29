import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { MainLayout } from '@/components/layout'
import { AuthGuard } from '@/components/guards'
import { RoleGuard } from '@/components/guards'
import LoginPage from '@/features/auth/LoginPage'
import DashboardHome from '@/features/dashboard/DashboardHome'

// 지연 로딩: 페이지 진입 시에만 코드 로드
const UserManagePage = lazy(() => import('@/features/auth/UserManagePage'))
const ItemListPage = lazy(() => import('@/features/master/ItemListPage'))
const PartnerListPage = lazy(() => import('@/features/master/PartnerListPage'))
const WarehouseListPage = lazy(() => import('@/features/master/WarehouseListPage'))
const QuotationPage = lazy(() => import('@/features/sales/QuotationPage'))
const SalesOrderPage = lazy(() => import('@/features/sales/SalesOrderPage'))
const ShipmentPage = lazy(() => import('@/features/sales/ShipmentPage'))
const SalesStatementPage = lazy(() => import('@/features/sales/SalesStatementPage'))
const SalesAnalysisPage = lazy(() => import('@/features/sales/SalesAnalysisPage'))
const ContactLogPage = lazy(() => import('@/features/crm/ContactLogPage'))
const CustomerGradePage = lazy(() => import('@/features/crm/CustomerGradePage'))
const ServiceRequestPage = lazy(() => import('@/features/crm/ServiceRequestPage'))
const IngredientListPage = lazy(() => import('@/features/rnd/IngredientListPage'))
const FormulaListPage = lazy(() => import('@/features/rnd/FormulaListPage'))
const FormulaDetailPage = lazy(() => import('@/features/rnd/FormulaDetailPage'))
const BomListPage = lazy(() => import('@/features/production/BomListPage'))
const WorkOrderListPage = lazy(() => import('@/features/production/WorkOrderListPage'))
const ProductionPlanPage = lazy(() => import('@/features/production/ProductionPlanPage'))
const WeighingPage = lazy(() => import('@/features/production/WeighingPage'))
const ManufacturingPage = lazy(() => import('@/features/production/ManufacturingPage'))
const PackagingPage = lazy(() => import('@/features/production/PackagingPage'))
const ProductionMonitorPage = lazy(() => import('@/features/production/ProductionMonitorPage'))
const PurchaseOrderPage = lazy(() => import('@/features/purchasing/PurchaseOrderPage'))
const MrpPage = lazy(() => import('@/features/purchasing/MrpPage'))
const InspectionListPage = lazy(() => import('@/features/quality/InspectionListPage'))
const CapaListPage = lazy(() => import('@/features/quality/CapaListPage'))
const CgmpDocListPage = lazy(() => import('@/features/quality/CgmpDocListPage'))
const IncomingPage = lazy(() => import('@/features/inventory/IncomingPage'))
const OutgoingPage = lazy(() => import('@/features/inventory/OutgoingPage'))
const StockListPage = lazy(() => import('@/features/inventory/StockListPage'))
const TransactionListPage = lazy(() => import('@/features/inventory/TransactionListPage'))
const TransferPage = lazy(() => import('@/features/inventory/TransferPage'))
const InventoryLedgerPage = lazy(() => import('@/features/inventory/InventoryLedgerPage'))
const StockCountPage = lazy(() => import('@/features/inventory/StockCountPage'))
const SafetyStockAlertPage = lazy(() => import('@/features/inventory/SafetyStockAlertPage'))
const LotTrackingPage = lazy(() => import('@/features/inventory/LotTrackingPage'))
const CostCalculationPage = lazy(() => import('@/features/cost/CostCalculationPage'))
const OutsourcingOrderPage = lazy(() => import('@/features/outsourcing/OutsourcingOrderPage'))
const JournalEntryPage = lazy(() => import('@/features/accounting/JournalEntryPage'))
const FinancialStatementPage = lazy(() => import('@/features/accounting/FinancialStatementPage'))
const TaxInvoicePage = lazy(() => import('@/features/accounting/TaxInvoicePage'))
const EmployeeListPage = lazy(() => import('@/features/hr/EmployeeListPage'))
const AttendancePage = lazy(() => import('@/features/hr/AttendancePage'))
const PayrollPage = lazy(() => import('@/features/hr/PayrollPage'))
const EquipmentListPage = lazy(() => import('@/features/equipment/EquipmentListPage'))
const MaintenanceLogPage = lazy(() => import('@/features/equipment/MaintenanceLogPage'))
const ApprovalRequestPage = lazy(() => import('@/features/approval/ApprovalRequestPage'))
const ContractListPage = lazy(() => import('@/features/contract/ContractListPage'))
const NoticeBoardPage = lazy(() => import('@/features/groupware/NoticeBoardPage'))
const SchedulePage = lazy(() => import('@/features/groupware/SchedulePage'))
const FileSharePage = lazy(() => import('@/features/groupware/FileSharePage'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
})

function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuth()
  return <>{children}</>
}

function PageLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <svg className="animate-spin h-6 w-6 text-teal-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}

function L({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AuthGuard><MainLayout /></AuthGuard>}>
              <Route path="/dashboard" element={<DashboardHome />} />
              {/* 기초정보 */}
              <Route path="/master/items" element={<L><RoleGuard module="inventory"><ItemListPage /></RoleGuard></L>} />
              <Route path="/master/partners" element={<L><PartnerListPage /></L>} />
              <Route path="/master/warehouses" element={<L><RoleGuard module="inventory"><WarehouseListPage /></RoleGuard></L>} />
              {/* 영업 */}
              <Route path="/sales/quotations" element={<L><RoleGuard module="sales"><QuotationPage /></RoleGuard></L>} />
              <Route path="/sales/orders" element={<L><RoleGuard module="sales"><SalesOrderPage /></RoleGuard></L>} />
              <Route path="/sales/shipments" element={<L><RoleGuard module="sales"><ShipmentPage /></RoleGuard></L>} />
              <Route path="/sales/statements" element={<L><RoleGuard module="sales"><SalesStatementPage /></RoleGuard></L>} />
              <Route path="/sales/analysis" element={<L><RoleGuard module="sales"><SalesAnalysisPage /></RoleGuard></L>} />
              {/* CRM */}
              <Route path="/crm/contacts" element={<L><RoleGuard module="crm"><ContactLogPage /></RoleGuard></L>} />
              <Route path="/crm/grades" element={<L><RoleGuard module="crm"><CustomerGradePage /></RoleGuard></L>} />
              <Route path="/crm/service" element={<L><RoleGuard module="crm"><ServiceRequestPage /></RoleGuard></L>} />
              {/* R&D */}
              <Route path="/rnd/ingredients" element={<L><RoleGuard module="rnd"><IngredientListPage /></RoleGuard></L>} />
              <Route path="/rnd/formulas" element={<L><RoleGuard module="rnd"><FormulaListPage /></RoleGuard></L>} />
              <Route path="/rnd/formulas/:id" element={<L><RoleGuard module="rnd"><FormulaDetailPage /></RoleGuard></L>} />
              {/* 생산 */}
              <Route path="/production/plans" element={<L><RoleGuard module="production"><ProductionPlanPage /></RoleGuard></L>} />
              <Route path="/production/work-orders" element={<L><RoleGuard module="production"><WorkOrderListPage /></RoleGuard></L>} />
              <Route path="/production/bom" element={<L><RoleGuard module="production"><BomListPage /></RoleGuard></L>} />
              <Route path="/production/weighing" element={<L><RoleGuard module="production"><WeighingPage /></RoleGuard></L>} />
              <Route path="/production/manufacturing" element={<L><RoleGuard module="production"><ManufacturingPage /></RoleGuard></L>} />
              <Route path="/production/packaging" element={<L><RoleGuard module="production"><PackagingPage /></RoleGuard></L>} />
              <Route path="/production/monitor" element={<L><RoleGuard module="production"><ProductionMonitorPage /></RoleGuard></L>} />
              {/* 구매 */}
              <Route path="/purchasing/orders" element={<L><RoleGuard module="purchasing"><PurchaseOrderPage /></RoleGuard></L>} />
              <Route path="/purchasing/mrp" element={<L><RoleGuard module="mrp"><MrpPage /></RoleGuard></L>} />
              {/* 품질 */}
              <Route path="/quality/inspections" element={<L><RoleGuard module="quality"><InspectionListPage /></RoleGuard></L>} />
              <Route path="/quality/capa" element={<L><RoleGuard module="quality"><CapaListPage /></RoleGuard></L>} />
              <Route path="/quality/cgmp" element={<L><RoleGuard module="quality"><CgmpDocListPage /></RoleGuard></L>} />
              {/* 재고 */}
              <Route path="/inventory/incoming" element={<L><RoleGuard module="inventory"><IncomingPage /></RoleGuard></L>} />
              <Route path="/inventory/outgoing" element={<L><RoleGuard module="inventory"><OutgoingPage /></RoleGuard></L>} />
              <Route path="/inventory/stock" element={<L><RoleGuard module="inventory"><StockListPage /></RoleGuard></L>} />
              <Route path="/inventory/transactions" element={<L><RoleGuard module="inventory"><TransactionListPage /></RoleGuard></L>} />
              <Route path="/inventory/transfer" element={<L><RoleGuard module="inventory"><TransferPage /></RoleGuard></L>} />
              <Route path="/inventory/ledger" element={<L><RoleGuard module="inventory"><InventoryLedgerPage /></RoleGuard></L>} />
              <Route path="/inventory/count" element={<L><RoleGuard module="inventory"><StockCountPage /></RoleGuard></L>} />
              <Route path="/inventory/safety-stock" element={<L><RoleGuard module="inventory"><SafetyStockAlertPage /></RoleGuard></L>} />
              <Route path="/inventory/lot" element={<L><RoleGuard module="inventory"><LotTrackingPage /></RoleGuard></L>} />
              {/* 원가/외주 */}
              <Route path="/cost/calculation" element={<L><RoleGuard module="cost"><CostCalculationPage /></RoleGuard></L>} />
              <Route path="/outsourcing/orders" element={<L><RoleGuard module="outsourcing"><OutsourcingOrderPage /></RoleGuard></L>} />
              {/* 회계 */}
              <Route path="/accounting/journal" element={<L><RoleGuard module="accounting"><JournalEntryPage /></RoleGuard></L>} />
              <Route path="/accounting/financial" element={<L><RoleGuard module="accounting"><FinancialStatementPage /></RoleGuard></L>} />
              <Route path="/accounting/tax-invoice" element={<L><RoleGuard module="tax"><TaxInvoicePage /></RoleGuard></L>} />
              {/* 인사 */}
              <Route path="/hr/employees" element={<L><RoleGuard module="hr"><EmployeeListPage /></RoleGuard></L>} />
              <Route path="/hr/attendance" element={<L><RoleGuard module="hr"><AttendancePage /></RoleGuard></L>} />
              <Route path="/hr/payroll" element={<L><RoleGuard module="payroll"><PayrollPage /></RoleGuard></L>} />
              {/* 설비 */}
              <Route path="/equipment/list" element={<L><RoleGuard module="equipment"><EquipmentListPage /></RoleGuard></L>} />
              <Route path="/equipment/maintenance" element={<L><RoleGuard module="equipment"><MaintenanceLogPage /></RoleGuard></L>} />
              {/* 결재/계약 */}
              <Route path="/approval/requests" element={<L><RoleGuard module="approval"><ApprovalRequestPage /></RoleGuard></L>} />
              <Route path="/contract/list" element={<L><RoleGuard module="contract"><ContractListPage /></RoleGuard></L>} />
              {/* 그룹웨어 */}
              <Route path="/groupware/notice" element={<L><RoleGuard module="groupware"><NoticeBoardPage /></RoleGuard></L>} />
              <Route path="/groupware/schedule" element={<L><SchedulePage /></L>} />
              <Route path="/groupware/files" element={<L><RoleGuard module="groupware"><FileSharePage /></RoleGuard></L>} />
              {/* 시스템 */}
              <Route path="/admin/users" element={<L><RoleGuard ceoOnly><UserManagePage /></RoleGuard></L>} />
              <Route path="/admin/audit" element={<RoleGuard ceoOnly><Placeholder title="감사로그" /></RoleGuard>} />
            </Route>
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
      <h2 className="text-xl font-semibold text-gray-900">{title} — 구현 예정</h2>
    </div>
  )
}

export default App
