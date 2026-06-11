import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/** Only accessible to `role === 'client'`. Staff are redirected to /clients. */
export function ClientRoute() {
  const { session, isLoading, role } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!session) return <Navigate to="/login" replace />;
  if (role !== 'client') return <Navigate to="/clients" replace />;

  return <Outlet />;
}
