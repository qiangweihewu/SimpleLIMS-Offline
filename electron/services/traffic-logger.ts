/**
 * Raw Traffic Logger Service
 * 
 * Logs all raw byte streams from medical devices for forensic analysis,
 * debugging, and protocol reverse engineering.
 */

import { getDatabase } from '../database/index.js';
import { timeSyncService } from './time-sync-service.js';

export interface TrafficLogEntry {
  id?: number;
  instrumentId: number;
  direction: 'rx' | 'tx';
  rawBytes: Buffer;
  hexDump: string;
  receiptTimestamp: string;
  createdAt?: string;
}

export interface TrafficLogQuery {
  instrumentId?: number;
  direction?: 'rx' | 'tx';
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

class TrafficLoggerService {
  private enabled = true;
  private maxLogAgeDays = 30; // Auto-cleanup logs older than 30 days

  constructor() {}

  /**
   * Log incoming data from device
   */
  logReceive(instrumentId: number, data: Buffer): void {
    if (!this.enabled) return;
    this.log(instrumentId, 'rx', data);
  }

  /**
   * Log outgoing data to device
   */
  logTransmit(instrumentId: number, data: Buffer): void {
    if (!this.enabled) return;
    this.log(instrumentId, 'tx', data);
  }

  /**
   * Internal log method
   */
  private log(instrumentId: number, direction: 'rx' | 'tx', data: Buffer): void {
    try {
      const db = getDatabase();
      const receiptTimestamp = timeSyncService.getReceiptTimestamp();
      const hexDump = this.formatHexDump(data);
      
      db.prepare(`
        INSERT INTO device_traffic_log 
        (instrument_id, direction, raw_bytes, hex_dump, receipt_timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        instrumentId,
        direction,
        data,
        hexDump,
        receiptTimestamp
      );
    } catch (err) {
      // Don't let logging failures affect normal operation
      console.error('[TrafficLogger] Failed to log traffic:', err);
    }
  }

  /**
   * Format buffer as readable hex dump
   */
  private formatHexDump(data: Buffer): string {
    const lines: string[] = [];
    const bytesPerLine = 16;
    
    for (let i = 0; i < data.length; i += bytesPerLine) {
      const slice = data.slice(i, Math.min(i + bytesPerLine, data.length));
      
      // Hex part
      const hexPart = Array.from(slice)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
      
      // ASCII part
      const asciiPart = Array.from(slice)
        .map(b => (b >= 0x20 && b <= 0x7E) ? String.fromCharCode(b) : '.')
        .join('');
      
      // Offset
      const offset = i.toString(16).padStart(4, '0').toUpperCase();
      
      lines.push(`${offset}: ${hexPart.padEnd(48)} ${asciiPart}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Query traffic logs
   */
  queryLogs(query: TrafficLogQuery): TrafficLogEntry[] {
    try {
      const db = getDatabase();
      const conditions: string[] = [];
      const params: any[] = [];
      
      if (query.instrumentId !== undefined) {
        conditions.push('instrument_id = ?');
        params.push(query.instrumentId);
      }
      
      if (query.direction) {
        conditions.push('direction = ?');
        params.push(query.direction);
      }
      
      if (query.startTime) {
        conditions.push('receipt_timestamp >= ?');
        params.push(query.startTime.toISOString());
      }
      
      if (query.endTime) {
        conditions.push('receipt_timestamp <= ?');
        params.push(query.endTime.toISOString());
      }
      
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      const limit = query.limit || 100;
      const offset = query.offset || 0;
      
      const rows = db.prepare(`
        SELECT id, instrument_id, direction, raw_bytes, hex_dump, receipt_timestamp, created_at
        FROM device_traffic_log
        ${whereClause}
        ORDER BY receipt_timestamp DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset) as any[];
      
      return rows.map(row => ({
        id: row.id,
        instrumentId: row.instrument_id,
        direction: row.direction,
        rawBytes: row.raw_bytes,
        hexDump: row.hex_dump,
        receiptTimestamp: row.receipt_timestamp,
        createdAt: row.created_at
      }));
    } catch (err) {
      console.error('[TrafficLogger] Failed to query logs:', err);
      return [];
    }
  }

  /**
   * Export traffic logs for a device within a time range
   */
  exportLogs(instrumentId: number, startTime: Date, endTime: Date): string {
    const logs = this.queryLogs({
      instrumentId,
      startTime,
      endTime,
      limit: 10000
    });
    
    const lines: string[] = [
      `# Device Traffic Log Export`,
      `# Instrument ID: ${instrumentId}`,
      `# Time Range: ${startTime.toISOString()} to ${endTime.toISOString()}`,
      `# Entries: ${logs.length}`,
      ''
    ];
    
    for (const log of logs) {
      lines.push(`=== ${log.direction.toUpperCase()} @ ${log.receiptTimestamp} ===`);
      lines.push(log.hexDump);
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Get traffic statistics for a device
   */
  getStats(instrumentId: number, hours: number = 24): { 
    rxCount: number; 
    txCount: number; 
    rxBytes: number; 
    txBytes: number;
    firstEntry: string | null;
    lastEntry: string | null;
  } {
    try {
      const db = getDatabase();
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const stats = db.prepare(`
        SELECT 
          direction,
          COUNT(*) as count,
          SUM(LENGTH(raw_bytes)) as bytes,
          MIN(receipt_timestamp) as first_entry,
          MAX(receipt_timestamp) as last_entry
        FROM device_traffic_log
        WHERE instrument_id = ? AND receipt_timestamp >= ?
        GROUP BY direction
      `).all(instrumentId, since) as any[];
      
      const result = {
        rxCount: 0,
        txCount: 0,
        rxBytes: 0,
        txBytes: 0,
        firstEntry: null as string | null,
        lastEntry: null as string | null
      };
      
      for (const row of stats) {
        if (row.direction === 'rx') {
          result.rxCount = row.count;
          result.rxBytes = row.bytes || 0;
        } else {
          result.txCount = row.count;
          result.txBytes = row.bytes || 0;
        }
        if (!result.firstEntry || row.first_entry < result.firstEntry) {
          result.firstEntry = row.first_entry;
        }
        if (!result.lastEntry || row.last_entry > result.lastEntry) {
          result.lastEntry = row.last_entry;
        }
      }
      
      return result;
    } catch (err) {
      console.error('[TrafficLogger] Failed to get stats:', err);
      return { rxCount: 0, txCount: 0, rxBytes: 0, txBytes: 0, firstEntry: null, lastEntry: null };
    }
  }

  /**
   * Clean up old logs
   */
  async cleanup(): Promise<number> {
    try {
      const db = getDatabase();
      const cutoffDate = new Date(Date.now() - this.maxLogAgeDays * 24 * 60 * 60 * 1000).toISOString();
      
      const result = db.prepare(`
        DELETE FROM device_traffic_log 
        WHERE receipt_timestamp < ?
      `).run(cutoffDate);
      
      console.log(`[TrafficLogger] Cleaned up ${result.changes} old log entries`);
      return result.changes;
    } catch (err) {
      console.error('[TrafficLogger] Failed to cleanup:', err);
      return 0;
    }
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[TrafficLogger] Logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
export const trafficLogger = new TrafficLoggerService();
