import { Navigate } from 'react-router-dom';
import { useAuth } from '@client/src/common/platform/auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions: { action: string; subject: string }[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredPermissions }) => {
  const { ability, isLoading } = useAuth();

  if (isLoading || !ability) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasPermission = (requiredPermissions ?? []).every(
    ({ action, subject }) => ability.can(action, subject),
  );
  if (!hasPermission) {
    return <Navigate to="/price-query" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
