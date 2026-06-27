import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'

// Pages — staff
import { ClientsPage } from './pages/ClientsPage'
import { DebtorsPage } from './pages/DebtorsPage'
import { ImportQueuePage } from './pages/ImportQueuePage'
import { TheGatePage } from './pages/TheGatePage'
import { NSQueuePage } from './pages/NSQueuePage'
import { NSQueueUploadPage } from './pages/NSQueueUploadPage'
import { InvoiceScanPage } from './pages/InvoiceScanPage'
import { LoansPage } from './pages/LoansPage'

// Pages — admin
import { AdminPage } from './pages/AdminPage'
import { BrokerOversightPage } from './pages/BrokerOversightPage'

// Pages — client portal
import { ClientPortalPage } from './pages/portal/ClientPortalPage'
import { ClientPortalInvoicesPage } from './pages/portal/ClientPortalInvoicesPage'
import { ClientPortalDebtorsPage } from './pages/portal/ClientPortalDebtorsPage'
import { ClientPortalAgingPage } from './pages/portal/ClientPortalAgingPage'
import { ClientPortalNsPage } from './pages/portal/ClientPortalNsPage'

// Pages — broker portal
import { BrokerPortalPage } from './pages/broker/BrokerPortalPage'
import { BrokerSubmissionDetailPage } from './pages/broker/BrokerSubmissionDetailPage'

// Pages — public/shared
import { LoginPage } from './pages/LoginPage'
import { RequestAccessPage } from './pages/RequestAccessPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'

// Auth components
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { StaffRoute } from './components/auth/StaffRoute'
import { ClientRoute } from './components/auth/ClientRoute'
import { RoleRoute } from './components/auth/RoleRoute'
import { MustChangePasswordGuard } from './components/auth/MustChangePasswordGuard'
import { useAuth } from './context/AuthContext'

function AppLayoutWrapper() {
  return (
    <MustChangePasswordGuard>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </MustChangePasswordGuard>
  );
}

function RoleAwareRoot() {
  const { role, session, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'external') return <Navigate to="/broker" replace />;
  if (role === 'client') return <Navigate to="/portal" replace />;
  return <Navigate to="/clients" replace />;
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

          {/* Role-aware root redirect */}
          <Route path="/" element={<RoleAwareRoot />} />

          {/* Staff-only routes (role === 'staff') */}
          <Route element={<StaffRoute />}>
            <Route element={<AppLayoutWrapper />}>
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/debtors" element={<DebtorsPage />} />
              <Route path="/queue" element={<ImportQueuePage />} />
              <Route path="/gate/:invoiceId" element={<TheGatePage />} />
              <Route path="/ns-queue" element={<NSQueuePage />} />
              <Route path="/ns-queue/upload" element={<NSQueueUploadPage />} />
              <Route path="/loans" element={<LoansPage />} />
              <Route path="/scan" element={<InvoiceScanPage />} />
            </Route>
          </Route>
            
          {/* Staff & Admin shared routes */}
          <Route element={<RoleRoute allow={['staff', 'admin']} />}>
            <Route element={<AppLayoutWrapper />}>
              <Route path="/broker-oversight" element={<BrokerOversightPage />} />
            </Route>
          </Route>

          {/* Admin-only routes (role === 'admin') */}
          <Route element={<RoleRoute allow={['admin']} />}>
            <Route element={<AppLayoutWrapper />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>

          {/* Client portal routes (role === 'client') */}
          <Route element={<ClientRoute />}>
            <Route element={<AppLayoutWrapper />}>
              <Route path="/portal" element={<ClientPortalPage />} />
              <Route path="/portal/invoices" element={<ClientPortalInvoicesPage />} />
              <Route path="/portal/debtors" element={<ClientPortalDebtorsPage />} />
              <Route path="/portal/aging" element={<ClientPortalAgingPage />} />
              <Route path="/portal/ns" element={<ClientPortalNsPage />} />
            </Route>
          </Route>

          {/* Broker portal routes (role === 'external') */}
          <Route element={<RoleRoute allow={['external']} />}>
            <Route element={<AppLayoutWrapper />}>
              <Route path="/broker" element={<BrokerPortalPage />} />
              <Route path="/broker/:id" element={<BrokerSubmissionDetailPage />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
