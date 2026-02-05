/**
 * Frontend Permission Configuration
 * Mirrors the backend RBAC configuration for UI visibility and routing
 */

export type Role = 'admin' | 'technician' | 'viewer';
export type Action = 'read' | 'create' | 'update' | 'delete' | 'verify' | 'release' | 'export' | 'manage';

export type Resource =
    | 'users'
    | 'audit_logs'
    | 'settings'
    | 'backup'
    | 'patients'
    | 'samples'
    | 'orders'
    | 'results'
    | 'test_panels'
    | 'instruments'
    | 'equipment'
    | 'qc'
    | 'reports'
    | 'license'
    | 'sync';

// Permission matrix: resource -> action -> allowed roles
const PERMISSIONS: Record<Resource, Partial<Record<Action, Role[]>>> = {
    users: {
        read: ['admin'],
        create: ['admin'],
        update: ['admin'],
        delete: ['admin'],
        manage: ['admin'],
    },
    audit_logs: {
        read: ['admin'],
        export: ['admin'],
    },
    settings: {
        read: ['admin', 'technician', 'viewer'],
        update: ['admin'],
        manage: ['admin'],
    },
    backup: {
        read: ['admin'],
        create: ['admin'],
        manage: ['admin'],
    },
    license: {
        read: ['admin', 'technician', 'viewer'],
        manage: ['admin'],
    },
    sync: {
        read: ['admin'],
        manage: ['admin'],
    },
    patients: {
        read: ['admin', 'technician', 'viewer'],
        create: ['admin', 'technician'],
        update: ['admin', 'technician'],
        delete: ['admin'],
    },
    samples: {
        read: ['admin', 'technician', 'viewer'],
        create: ['admin', 'technician'],
        update: ['admin', 'technician'],
        delete: ['admin'],
    },
    orders: {
        read: ['admin', 'technician', 'viewer'],
        create: ['admin', 'technician'],
        update: ['admin', 'technician'],
        delete: ['admin'],
    },
    results: {
        read: ['admin', 'technician', 'viewer'],
        create: ['admin', 'technician'],
        update: ['admin', 'technician'],
        verify: ['admin', 'technician'],
        release: ['admin', 'technician'],
        delete: ['admin'],
    },
    test_panels: {
        read: ['admin', 'technician', 'viewer'],
        create: ['admin'],
        update: ['admin'],
        delete: ['admin'],
        manage: ['admin'],
    },
    instruments: {
        read: ['admin', 'technician', 'viewer'],
        create: ['admin'],
        update: ['admin', 'technician'],
        delete: ['admin'],
        manage: ['admin'],
    },
    equipment: {
        read: ['admin', 'technician', 'viewer'],
        create: ['admin', 'technician'],
        update: ['admin', 'technician'],
        delete: ['admin'],
    },
    qc: {
        read: ['admin', 'technician', 'viewer'],
        create: ['admin', 'technician'],
        update: ['admin', 'technician'],
        delete: ['admin'],
    },
    reports: {
        read: ['admin', 'technician', 'viewer'],
        create: ['admin', 'technician'],
        export: ['admin', 'technician', 'viewer'],
    },
};

// Navigation permissions: which routes each role can access
export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
    '/dashboard': ['admin', 'technician', 'viewer'],
    '/patients': ['admin', 'technician', 'viewer'],
    '/samples': ['admin', 'technician', 'viewer'],
    '/orders/new': ['admin', 'technician'],
    '/worklist': ['admin', 'technician'],
    '/results': ['admin', 'technician', 'viewer'],
    '/test-catalog': ['admin', 'technician', 'viewer'],
    '/instruments': ['admin', 'technician', 'viewer'],
    '/equipment': ['admin', 'technician', 'viewer'],
    '/unmatched': ['admin', 'technician'],
    '/reports': ['admin', 'technician', 'viewer'],
    '/settings': ['admin'],
    '/users': ['admin'],
    '/audit-logs': ['admin'],
    '/feedback': ['admin', 'technician', 'viewer'],
};

/**
 * Check if a role has permission to perform an action on a resource
 */
export function hasPermission(role: Role | null | undefined, resource: Resource, action: Action): boolean {
    if (!role) return false;
    const resourcePerms = PERMISSIONS[resource];
    if (!resourcePerms) return false;

    const allowedRoles = resourcePerms[action];
    if (!allowedRoles) return false;

    return allowedRoles.includes(role);
}

/**
 * Check if a role can access a specific route
 */
export function canAccessRoute(role: Role | null | undefined, route: string): boolean {
    if (!role) return false;

    // Handle dynamic routes (e.g., /patients/123)
    const normalizedRoute = route.replace(/\/\d+/g, '/:id');

    // Try exact match first
    if (ROUTE_PERMISSIONS[normalizedRoute]) {
        return ROUTE_PERMISSIONS[normalizedRoute].includes(role);
    }

    // Try prefix match for nested routes
    const routeParts = route.split('/').filter(Boolean);
    for (let i = routeParts.length; i > 0; i--) {
        const partialRoute = '/' + routeParts.slice(0, i).join('/');
        if (ROUTE_PERMISSIONS[partialRoute]) {
            return ROUTE_PERMISSIONS[partialRoute].includes(role);
        }
    }

    // Default deny
    return false;
}

/**
 * Get all resources a role can access
 */
export function getAccessibleResources(role: Role): Resource[] {
    const resources: Resource[] = [];

    for (const [resource, actions] of Object.entries(PERMISSIONS)) {
        for (const [, roles] of Object.entries(actions)) {
            if (roles?.includes(role)) {
                resources.push(resource as Resource);
                break;
            }
        }
    }

    return resources;
}

/**
 * Get all routes a role can access
 */
export function getAccessibleRoutes(role: Role): string[] {
    return Object.entries(ROUTE_PERMISSIONS)
        .filter(([, roles]) => roles.includes(role))
        .map(([route]) => route);
}

/**
 * Get human-readable role name
 */
export function getRoleDisplayName(role: Role): string {
    const names: Record<Role, string> = {
        admin: 'Administrator',
        technician: 'Technician',
        viewer: 'Viewer',
    };
    return names[role] || role;
}
