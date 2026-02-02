/**
 * Device Lifecycle Manager Service
 * 
 * Manages full lifecycle of medical devices: purchase, installation,
 * calibration, maintenance, repair, and decommissioning.
 */

import { EventEmitter } from 'events';
import { getDatabase } from '../database/index.js';

export type LifecycleEventType = 
  | 'purchase' 
  | 'install' 
  | 'calibration' 
  | 'maintenance' 
  | 'repair' 
  | 'upgrade' 
  | 'decommission';

export interface LifecycleEvent {
  id?: number;
  instrumentId: number;
  eventType: LifecycleEventType;
  eventDate: string;
  description?: string;
  cost?: number;
  performedBy?: string;
  nextDueDate?: string;
  attachments?: string[];
  createdAt?: string;
}

export interface DueReminder {
  instrumentId: number;
  instrumentName: string;
  eventType: LifecycleEventType;
  dueDate: string;
  daysUntilDue: number;
  lastEventId: number;
  lastEventDescription?: string;
}

export interface ComplianceReport {
  year: number;
  totalInstruments: number;
  calibrationCompliance: {
    compliant: number;
    nonCompliant: number;
    rate: number;
  };
  maintenanceCompliance: {
    completed: number;
    overdue: number;
    rate: number;
  };
  totalCost: number;
  costByType: Record<LifecycleEventType, number>;
  events: LifecycleEvent[];
}

