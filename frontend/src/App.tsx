import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'

// Pages — staff
import { ClientsPage } from './pages/ClientsPage'
import { DebtorsPage } from './pages/DebtorsPage'
import { ImportQueuePage } from './pages/ImportQueuePage'
import { AgingReportPage } from './pages/AgingReportPage'
import { TheGatePage } from './pages/TheGatePage'
import { NSQueuePage } from './pages/NSQueuePage'
import { NSQueueUploadPage } from './pages/NSQueueUploadPage'
import { AdminPage } from './pages/AdminPage'
import { InvoiceScanPage } from './pages/InvoiceScanPage'

// Pages — client portal
import { ClientPortalPage } from './pages/portal/ClientPortalPage'
import { ClientPortalInvoicesPage } from './pages/portal/ClientPortalInvoicesPage'
import { ClientPortalDebtorsPage } from './pages/portal/ClientPortalDebtorsPage'
import { ClientPortalAgingPage } from './pages/portal/ClientPortalAgingPage'

// Pages — public/shared
import { LoginPage } from './pages/LoginPage'
import { RequestAccessPage } from './pages/RequestAccessPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'

// Auth components
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { StaffRoute } from './components/auth/StaffRoute'
import { ClientRoute } from './components/auth/ClientRoute'
import { MustChangePasswordGuard } from './components/auth/MustChangePasswordGuard'

function AppLayoutWrapper() {
  return (
    <MustChangePasswordGuard>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </MustChangePasswordGuard>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/request-access" element={<RequestAccessPage />} />

          {/* Protected — no layout guard needed */}
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>

          {/* Staff-only routes (admin + user) */}
          <Route element={<StaffRoute />}>
            <Route element={<AppLayoutWrapper />}>
              <Route path="/" element={<Navigate to="/clients" replace />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/debtors" element={<DebtorsPage />} />
              <Route path="/queue" element={<ImportQueuePage />} />
              <Route path="/aging" element={<AgingReportPage />} />
              <Route path="/gate/:invoiceId" element={<TheGatePage />} />
              <Route path="/ns-queue" element={<NSQueuePage />} />
              <Route path="/ns-queue/upload" element={<NSQueueUploadPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/scan" element={<InvoiceScanPage />} />
            </Route>
          </Route>

          {/* Client portal routes */}
          <Route element={<ClientRoute />}>
            <Route element={<AppLayoutWrapper />}>
              <Route path="/portal" element={<ClientPortalPage />} />
              <Route path="/portal/invoices" element={<ClientPortalInvoicesPage />} />
              <Route path="/portal/debtors" element={<ClientPortalDebtorsPage />} />
              <Route path="/portal/aging" element={<ClientPortalAgingPage />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
