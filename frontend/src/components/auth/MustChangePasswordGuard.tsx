import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function MustChangePasswordGuard({ children }: { children: React.ReactNode }) {
  const { mustChangePassword, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}
