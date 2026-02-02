/**
 * Data Quality Monitor Service
 * 
 * Real-time monitoring of data transmission quality from medical devices.
 * Tracks packet loss rate, checksum errors, and data completeness.
 */

import { EventEmitter } from 'events';
import { getDatabase } from '../database/index.js';

export interface DataQualityMetrics {
  instrumentId: number;
  totalPackets: number;
  successfulPackets: number;
  failedPackets: number;
  checksumErrors: number;
  packetLossRate: number;      // Percentage (0-100)
  checksumErrorRate: number;   // Percentage (0-100)
  dataCompleteness: number;    // Percentage (0-100)
  lastUpdate: Date;
  windowStartTime: Date;
}

export interface QualityAlert {
  instrumentId: number;
  type: 'packet_loss' | 'checksum_error' | 'completeness';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

interface MetricsWindow {
  totalPackets: number;
  successfulPackets: number;
  failedPackets: number;
  checksumErrors: number;
  incompleteData: number;
  windowStartTime: Date;
}

class DataQualityMonitorService extends EventEmitter {
  private metricsWindows: Map<number, MetricsWindow> = new Map();
  private windowDurationMs = 5 * 60 * 1000; // 5 minute rolling window
  
  // Thresholds for alerts
  private thresholds = {
    packetLoss: {
      warning: 0.5,    // 0.5%
      critical: 2.0    // 2%
    },
    checksumError: {
      warning: 0.5,    // 0.5%
      critical: 1.0    // 1%
    },
    completeness: {
      warning: 98,     // Below 98%
      critical: 95     // Below 95%
    }
  };

  constructor() {
    super();
  }

  /**
   * Record a successful packet reception
   */
  recordSuccess(instrumentId: number): void {
    const window = this.getOrCreateWindow(instrumentId);
    window.totalPackets++;
    window.successfulPackets++;
    this.checkAlerts(instrumentId);
  }

  /**
   * Record a failed packet (e.g., timeout, incomplete)
   */
  recordFailure(instrumentId: number): void {
    const window = this.getOrCreateWindow(instrumentId);
    window.totalPackets++;
    window.failedPackets++;
    this.checkAlerts(instrumentId);
  }

  /**
   * Record a checksum error
   */
  recordChecksumError(instrumentId: number): void {
    const window = this.getOrCreateWindow(instrumentId);
    window.totalPackets++;
    window.checksumErrors++;
    this.checkAlerts(instrumentId);
  }

  /**
   * Record incomplete data (missing required fields)
   */
  recordIncompleteData(instrumentId: number): void {
    const window = this.getOrCreateWindow(instrumentId);
    window.incompleteData++;
    this.checkAlerts(instrumentId);
  }

  /**
   * Get or create a metrics window for an instrument
   */
  private getOrCreateWindow(instrumentId: number): MetricsWindow {
    let window = this.metricsWindows.get(instrumentId);
    const now = new Date();
    
    // Reset window if expired
    if (window && (now.getTime() - window.windowStartTime.getTime()) > this.windowDurationMs) {
      // Save historical metrics before reset
      this.saveHistoricalMetrics(instrumentId, window);
      window = undefined;
    }
    
    if (!window) {
      window = {
        totalPackets: 0,
        successfulPackets: 0,
        failedPackets: 0,
        checksumErrors: 0,
        incompleteData: 0,
        windowStartTime: now
      };
      this.metricsWindows.set(instrumentId, window);
    }
    
    return window;
  }

