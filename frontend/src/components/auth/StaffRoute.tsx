import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/** Only accessible to role === 'staff'. Redirects admin→/admin, external→/broker, client→/portal. */
export function StaffRoute() {
  const { session, isLoading, role } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!session) return <Navigate to="/login" replace />;
  if (role === 'staff') return <Outlet />;
  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'external') return <Navigate to="/broker" replace />;
  return <Navigate to="/portal" replace />;
}
