/**
 * Route protection components for role-based access control
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

type Role = 'admin' | 'technician' | 'viewer';

interface RequireRoleProps {
    /** Allowed roles for this route */
    roles: Role[];
    /** The component to render if authorized */
    children: React.ReactNode;
    /** Where to redirect if unauthorized (default: /dashboard) */
    redirectTo?: string;
}

/**
 * RequireRole - Protects routes based on user role
 * 
 * Usage:
 * <Route 
 *   path="/users" 
 *   element={
 *     <RequireRole roles={['admin']}>
 *       <UserManagementPage />
 *     </RequireRole>
 *   } 
 * />
 */
export function RequireRole({ roles, children, redirectTo = '/dashboard' }: RequireRoleProps) {
    const { user, isAuthenticated } = useAuth();
    const location = useLocation();

    // Not authenticated - redirect to login
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // No user or role - shouldn't happen, but handle it
    if (!user?.role) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check if user's role is in the allowed roles
    if (!roles.includes(user.role)) {
        // User doesn't have required role - redirect to dashboard or specified route
        return <Navigate to={redirectTo} replace />;
    }

    // User is authorized
    return <>{children}</>;
}

/**
 * RequireAdmin - Shortcut for admin-only routes
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
    return <RequireRole roles={['admin']}>{children}</RequireRole>;
}

/**
 * RequireStaff - Allows admin and technician roles
 */
export function RequireStaff({ children }: { children: React.ReactNode }) {
    return <RequireRole roles={['admin', 'technician']}>{children}</RequireRole>;
}

/**
 * Hook to check if current user has a specific role
 */
export function useHasRole(roles: Role[]): boolean {
    const { user, isAuthenticated } = useAuth();

    if (!isAuthenticated || !user?.role) {
        return false;
    }

    return roles.includes(user.role);
}

/**
 * Hook to check if current user is admin
 */
export function useIsAdmin(): boolean {
    return useHasRole(['admin']);
}

/**
 * Hook to check if current user can access a specific route
 */
import { canAccessRoute } from '@/lib/permissions';

/**
 * Hook to check if current user can access a specific route
 */
export function useCanAccessRoute(route: string): boolean {
    const { user, isAuthenticated } = useAuth();

    if (!isAuthenticated || !user?.role) {
        return false;
    }

    return canAccessRoute(user.role, route);
}
