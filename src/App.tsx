import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { MainLayout } from '@/components/layout'
import { AuthGuard } from '@/components/guards'
import { RoleGuard } from '@/components/guards'
import LoginPage from '@/features/auth/LoginPage'
import UserManagePage from '@/features/auth/UserManagePage'
import DashboardHome from '@/features/dashboard/DashboardHome'
// 기초정보
import ItemListPage from '@/features/master/ItemListPage'
import PartnerListPage from '@/features/master/PartnerListPage'
import WarehouseListPage from '@/features/master/WarehouseListPage'
// 영업관리
import QuotationPage from '@/features/sales/QuotationPage'
import SalesOrderPage from '@/features/sales/SalesOrderPage'
import ShipmentPage from '@/features/sales/ShipmentPage'
import SalesStatementPage from '@/features/sales/SalesStatementPage'
import SalesAnalysisPage from '@/features/sales/SalesAnalysisPage'
// CRM
import ContactLogPage from '@/features/crm/ContactLogPage'
import CustomerGradePage from '@/features/crm/CustomerGradePage'
import ServiceRequestPage from '@/features/crm/ServiceRequestPage'
// R&D
import IngredientListPage from '@/features/rnd/IngredientListPage'
import FormulaListPage from '@/features/rnd/FormulaListPage'
import FormulaDetailPage from '@/features/rnd/FormulaDetailPage'
// 생산관리
import BomListPage from '@/features/production/BomListPage'
import WorkOrderListPage from '@/features/production/WorkOrderListPage'
import ProductionPlanPage from '@/features/production/ProductionPlanPage'
import WeighingPage from '@/features/production/WeighingPage'
import ManufacturingPage from '@/features/production/ManufacturingPage'
import PackagingPage from '@/features/production/PackagingPage'
import ProductionMonitorPage from '@/features/production/ProductionMonitorPage'
// 구매관리
import PurchaseOrderPage from '@/features/purchasing/PurchaseOrderPage'
import MrpPage from '@/features/purchasing/MrpPage'
// 품질관리
import InspectionListPage from '@/features/quality/InspectionListPage'
import CapaListPage from '@/features/quality/CapaListPage'
import CgmpDocListPage from '@/features/quality/CgmpDocListPage'
// 재고관리
import IncomingPage from '@/features/inventory/IncomingPage'
import OutgoingPage from '@/features/inventory/OutgoingPage'
import StockListPage from '@/features/inventory/StockListPage'
import TransactionListPage from '@/features/inventory/TransactionListPage'
import TransferPage from '@/features/inventory/TransferPage'
import InventoryLedgerPage from '@/features/inventory/InventoryLedgerPage'
import StockCountPage from '@/features/inventory/StockCountPage'
import SafetyStockAlertPage from '@/features/inventory/SafetyStockAlertPage'
import LotTrackingPage from '@/features/inventory/LotTrackingPage'
// 원가/외주
import CostCalculationPage from '@/features/cost/CostCalculationPage'
import OutsourcingOrderPage from '@/features/outsourcing/OutsourcingOrderPage'
// 회계/세무
import JournalEntryPage from '@/features/accounting/JournalEntryPage'
import FinancialStatementPage from '@/features/accounting/FinancialStatementPage'
import TaxInvoicePage from '@/features/accounting/TaxInvoicePage'
// 인사/급여
import EmployeeListPage from '@/features/hr/EmployeeListPage'
import AttendancePage from '@/features/hr/AttendancePage'
import PayrollPage from '@/features/hr/PayrollPage'
// 설비
import EquipmentListPage from '@/features/equipment/EquipmentListPage'
import MaintenanceLogPage from '@/features/equipment/MaintenanceLogPage'
// 전자결재/계약
import ApprovalRequestPage from '@/features/approval/ApprovalRequestPage'
import ContractListPage from '@/features/contract/ContractListPage'
// 그룹웨어
import NoticeBoardPage from '@/features/groupware/NoticeBoardPage'
import SchedulePage from '@/features/groupware/SchedulePage'
import FileSharePage from '@/features/groupware/FileSharePage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
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
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AuthGuard><MainLayout /></AuthGuard>}>
              <Route path="/dashboard" element={<DashboardHome />} />
              {/* 기초정보 */}
              <Route path="/master/items" element={<RoleGuard module="inventory"><ItemListPage /></RoleGuard>} />
              <Route path="/master/partners" element={<PartnerListPage />} />
              <Route path="/master/warehouses" element={<RoleGuard module="inventory"><WarehouseListPage /></RoleGuard>} />
              {/* 영업관리 */}
              <Route path="/sales/quotations" element={<RoleGuard module="sales"><QuotationPage /></RoleGuard>} />
              <Route path="/sales/orders" element={<RoleGuard module="sales"><SalesOrderPage /></RoleGuard>} />
              <Route path="/sales/shipments" element={<RoleGuard module="sales"><ShipmentPage /></RoleGuard>} />
              <Route path="/sales/statements" element={<RoleGuard module="sales"><SalesStatementPage /></RoleGuard>} />
              <Route path="/sales/analysis" element={<RoleGuard module="sales"><SalesAnalysisPage /></RoleGuard>} />
              {/* CRM */}
              <Route path="/crm/contacts" element={<RoleGuard module="crm"><ContactLogPage /></RoleGuard>} />
              <Route path="/crm/grades" element={<RoleGuard module="crm"><CustomerGradePage /></RoleGuard>} />
              <Route path="/crm/service" element={<RoleGuard module="crm"><ServiceRequestPage /></RoleGuard>} />
              {/* R&D */}
              <Route path="/rnd/ingredients" element={<RoleGuard module="rnd"><IngredientListPage /></RoleGuard>} />
              <Route path="/rnd/formulas" element={<RoleGuard module="rnd"><FormulaListPage /></RoleGuard>} />
              <Route path="/rnd/formulas/:id" element={<RoleGuard module="rnd"><FormulaDetailPage /></RoleGuard>} />
              {/* 생산관리 */}
              <Route path="/production/plans" element={<RoleGuard module="production"><ProductionPlanPage /></RoleGuard>} />
              <Route path="/production/work-orders" element={<RoleGuard module="production"><WorkOrderListPage /></RoleGuard>} />
              <Route path="/production/bom" element={<RoleGuard module="production"><BomListPage /></RoleGuard>} />
              <Route path="/production/weighing" element={<RoleGuard module="production"><WeighingPage /></RoleGuard>} />
              <Route path="/production/manufacturing" element={<RoleGuard module="production"><ManufacturingPage /></RoleGuard>} />
              <Route path="/production/packaging" element={<RoleGuard module="production"><PackagingPage /></RoleGuard>} />
              <Route path="/production/monitor" element={<RoleGuard module="production"><ProductionMonitorPage /></RoleGuard>} />
              {/* 구매관리 */}
              <Route path="/purchasing/orders" element={<RoleGuard module="purchasing"><PurchaseOrderPage /></RoleGuard>} />
              <Route path="/purchasing/mrp" element={<RoleGuard module="mrp"><MrpPage /></RoleGuard>} />
              {/* 품질관리 */}
              <Route path="/quality/inspections" element={<RoleGuard module="quality"><InspectionListPage /></RoleGuard>} />
              <Route path="/quality/capa" element={<RoleGuard module="quality"><CapaListPage /></RoleGuard>} />
              <Route path="/quality/cgmp" element={<RoleGuard module="quality"><CgmpDocListPage /></RoleGuard>} />
              {/* 재고관리 */}
              <Route path="/inventory/incoming" element={<RoleGuard module="inventory"><IncomingPage /></RoleGuard>} />
              <Route path="/inventory/outgoing" element={<RoleGuard module="inventory"><OutgoingPage /></RoleGuard>} />
              <Route path="/inventory/stock" element={<RoleGuard module="inventory"><StockListPage /></RoleGuard>} />
              <Route path="/inventory/transactions" element={<RoleGuard module="inventory"><TransactionListPage /></RoleGuard>} />
              <Route path="/inventory/transfer" element={<RoleGuard module="inventory"><TransferPage /></RoleGuard>} />
              <Route path="/inventory/ledger" element={<RoleGuard module="inventory"><InventoryLedgerPage /></RoleGuard>} />
              <Route path="/inventory/count" element={<RoleGuard module="inventory"><StockCountPage /></RoleGuard>} />
              <Route path="/inventory/safety-stock" element={<RoleGuard module="inventory"><SafetyStockAlertPage /></RoleGuard>} />
              <Route path="/inventory/lot" element={<RoleGuard module="inventory"><LotTrackingPage /></RoleGuard>} />
              {/* 원가/외주 */}
              <Route path="/cost/calculation" element={<RoleGuard module="cost"><CostCalculationPage /></RoleGuard>} />
              <Route path="/outsourcing/orders" element={<RoleGuard module="outsourcing"><OutsourcingOrderPage /></RoleGuard>} />
              {/* 회계/세무 */}
              <Route path="/accounting/journal" element={<RoleGuard module="accounting"><JournalEntryPage /></RoleGuard>} />
              <Route path="/accounting/financial" element={<RoleGuard module="accounting"><FinancialStatementPage /></RoleGuard>} />
              <Route path="/accounting/tax-invoice" element={<RoleGuard module="tax"><TaxInvoicePage /></RoleGuard>} />
              {/* 인사/급여 */}
              <Route path="/hr/employees" element={<RoleGuard module="hr"><EmployeeListPage /></RoleGuard>} />
              <Route path="/hr/attendance" element={<RoleGuard module="hr"><AttendancePage /></RoleGuard>} />
              <Route path="/hr/payroll" element={<RoleGuard module="payroll"><PayrollPage /></RoleGuard>} />
              {/* 설비 */}
              <Route path="/equipment/list" element={<RoleGuard module="equipment"><EquipmentListPage /></RoleGuard>} />
              <Route path="/equipment/maintenance" element={<RoleGuard module="equipment"><MaintenanceLogPage /></RoleGuard>} />
              {/* 전자결재/계약 */}
              <Route path="/approval/requests" element={<RoleGuard module="approval"><ApprovalRequestPage /></RoleGuard>} />
              <Route path="/contract/list" element={<RoleGuard module="contract"><ContractListPage /></RoleGuard>} />
              {/* 그룹웨어 */}
              <Route path="/groupware/notice" element={<RoleGuard module="groupware"><NoticeBoardPage /></RoleGuard>} />
              <Route path="/groupware/schedule" element={<SchedulePage />} />
              <Route path="/groupware/files" element={<RoleGuard module="groupware"><FileSharePage /></RoleGuard>} />
              {/* 시스템관리 */}
              <Route path="/admin/users" element={<RoleGuard ceoOnly><UserManagePage /></RoleGuard>} />
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
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500">구현 예정</p>
      </div>
    </div>
  )
}

export default App