  /**
   * Get current quality metrics for an instrument
   */
  getMetrics(instrumentId: number): DataQualityMetrics | null {
    const window = this.metricsWindows.get(instrumentId);
    if (!window || window.totalPackets === 0) {
      return null;
    }
    
    const packetLossRate = (window.failedPackets / window.totalPackets) * 100;
    const checksumErrorRate = (window.checksumErrors / window.totalPackets) * 100;
    const completenessRate = window.totalPackets > 0 
      ? ((window.totalPackets - window.incompleteData) / window.totalPackets) * 100 
      : 100;
    
    return {
      instrumentId,
      totalPackets: window.totalPackets,
      successfulPackets: window.successfulPackets,
      failedPackets: window.failedPackets,
      checksumErrors: window.checksumErrors,
      packetLossRate: Math.round(packetLossRate * 100) / 100,
      checksumErrorRate: Math.round(checksumErrorRate * 100) / 100,
      dataCompleteness: Math.round(completenessRate * 100) / 100,
      lastUpdate: new Date(),
      windowStartTime: window.windowStartTime
    };
  }

  /**
   * Get metrics for all monitored instruments
   */
  getAllMetrics(): DataQualityMetrics[] {
    const metrics: DataQualityMetrics[] = [];
    for (const instrumentId of this.metricsWindows.keys()) {
      const m = this.getMetrics(instrumentId);
      if (m) metrics.push(m);
    }
    return metrics;
  }

  /**
   * Check if any thresholds are exceeded and emit alerts
   */
  private checkAlerts(instrumentId: number): void {
    const metrics = this.getMetrics(instrumentId);
    if (!metrics || metrics.totalPackets < 10) {
      // Need at least 10 packets for meaningful statistics
      return;
    }
    
    const alerts: QualityAlert[] = [];
    
    // Check packet loss
    if (metrics.packetLossRate >= this.thresholds.packetLoss.critical) {
      alerts.push({
        instrumentId,
        type: 'packet_loss',
        severity: 'critical',
        message: `Critical packet loss rate: ${metrics.packetLossRate.toFixed(2)}%`,
        value: metrics.packetLossRate,
        threshold: this.thresholds.packetLoss.critical,
        timestamp: new Date()
      });
    } else if (metrics.packetLossRate >= this.thresholds.packetLoss.warning) {
      alerts.push({
        instrumentId,
        type: 'packet_loss',
        severity: 'warning',
        message: `High packet loss rate: ${metrics.packetLossRate.toFixed(2)}%`,
        value: metrics.packetLossRate,
        threshold: this.thresholds.packetLoss.warning,
        timestamp: new Date()
      });
    }
    
    // Check checksum errors
    if (metrics.checksumErrorRate >= this.thresholds.checksumError.critical) {
      alerts.push({
        instrumentId,
        type: 'checksum_error',
        severity: 'critical',
        message: `Critical checksum error rate: ${metrics.checksumErrorRate.toFixed(2)}%`,
        value: metrics.checksumErrorRate,
        threshold: this.thresholds.checksumError.critical,
        timestamp: new Date()
      });
    } else if (metrics.checksumErrorRate >= this.thresholds.checksumError.warning) {
      alerts.push({
        instrumentId,
        type: 'checksum_error',
        severity: 'warning',
        message: `High checksum error rate: ${metrics.checksumErrorRate.toFixed(2)}%`,
        value: metrics.checksumErrorRate,
        threshold: this.thresholds.checksumError.warning,
        timestamp: new Date()
      });
    }
    
    // Check data completeness
    if (metrics.dataCompleteness < this.thresholds.completeness.critical) {
      alerts.push({
        instrumentId,
        type: 'completeness',
        severity: 'critical',
        message: `Critical data completeness: ${metrics.dataCompleteness.toFixed(2)}%`,
        value: metrics.dataCompleteness,
        threshold: this.thresholds.completeness.critical,
        timestamp: new Date()
      });
    } else if (metrics.dataCompleteness < this.thresholds.completeness.warning) {
      alerts.push({
        instrumentId,
        type: 'completeness',
        severity: 'warning',
        message: `Low data completeness: ${metrics.dataCompleteness.toFixed(2)}%`,
        value: metrics.dataCompleteness,
        threshold: this.thresholds.completeness.warning,
        timestamp: new Date()
      });
    }
    
    // Emit alerts
    for (const alert of alerts) {
      this.emit('quality-alert', alert);
      console.warn(`[DataQuality] ${alert.severity.toUpperCase()}: ${alert.message}`);
    }
  }

