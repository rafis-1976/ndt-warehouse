import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, mfaRequired } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-airbus-sky" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (mfaRequired) return <Navigate to="/login" replace />;

  return <>{children}</>;
}