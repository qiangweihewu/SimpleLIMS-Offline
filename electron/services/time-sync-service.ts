/**
 * Time Synchronization Service (Offline-First)
 * 
 * Handles device clock drift correction without requiring network connectivity.
 * Uses local system clock as reference, with optional NTP enhancement when online.
 */

import { EventEmitter } from 'events';
import { getDatabase } from '../database/index.js';

export interface DriftRecord {
  instrumentId: number;
  offsetMs: number;
  measuredAt: Date;
  source: 'auto' | 'manual';
}

export interface TimeSyncConfig {
  instrumentId: number;
  manualOffsetMs?: number;
  autoLearnEnabled?: boolean;
}

export class TimeSyncService extends EventEmitter {
  private driftOffsets: Map<number, number> = new Map();
  private driftHistory: Map<number, DriftRecord[]> = new Map();
  private initialized = false;

  constructor() {
    super();
  }

  /**
   * Initialize service and load saved drift offsets from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const db = getDatabase();
      
      // Load saved drift offsets from settings
      const rows = db.prepare(`
        SELECT key, value FROM settings 
        WHERE key LIKE 'drift_offset_%'
      `).all() as { key: string; value: string }[];
      
      for (const row of rows) {
        const instrumentId = parseInt(row.key.replace('drift_offset_', ''));
        const offsetMs = parseInt(row.value);
        if (!isNaN(instrumentId) && !isNaN(offsetMs)) {
          this.driftOffsets.set(instrumentId, offsetMs);
          console.log(`[TimeSync] Loaded drift offset for instrument ${instrumentId}: ${offsetMs}ms`);
        }
      }
      
      this.initialized = true;
      console.log('[TimeSync] Service initialized (offline-first mode)');
    } catch (err) {
      console.error('[TimeSync] Failed to initialize:', err);
    }
  }

  /**
   * Get current system time as reference (offline mode)
   */
  getSystemTime(): Date {
    return new Date();
  }

  /**
   * Calculate device clock drift compared to system clock
   * Call this when receiving data with a device timestamp
   */
  calculateDeviceDrift(instrumentId: number, deviceTime: Date): number {
    const systemTime = this.getSystemTime();
    const driftMs = systemTime.getTime() - deviceTime.getTime();
    
    // Store in history for trend analysis
    const history = this.driftHistory.get(instrumentId) || [];
    history.push({
      instrumentId,
      offsetMs: driftMs,
      measuredAt: systemTime,
      source: 'auto'
    });
    
    // Keep last 100 measurements
    if (history.length > 100) {
      history.shift();
    }
    this.driftHistory.set(instrumentId, history);
    
    // Update running average if auto-learn is enabled
    const existingOffset = this.driftOffsets.get(instrumentId) || 0;
    const newOffset = Math.round((existingOffset * 0.9) + (driftMs * 0.1)); // Exponential moving average
    this.driftOffsets.set(instrumentId, newOffset);
    
    return driftMs;
  }

  /**
   * Correct a device timestamp using the stored drift offset
   */
  correctTimestamp(deviceTime: Date, instrumentId: number): Date {
    const offsetMs = this.driftOffsets.get(instrumentId) || 0;
    return new Date(deviceTime.getTime() + offsetMs);
  }

  /**
   * Get high-precision receipt timestamp (when data was received by system)
   * This is the most reliable timestamp for audit purposes
   */
  getReceiptTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Manually set drift offset for a device (user-configurable)
   */
  async setManualOffset(instrumentId: number, offsetMs: number): Promise<void> {
    this.driftOffsets.set(instrumentId, offsetMs);
    
    // Persist to database
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
      `).run(`drift_offset_${instrumentId}`, String(offsetMs));
      
      // Log the change
      const history = this.driftHistory.get(instrumentId) || [];
      history.push({
        instrumentId,
        offsetMs,
        measuredAt: new Date(),
        source: 'manual'
      });
      this.driftHistory.set(instrumentId, history);
      
      console.log(`[TimeSync] Manual offset set for instrument ${instrumentId}: ${offsetMs}ms`);
      this.emit('offset-updated', { instrumentId, offsetMs, source: 'manual' });
    } catch (err) {
      console.error('[TimeSync] Failed to save drift offset:', err);
      throw err;
    }
  }

  /**
   * Get drift history for a specific instrument
   */
  getDriftHistory(instrumentId: number): DriftRecord[] {
    return this.driftHistory.get(instrumentId) || [];
  }

  /**
   * Get current drift offset for an instrument
   */
  getDriftOffset(instrumentId: number): number {
    return this.driftOffsets.get(instrumentId) || 0;
  }

  /**
   * Get drift statistics for an instrument
   */
  getDriftStats(instrumentId: number): { avg: number; min: number; max: number; count: number } | null {
    const history = this.driftHistory.get(instrumentId);
    if (!history || history.length === 0) {
      return null;
    }
    
    const offsets = history.map(h => h.offsetMs);
    return {
      avg: Math.round(offsets.reduce((a, b) => a + b, 0) / offsets.length),
      min: Math.min(...offsets),
      max: Math.max(...offsets),
      count: offsets.length
    };
  }

  /**
   * Reset drift data for an instrument
   */
  async resetDrift(instrumentId: number): Promise<void> {
    this.driftOffsets.delete(instrumentId);
    this.driftHistory.delete(instrumentId);
    
    try {
      const db = getDatabase();
      db.prepare(`DELETE FROM settings WHERE key = ?`).run(`drift_offset_${instrumentId}`);
      console.log(`[TimeSync] Drift data reset for instrument ${instrumentId}`);
    } catch (err) {
      console.error('[TimeSync] Failed to reset drift:', err);
    }
  }
}

// Singleton instance
export const timeSyncService = new TimeSyncService();