  /**
   * Save historical metrics to database for long-term analysis
   */
  private saveHistoricalMetrics(instrumentId: number, window: MetricsWindow): void {
    try {
      const db = getDatabase();
      const metrics = this.calculateMetricsFromWindow(instrumentId, window);
      
      db.prepare(`
        INSERT INTO data_quality_history 
        (instrument_id, total_packets, successful_packets, failed_packets, 
         checksum_errors, packet_loss_rate, checksum_error_rate, data_completeness,
         window_start, window_end)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        instrumentId,
        window.totalPackets,
        window.successfulPackets,
        window.failedPackets,
        window.checksumErrors,
        metrics.packetLossRate,
        metrics.checksumErrorRate,
        metrics.dataCompleteness,
        window.windowStartTime.toISOString(),
        new Date().toISOString()
      );
    } catch (err) {
      // Table might not exist yet, log but don't fail
      console.error('[DataQuality] Failed to save historical metrics:', err);
    }
  }

  /**
   * Calculate metrics from a window
   */
  private calculateMetricsFromWindow(instrumentId: number, window: MetricsWindow): DataQualityMetrics {
    const packetLossRate = window.totalPackets > 0 
      ? (window.failedPackets / window.totalPackets) * 100 
      : 0;
    const checksumErrorRate = window.totalPackets > 0 
      ? (window.checksumErrors / window.totalPackets) * 100 
      : 0;
    const completenessRate = window.totalPackets > 0 
      ? ((window.totalPackets - window.incompleteData) / window.totalPackets) * 100 
      : 100;
    
    return {
      instrumentId,
      totalPackets: window.totalPackets,
      successfulPackets: window.successfulPackets,
      failedPackets: window.failedPackets,
      checksumErrors: window.checksumErrors,
      packetLossRate: Math.round(packetLossRate * 100) / 100,
      checksumErrorRate: Math.round(checksumErrorRate * 100) / 100,
      dataCompleteness: Math.round(completenessRate * 100) / 100,
      lastUpdate: new Date(),
      windowStartTime: window.windowStartTime
    };
  }

  /**
   * Get historical quality data for an instrument
   */
  getHistory(instrumentId: number, hours: number = 24): any[] {
    try {
      const db = getDatabase();
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      return db.prepare(`
        SELECT * FROM data_quality_history
        WHERE instrument_id = ? AND window_start >= ?
        ORDER BY window_start DESC
      `).all(instrumentId, since);
    } catch (err) {
      console.error('[DataQuality] Failed to get history:', err);
      return [];
    }
  }

  /**
   * Configure alert thresholds
   */
  setThresholds(thresholds: Partial<typeof this.thresholds>): void {
    if (thresholds.packetLoss) {
      this.thresholds.packetLoss = { ...this.thresholds.packetLoss, ...thresholds.packetLoss };
    }
    if (thresholds.checksumError) {
      this.thresholds.checksumError = { ...this.thresholds.checksumError, ...thresholds.checksumError };
    }
    if (thresholds.completeness) {
      this.thresholds.completeness = { ...this.thresholds.completeness, ...thresholds.completeness };
    }
  }

  /**
   * Reset metrics for an instrument
   */
  reset(instrumentId: number): void {
    this.metricsWindows.delete(instrumentId);
    console.log(`[DataQuality] Metrics reset for instrument ${instrumentId}`);
  }

  /**
   * Reset all metrics
   */
  resetAll(): void {
    this.metricsWindows.clear();
    console.log('[DataQuality] All metrics reset');
  }
}

// Singleton instance
export const dataQualityMonitor = new DataQualityMonitorService();
