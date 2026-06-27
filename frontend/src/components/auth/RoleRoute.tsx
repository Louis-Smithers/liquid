import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface RoleRouteProps {
  allow: string[];
  fallback?: string;
}

const roleFallbacks: Record<string, string> = {
  admin: '/admin',
  staff: '/clients',
  external: '/broker',
  client: '/portal',
};

export function RoleRoute({ allow, fallback }: RoleRouteProps) {
  const { session, isLoading, role } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!session) return <Navigate to="/login" replace />;
  if (role && allow.includes(role)) return <Outlet />;

  const dest = fallback ?? (role ? roleFallbacks[role] : '/login') ?? '/login';
  return <Navigate to={dest} replace />;
}
