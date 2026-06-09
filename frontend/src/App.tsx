import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'

// Pages
import { ClientsPage } from './pages/ClientsPage'
import { DebtorsPage } from './pages/DebtorsPage'
import { ImportQueuePage } from './pages/ImportQueuePage'
import { AgingReportPage } from './pages/AgingReportPage'
import { TheGatePage } from './pages/TheGatePage'
import { NSQueuePage } from './pages/NSQueuePage'
import { LoginPage } from './pages/LoginPage'
import { RequestAccessPage } from './pages/RequestAccessPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { AdminPage } from './pages/AdminPage'
import { InvoiceScanPage } from './pages/InvoiceScanPage'

import { NSQueueUploadPage } from './pages/NSQueueUploadPage'

// Auth Components
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
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

          {/* Protected Routes that don't need MustChangePasswordGuard */}
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>

          {/* Fully Protected Routes inside AppLayout */}
          <Route element={<ProtectedRoute />}>
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
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