class DeviceLifecycleManagerService extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Record a lifecycle event
   */
  async recordEvent(event: Omit<LifecycleEvent, 'id' | 'createdAt'>): Promise<number> {
    const db = getDatabase();
    
    const attachmentsJson = event.attachments ? JSON.stringify(event.attachments) : null;
    
    const result = db.prepare(`
      INSERT INTO device_lifecycle 
      (instrument_id, event_type, event_date, description, cost, performed_by, next_due_date, attachments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.instrumentId,
      event.eventType,
      event.eventDate,
      event.description || null,
      event.cost || null,
      event.performedBy || null,
      event.nextDueDate || null,
      attachmentsJson
    );
    
    console.log(`[Lifecycle] Recorded ${event.eventType} event for instrument ${event.instrumentId}`);
    
    this.emit('event-recorded', { ...event, id: result.lastInsertRowid });
    
    // Check if this creates a new due date reminder
    if (event.nextDueDate) {
      this.emit('due-date-set', {
        instrumentId: event.instrumentId,
        eventType: event.eventType,
        dueDate: event.nextDueDate
      });
    }
    
    return result.lastInsertRowid as number;
  }

  /**
   * Get lifecycle history for an instrument
   */
  getHistory(instrumentId: number): LifecycleEvent[] {
    const db = getDatabase();
    
    const rows = db.prepare(`
      SELECT * FROM device_lifecycle
      WHERE instrument_id = ?
      ORDER BY event_date DESC, created_at DESC
    `).all(instrumentId) as Record<string, unknown>[];
    
    return rows.map(row => this.mapRowToEvent(row));
  }

  /**
   * Get all lifecycle events for a specific type
   */
  getEventsByType(eventType: LifecycleEventType): LifecycleEvent[] {
    const db = getDatabase();
    
    const rows = db.prepare(`
      SELECT * FROM device_lifecycle
      WHERE event_type = ?
      ORDER BY event_date DESC
    `).all(eventType) as Record<string, unknown>[];
    
    return rows.map(row => this.mapRowToEvent(row));
  }

  /**
   * Get upcoming due dates across all instruments
   */
  getUpcomingDueDates(days: number): DueReminder[] {
    const db = getDatabase();
    
    const today = new Date();
    const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    
    const rows = db.prepare(`
      SELECT 
        dl.*,
        i.name as instrument_name
      FROM device_lifecycle dl
      JOIN instruments i ON dl.instrument_id = i.id
      WHERE dl.next_due_date IS NOT NULL
        AND dl.next_due_date <= ?
        AND dl.next_due_date >= ?
        AND dl.id = (
          SELECT MAX(id) FROM device_lifecycle 
          WHERE instrument_id = dl.instrument_id 
            AND event_type = dl.event_type
            AND next_due_date IS NOT NULL
        )
      ORDER BY dl.next_due_date ASC
    `).all(futureDate.toISOString().split('T')[0], today.toISOString().split('T')[0]) as any[];
    
    return rows.map(row => {
      const dueDate = new Date(row.next_due_date);
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      
      return {
        instrumentId: row.instrument_id,
        instrumentName: row.instrument_name,
        eventType: row.event_type,
        dueDate: row.next_due_date,
        daysUntilDue,
        lastEventId: row.id,
        lastEventDescription: row.description
      };
    });
  }

  /**
   * Get overdue items
   */
  getOverdueItems(): DueReminder[] {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];
    
    const rows = db.prepare(`
      SELECT 
        dl.*,
        i.name as instrument_name
      FROM device_lifecycle dl
      JOIN instruments i ON dl.instrument_id = i.id
      WHERE dl.next_due_date IS NOT NULL
        AND dl.next_due_date < ?
        AND NOT EXISTS (
          SELECT 1 FROM device_lifecycle dl2 
          WHERE dl2.instrument_id = dl.instrument_id 
            AND dl2.event_type = dl.event_type
            AND dl2.event_date > dl.event_date
        )
      ORDER BY dl.next_due_date ASC
    `).all(today) as any[];
    
    const todayDate = new Date();
    
    return rows.map(row => {
      const dueDate = new Date(row.next_due_date);
      const daysUntilDue = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));
      
      return {
        instrumentId: row.instrument_id,
        instrumentName: row.instrument_name,
        eventType: row.event_type,
        dueDate: row.next_due_date,
        daysUntilDue,
        lastEventId: row.id,
        lastEventDescription: row.description
      };
    });
  }

  /**
   * Calculate total cost of ownership for an instrument
   */
  calculateTCO(instrumentId: number): { 
    total: number; 
    byType: Record<LifecycleEventType, number>;
    byYear: Record<number, number>;
  } {
    const db = getDatabase();
    
    const rows = db.prepare(`
      SELECT event_type, event_date, cost
      FROM device_lifecycle
      WHERE instrument_id = ? AND cost IS NOT NULL
    `).all(instrumentId) as any[];
    
    const byType: Record<string, number> = {};
    const byYear: Record<number, number> = {};
    let total = 0;
    
    for (const row of rows) {
      const cost = row.cost || 0;
      total += cost;
      
      byType[row.event_type] = (byType[row.event_type] || 0) + cost;
      
      const year = new Date(row.event_date).getFullYear();
      byYear[year] = (byYear[year] || 0) + cost;
    }
    
    return {
      total,
      byType: byType as Record<LifecycleEventType, number>,
      byYear
    };
  }

  /**
   * Generate compliance report for a year
   */
  generateComplianceReport(year: number): ComplianceReport {
    const db = getDatabase();
    
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    // Get total instruments
    const instrumentCount = db.prepare(`
      SELECT COUNT(*) as count FROM instruments WHERE is_active = 1
    `).get() as { count: number };
    
    // Get all events for the year
    const events = db.prepare(`
      SELECT * FROM device_lifecycle
      WHERE event_date >= ? AND event_date <= ?
      ORDER BY event_date DESC
    `).all(startDate, endDate) as any[];
    
    // Calculate calibration compliance
    const calibratedInstruments = new Set(
      events
        .filter(e => e.event_type === 'calibration')
        .map(e => e.instrument_id)
    );
    
    // Get overdue calibrations
    const overdueCalibrations = db.prepare(`
      SELECT DISTINCT instrument_id FROM device_lifecycle
      WHERE event_type = 'calibration'
        AND next_due_date < ?
        AND NOT EXISTS (
          SELECT 1 FROM device_lifecycle dl2
          WHERE dl2.instrument_id = device_lifecycle.instrument_id
            AND dl2.event_type = 'calibration'
            AND dl2.event_date > device_lifecycle.event_date
        )
    `).all(new Date().toISOString().split('T')[0]) as any[];
    
    // Calculate costs by type
    const costByType: Record<string, number> = {};
    let totalCost = 0;
    
    for (const event of events) {
      if (event.cost) {
        costByType[event.event_type] = (costByType[event.event_type] || 0) + event.cost;
        totalCost += event.cost;
      }
    }
    
    // Calculate maintenance compliance
    const maintenanceEvents = events.filter(e => e.event_type === 'maintenance');
    
    return {
      year,
      totalInstruments: instrumentCount.count,
      calibrationCompliance: {
        compliant: calibratedInstruments.size,
        nonCompliant: overdueCalibrations.length,
        rate: instrumentCount.count > 0 
          ? Math.round((calibratedInstruments.size / instrumentCount.count) * 100) 
          : 100
      },
      maintenanceCompliance: {
        completed: maintenanceEvents.length,
        overdue: this.getOverdueItems().filter(i => i.eventType === 'maintenance').length,
        rate: 100 // Simplified - would need more complex calculation
      },
      totalCost,
      costByType: costByType as Record<LifecycleEventType, number>,
      events: events.map(row => this.mapRowToEvent(row))
    };
  }

  /**
   * Update a lifecycle event
   */
  async updateEvent(id: number, updates: Partial<LifecycleEvent>): Promise<void> {
    const db = getDatabase();
    
    const sets: string[] = [];
    const values: any[] = [];
    
    if (updates.eventDate !== undefined) {
      sets.push('event_date = ?');
      values.push(updates.eventDate);
    }
    if (updates.description !== undefined) {
      sets.push('description = ?');
      values.push(updates.description);
    }
    if (updates.cost !== undefined) {
      sets.push('cost = ?');
      values.push(updates.cost);
    }
    if (updates.performedBy !== undefined) {
      sets.push('performed_by = ?');
      values.push(updates.performedBy);
    }
    if (updates.nextDueDate !== undefined) {
      sets.push('next_due_date = ?');
      values.push(updates.nextDueDate);
    }
    if (updates.attachments !== undefined) {
      sets.push('attachments = ?');
      values.push(JSON.stringify(updates.attachments));
    }
    
    if (sets.length === 0) return;
    
    values.push(id);
    
    db.prepare(`
      UPDATE device_lifecycle
      SET ${sets.join(', ')}
      WHERE id = ?
    `).run(...values);
    
    console.log(`[Lifecycle] Updated event ${id}`);
    this.emit('event-updated', { id, updates });
  }

  /**
   * Delete a lifecycle event
   */
  async deleteEvent(id: number): Promise<void> {
    const db = getDatabase();
    
    db.prepare('DELETE FROM device_lifecycle WHERE id = ?').run(id);
    
    console.log(`[Lifecycle] Deleted event ${id}`);
    this.emit('event-deleted', { id });
  }

  /**
   * Map database row to LifecycleEvent
   */
  private mapRowToEvent(row: any): LifecycleEvent {
    return {
      id: row.id,
      instrumentId: row.instrument_id,
      eventType: row.event_type,
      eventDate: row.event_date,
      description: row.description,
      cost: row.cost,
      performedBy: row.performed_by,
      nextDueDate: row.next_due_date,
      attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
      createdAt: row.created_at
    };
  }
}

// Singleton instance
export const deviceLifecycleManager = new DeviceLifecycleManagerService();
