import { getDatabase } from '../database/index.js';

// Simple audit logger
export const auditLogger = {
    log: (action: string, entityType: string, entityId: number | string | null, details: Partial<{ oldValues: any, newValues: any, userId: number, ip: string }> = {}) => {
        try {
            const db = getDatabase();
            db.prepare(`
        INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
                details.userId || null,
                action,
                entityType,
                entityId ? String(entityId) : null,
                details.oldValues ? JSON.stringify(details.oldValues) : null,
                details.newValues ? JSON.stringify(details.newValues) : null,
                details.ip || null
            );
        } catch (err) {
            console.error('Audit logging failed:', err);
        }
    }
};
