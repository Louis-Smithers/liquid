import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/** Only accessible to staff (admin or user). Client logins are redirected to /portal. */
export function StaffRoute() {
  const { session, isLoading, role } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!session) return <Navigate to="/login" replace />;
  if (role === 'client') return <Navigate to="/portal" replace />;

  return <Outlet />;
}
