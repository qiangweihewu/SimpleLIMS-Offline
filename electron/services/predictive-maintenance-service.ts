/**
 * Predictive Maintenance Service
 * 
 * Evaluates device health and predicts potential failures based on:
 * - Data quality metrics (packet loss, checksum errors)
 * - Device lifecycle data (age, maintenance history, calibration status)
 * - Traffic patterns (usage frequency, anomalies)
 */

import { EventEmitter } from 'events';
import { getDatabase } from '../database/index.js';
import { dataQualityMonitor, DataQualityMetrics } from './data-quality-monitor.js';
import { deviceLifecycleManager, LifecycleEvent } from './device-lifecycle-manager.js';
import { trafficLogger } from './traffic-logger.js';

export interface DeviceHealthScore {
  instrumentId: number;
  overallScore: number;  // 0-100
  factors: {
    communicationHealth: number;
    calibrationStatus: number;
    maintenanceCompliance: number;
    usagePattern: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  predictedIssues: PredictedIssue[];
  lastUpdated: Date;
}

export interface PredictedIssue {
  type: 'communication_failure' | 'calibration_drift' | 'maintenance_needed' | 'end_of_life';
  probability: number;  // 0-100%
  estimatedTimeframe: string;  // e.g., "7 days", "1 month"
  mitigationAction: string;
}

export interface HealthAlert {
  instrumentId: number;
  instrumentName: string;
  severity: 'warning' | 'critical';
  type: 'health_degradation' | 'predicted_failure' | 'maintenance_overdue';
  message: string;
  healthScore: number;
  timestamp: Date;
}

interface HealthTrend {
  instrumentId: number;
  scores: Array<{ timestamp: Date; score: number }>;
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number; // Score change per day
}

interface InstrumentInfo {
  id: number;
  name: string;
  created_at: string;
  is_active: number;
}

class PredictiveMaintenanceService extends EventEmitter {
  private healthScores: Map<number, DeviceHealthScore> = new Map();
  private healthHistory: Map<number, Array<{ timestamp: Date; score: number }>> = new Map();
  private evaluationInterval: ReturnType<typeof setInterval> | null = null;
  
  private readonly weights = {
    communicationHealth: 0.35,
    calibrationStatus: 0.25,
    maintenanceCompliance: 0.25,
    usagePattern: 0.15
  };

  private readonly thresholds = {
    riskLevels: {
      low: 80,
      medium: 60,
      high: 40,
      critical: 0
    },
    alerts: {
      degradation: 70,
      critical: 50
    },
    calibration: {
      warningDays: 30,
      criticalDays: 7,
      overdueDays: 0
    },
    maintenance: {
      warningDays: 14,
      criticalDays: 7
    }
  };

  constructor() {
    super();
    this.setupQualityAlertListener();
  }

  private setupQualityAlertListener(): void {
    dataQualityMonitor.on('quality-alert', (alert) => {
      this.evaluateDevice(alert.instrumentId);
    });
  }

  /**
   * Start periodic health evaluation
   */
  startPeriodicEvaluation(intervalMs: number = 5 * 60 * 1000): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }
    
    this.evaluationInterval = setInterval(() => {
      this.evaluateAllDevices();
    }, intervalMs);
    
    console.log(`[PredictiveMaintenance] Started periodic evaluation every ${intervalMs / 1000}s`);
  }

  /**
   * Stop periodic evaluation
   */
  stopPeriodicEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
      console.log('[PredictiveMaintenance] Stopped periodic evaluation');
    }
  }

  /**
   * Evaluate all active devices
   */
  async evaluateAllDevices(): Promise<DeviceHealthScore[]> {
    const db = getDatabase();
    const instruments = db.prepare(`
      SELECT id, name FROM instruments WHERE is_active = 1
    `).all() as Array<{ id: number; name: string }>;
    
    const scores: DeviceHealthScore[] = [];
    
    for (const instrument of instruments) {
      const score = await this.evaluateDevice(instrument.id);
      if (score) {
        scores.push(score);
      }
    }
    
    return scores;
  }

  /**
   * Evaluate health for a specific device
   */
  async evaluateDevice(instrumentId: number): Promise<DeviceHealthScore | null> {
    try {
      const factors = {
        communicationHealth: this.calculateCommunicationHealth(instrumentId),
        calibrationStatus: this.calculateCalibrationStatus(instrumentId),
        maintenanceCompliance: this.calculateMaintenanceCompliance(instrumentId),
        usagePattern: this.calculateUsagePatternScore(instrumentId)
      };
      
      const overallScore = Math.round(
        factors.communicationHealth * this.weights.communicationHealth +
        factors.calibrationStatus * this.weights.calibrationStatus +
        factors.maintenanceCompliance * this.weights.maintenanceCompliance +
        factors.usagePattern * this.weights.usagePattern
      );
      
      const riskLevel = this.determineRiskLevel(overallScore);
      const recommendations = this.generateRecommendations(instrumentId, factors, riskLevel);
      const predictedIssues = this.predictIssues(instrumentId, factors);
      
      const healthScore: DeviceHealthScore = {
        instrumentId,
        overallScore,
        factors,
        riskLevel,
        recommendations,
        predictedIssues,
        lastUpdated: new Date()
      };
      
      const previousScore = this.healthScores.get(instrumentId);
      this.healthScores.set(instrumentId, healthScore);
      
      this.recordHealthHistory(instrumentId, overallScore);
      this.saveHealthScoreToDb(healthScore);
      
      this.checkForAlerts(instrumentId, healthScore, previousScore);
      
      return healthScore;
    } catch (err) {
      console.error(`[PredictiveMaintenance] Failed to evaluate device ${instrumentId}:`, err);
      return null;
    }
  }

  /**
   * Calculate communication health based on data quality metrics
   */
  private calculateCommunicationHealth(instrumentId: number): number {
    const metrics = dataQualityMonitor.getMetrics(instrumentId);
    
    if (!metrics || metrics.totalPackets === 0) {
      return 100; // No data yet, assume healthy
    }
    
    const packetLossPenalty = Math.min(metrics.packetLossRate * 10, 40);
    const checksumPenalty = Math.min(metrics.checksumErrorRate * 15, 30);
    const completenessPenalty = Math.max(0, (100 - metrics.dataCompleteness) * 3);
    
    const score = 100 - packetLossPenalty - checksumPenalty - completenessPenalty;
    return Math.max(0, Math.round(score));
  }

  /**
   * Calculate calibration status score
   */
  private calculateCalibrationStatus(instrumentId: number): number {
    const history = deviceLifecycleManager.getHistory(instrumentId);
    const calibrationEvents = history.filter(e => e.eventType === 'calibration');
    
    if (calibrationEvents.length === 0) {
      return 50; // No calibration history, moderate concern
    }
    
    const latestCalibration = calibrationEvents[0];
    const now = new Date();
    
    if (latestCalibration.nextDueDate) {
      const dueDate = new Date(latestCalibration.nextDueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      
      if (daysUntilDue < this.thresholds.calibration.overdueDays) {
        return 20; // Overdue
      } else if (daysUntilDue < this.thresholds.calibration.criticalDays) {
        return 50; // Critical
      } else if (daysUntilDue < this.thresholds.calibration.warningDays) {
        return 75; // Warning
      }
      return 100; // Good
    }
    
    const lastCalibrationDate = new Date(latestCalibration.eventDate);
    const daysSinceCalibration = Math.floor((now.getTime() - lastCalibrationDate.getTime()) / (24 * 60 * 60 * 1000));
    
    if (daysSinceCalibration > 365) return 30;
    if (daysSinceCalibration > 180) return 60;
    if (daysSinceCalibration > 90) return 80;
    return 100;
  }

  /**
   * Calculate maintenance compliance score
   */
  private calculateMaintenanceCompliance(instrumentId: number): number {
    const history = deviceLifecycleManager.getHistory(instrumentId);
    const maintenanceEvents = history.filter(e => e.eventType === 'maintenance');
    
    if (maintenanceEvents.length === 0) {
      const purchaseEvent = history.find(e => e.eventType === 'purchase' || e.eventType === 'install');
      if (purchaseEvent) {
        const installDate = new Date(purchaseEvent.eventDate);
        const daysSinceInstall = Math.floor((Date.now() - installDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSinceInstall > 365) return 40;
        if (daysSinceInstall > 180) return 70;
        return 100;
      }
      return 70; // No history at all
    }
    
    const latestMaintenance = maintenanceEvents[0];
    const now = new Date();
    
    if (latestMaintenance.nextDueDate) {
      const dueDate = new Date(latestMaintenance.nextDueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      
      if (daysUntilDue < 0) {
        return Math.max(20, 60 + daysUntilDue * 2);
      } else if (daysUntilDue < this.thresholds.maintenance.criticalDays) {
        return 60;
      } else if (daysUntilDue < this.thresholds.maintenance.warningDays) {
        return 80;
      }
      return 100;
    }
    
    return 85;
  }

  /**
   * Calculate usage pattern score based on traffic data
   */
  private calculateUsagePatternScore(instrumentId: number): number {
    const stats = trafficLogger.getStats(instrumentId, 24);
    
    if (stats.rxCount === 0 && stats.txCount === 0) {
      return 80; // No recent traffic, could be idle or issue
    }
    
    const totalTraffic = stats.rxCount + stats.txCount;
    
    const historicalStats = trafficLogger.getStats(instrumentId, 168); // 7 days
    const historicalTotal = historicalStats.rxCount + historicalStats.txCount;
    const dailyAverage = historicalTotal / 7;
    
    if (dailyAverage === 0) {
      return 85; // New device or no historical data
    }
    
    const usageRatio = totalTraffic / dailyAverage;
    
    if (usageRatio < 0.1) {
      return 60; // Much less than normal usage
    } else if (usageRatio < 0.5) {
      return 75;
    } else if (usageRatio > 3) {
      return 70; // Unusually high usage might indicate issues
    }
    
    return 100;
  }

  /**
   * Determine risk level based on overall score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.thresholds.riskLevels.low) return 'low';
    if (score >= this.thresholds.riskLevels.medium) return 'medium';
    if (score >= this.thresholds.riskLevels.high) return 'high';
    return 'critical';
  }

  /**
   * Generate recommendations based on health factors
   */
  private generateRecommendations(
    instrumentId: number,
    factors: DeviceHealthScore['factors'],
    riskLevel: DeviceHealthScore['riskLevel']
  ): string[] {
    const recommendations: string[] = [];
    
    if (factors.communicationHealth < 70) {
      recommendations.push('Check physical connections and cable integrity');
      recommendations.push('Review communication settings and baud rate configuration');
      if (factors.communicationHealth < 50) {
        recommendations.push('Consider replacing communication cables or interface hardware');
      }
    }
    
    if (factors.calibrationStatus < 70) {
      recommendations.push('Schedule calibration service');
      if (factors.calibrationStatus < 50) {
        recommendations.push('URGENT: Device may be producing inaccurate results. Schedule immediate calibration');
      }
    }
    
    if (factors.maintenanceCompliance < 70) {
      recommendations.push('Review and update maintenance schedule');
      if (factors.maintenanceCompliance < 50) {
        recommendations.push('Perform comprehensive maintenance inspection');
      }
    }
    
    if (factors.usagePattern < 70) {
      recommendations.push('Investigate unusual usage patterns');
      recommendations.push('Verify device is functioning correctly');
    }
    
    if (riskLevel === 'critical') {
      recommendations.unshift('CRITICAL: Immediate attention required - consider taking device offline for inspection');
    } else if (riskLevel === 'high') {
      recommendations.unshift('HIGH RISK: Schedule inspection within the next 48 hours');
    }
    
    const deviceAge = this.getDeviceAge(instrumentId);
    if (deviceAge > 7 * 365) {
      recommendations.push('Device is over 7 years old - consider planning for replacement');
    }
    
    return recommendations;
  }

  /**
   * Predict potential issues based on trends and current state
   */
  private predictIssues(instrumentId: number, factors: DeviceHealthScore['factors']): PredictedIssue[] {
    const issues: PredictedIssue[] = [];
    const trend = this.getHealthTrend(instrumentId);
    
    if (factors.communicationHealth < 80) {
      const probability = this.calculateFailureProbability(factors.communicationHealth, trend);
      issues.push({
        type: 'communication_failure',
        probability,
        estimatedTimeframe: this.estimateTimeframe(probability, trend),
        mitigationAction: 'Inspect and replace communication hardware if necessary'
      });
    }
    
    const history = deviceLifecycleManager.getHistory(instrumentId);
    const calibrationEvents = history.filter(e => e.eventType === 'calibration');
    if (calibrationEvents.length > 0 && calibrationEvents[0].nextDueDate) {
      const dueDate = new Date(calibrationEvents[0].nextDueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      
      if (daysUntilDue < 60) {
        const probability = Math.min(95, Math.max(30, 100 - daysUntilDue * 1.5));
        issues.push({
          type: 'calibration_drift',
          probability,
          estimatedTimeframe: daysUntilDue <= 0 ? 'Immediate' : `${daysUntilDue} days`,
          mitigationAction: 'Schedule calibration before due date'
        });
      }
    }
    
    if (factors.maintenanceCompliance < 70) {
      const probability = Math.min(90, 100 - factors.maintenanceCompliance);
      issues.push({
        type: 'maintenance_needed',
        probability,
        estimatedTimeframe: probability > 70 ? '7 days' : '30 days',
        mitigationAction: 'Schedule preventive maintenance'
      });
    }
    
    const deviceAge = this.getDeviceAge(instrumentId);
    if (deviceAge > 5 * 365) {
      const yearsOld = deviceAge / 365;
      const probability = Math.min(80, Math.max(20, (yearsOld - 5) * 10));
      issues.push({
        type: 'end_of_life',
        probability,
        estimatedTimeframe: probability > 50 ? '1 year' : '2 years',
        mitigationAction: 'Begin planning for device replacement'
      });
    }
    
    return issues.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Calculate failure probability based on score and trend
   */
  private calculateFailureProbability(score: number, trend: HealthTrend | null): number {
    let baseProbability = 100 - score;
    
    if (trend && trend.trend === 'degrading') {
      baseProbability += Math.abs(trend.changeRate) * 5;
    } else if (trend && trend.trend === 'improving') {
      baseProbability -= Math.abs(trend.changeRate) * 3;
    }
    
    return Math.min(95, Math.max(5, Math.round(baseProbability)));
  }

  /**
   * Estimate timeframe for predicted issue
   */
  private estimateTimeframe(probability: number, trend: HealthTrend | null): string {
    if (probability > 80) return '7 days';
    if (probability > 60) return '14 days';
    if (probability > 40) return '1 month';
    return '3 months';
  }

  /**
   * Get device age in days
   */
  private getDeviceAge(instrumentId: number): number {
    try {
      const db = getDatabase();
      const instrument = db.prepare(`
        SELECT created_at FROM instruments WHERE id = ?
      `).get(instrumentId) as InstrumentInfo | undefined;
      
      if (instrument && instrument.created_at) {
        const createdAt = new Date(instrument.created_at);
        return Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
      }
      
      const history = deviceLifecycleManager.getHistory(instrumentId);
      const purchaseEvent = history.find(e => e.eventType === 'purchase' || e.eventType === 'install');
      if (purchaseEvent) {
        const purchaseDate = new Date(purchaseEvent.eventDate);
        return Math.floor((Date.now() - purchaseDate.getTime()) / (24 * 60 * 60 * 1000));
      }
    } catch {
      // Ignore errors
    }
    
    return 0;
  }

  /**
   * Record health score to history for trend analysis
   */
  private recordHealthHistory(instrumentId: number, score: number): void {
    if (!this.healthHistory.has(instrumentId)) {
      this.healthHistory.set(instrumentId, []);
    }
    
    const history = this.healthHistory.get(instrumentId)!;
    history.push({ timestamp: new Date(), score });
    
    const maxHistorySize = 1000;
    if (history.length > maxHistorySize) {
      history.splice(0, history.length - maxHistorySize);
    }
  }

  /**
   * Get health trend for a device
   */
  getHealthTrend(instrumentId: number): HealthTrend | null {
    const history = this.healthHistory.get(instrumentId);
    
    if (!history || history.length < 2) {
      return null;
    }
    
    const recentHistory = history.slice(-10);
    
    if (recentHistory.length < 2) {
      return {
        instrumentId,
        scores: recentHistory,
        trend: 'stable',
        changeRate: 0
      };
    }
    
    const first = recentHistory[0];
    const last = recentHistory[recentHistory.length - 1];
    const timeDiffDays = (last.timestamp.getTime() - first.timestamp.getTime()) / (24 * 60 * 60 * 1000);
    
    if (timeDiffDays === 0) {
      return {
        instrumentId,
        scores: recentHistory,
        trend: 'stable',
        changeRate: 0
      };
    }
    
    const changeRate = (last.score - first.score) / timeDiffDays;
    
    let trend: 'improving' | 'stable' | 'degrading';
    if (changeRate > 1) {
      trend = 'improving';
    } else if (changeRate < -1) {
      trend = 'degrading';
    } else {
      trend = 'stable';
    }
    
    return {
      instrumentId,
      scores: recentHistory,
      trend,
      changeRate
    };
  }

  /**
   * Check for alerts based on health score changes
   */
  private checkForAlerts(
    instrumentId: number,
    current: DeviceHealthScore,
    previous: DeviceHealthScore | undefined
  ): void {
    const db = getDatabase();
    let instrumentName = `Instrument ${instrumentId}`;
    
    try {
      const instrument = db.prepare(`SELECT name FROM instruments WHERE id = ?`).get(instrumentId) as { name: string } | undefined;
      if (instrument) {
        instrumentName = instrument.name;
      }
    } catch {
      // Use default name
    }
    
    if (current.riskLevel === 'critical') {
      const alert: HealthAlert = {
        instrumentId,
        instrumentName,
        severity: 'critical',
        type: 'health_degradation',
        message: `Device health is critical (score: ${current.overallScore}/100)`,
        healthScore: current.overallScore,
        timestamp: new Date()
      };
      this.emit('health-alert', alert);
      console.error(`[PredictiveMaintenance] CRITICAL: ${instrumentName} health score: ${current.overallScore}`);
    } else if (current.riskLevel === 'high' && (!previous || previous.riskLevel !== 'high')) {
      const alert: HealthAlert = {
        instrumentId,
        instrumentName,
        severity: 'warning',
        type: 'health_degradation',
        message: `Device health is degrading (score: ${current.overallScore}/100)`,
        healthScore: current.overallScore,
        timestamp: new Date()
      };
      this.emit('health-alert', alert);
      console.warn(`[PredictiveMaintenance] WARNING: ${instrumentName} health score: ${current.overallScore}`);
    }
    
    for (const issue of current.predictedIssues) {
      if (issue.probability > 80) {
        const alert: HealthAlert = {
          instrumentId,
          instrumentName,
          severity: issue.probability > 90 ? 'critical' : 'warning',
          type: 'predicted_failure',
          message: `High probability (${issue.probability}%) of ${issue.type.replace(/_/g, ' ')} within ${issue.estimatedTimeframe}`,
          healthScore: current.overallScore,
          timestamp: new Date()
        };
        this.emit('health-alert', alert);
      }
    }
  }

  /**
   * Save health score to database for historical analysis
   */
  private saveHealthScoreToDb(healthScore: DeviceHealthScore): void {
    try {
      const db = getDatabase();
      
      db.prepare(`
        INSERT INTO device_health_scores 
        (instrument_id, overall_score, communication_health, calibration_status,
         maintenance_compliance, usage_pattern, risk_level, recommendations, 
         predicted_issues, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        healthScore.instrumentId,
        healthScore.overallScore,
        healthScore.factors.communicationHealth,
        healthScore.factors.calibrationStatus,
        healthScore.factors.maintenanceCompliance,
        healthScore.factors.usagePattern,
        healthScore.riskLevel,
        JSON.stringify(healthScore.recommendations),
        JSON.stringify(healthScore.predictedIssues),
        healthScore.lastUpdated.toISOString()
      );
    } catch (err) {
      // Table might not exist yet
      console.debug('[PredictiveMaintenance] Failed to save health score to DB:', err);
    }
  }

  /**
   * Get current health score for a device
   */
  getHealthScore(instrumentId: number): DeviceHealthScore | null {
    return this.healthScores.get(instrumentId) || null;
  }

  /**
   * Get all current health scores
   */
  getAllHealthScores(): DeviceHealthScore[] {
    return Array.from(this.healthScores.values());
  }

  /**
   * Get devices by risk level
   */
  getDevicesByRiskLevel(riskLevel: DeviceHealthScore['riskLevel']): DeviceHealthScore[] {
    return Array.from(this.healthScores.values()).filter(s => s.riskLevel === riskLevel);
  }

  /**
   * Get historical health scores from database
   */
  getHealthHistory(instrumentId: number, hours: number = 24): Array<{
    overallScore: number;
    factors: DeviceHealthScore['factors'];
    riskLevel: string;
    recordedAt: string;
  }> {
    try {
      const db = getDatabase();
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      return db.prepare(`
        SELECT overall_score, communication_health, calibration_status,
               maintenance_compliance, usage_pattern, risk_level, recorded_at
        FROM device_health_scores
        WHERE instrument_id = ? AND recorded_at >= ?
        ORDER BY recorded_at DESC
      `).all(instrumentId, since).map((row: any) => ({
        overallScore: row.overall_score,
        factors: {
          communicationHealth: row.communication_health,
          calibrationStatus: row.calibration_status,
          maintenanceCompliance: row.maintenance_compliance,
          usagePattern: row.usage_pattern
        },
        riskLevel: row.risk_level,
        recordedAt: row.recorded_at
      }));
    } catch (err) {
      console.debug('[PredictiveMaintenance] Failed to get health history:', err);
      return [];
    }
  }

  /**
   * Configure thresholds
   */
  setThresholds(thresholds: Partial<typeof this.thresholds>): void {
    if (thresholds.riskLevels) {
      Object.assign(this.thresholds.riskLevels, thresholds.riskLevels);
    }
    if (thresholds.alerts) {
      Object.assign(this.thresholds.alerts, thresholds.alerts);
    }
    if (thresholds.calibration) {
      Object.assign(this.thresholds.calibration, thresholds.calibration);
    }
    if (thresholds.maintenance) {
      Object.assign(this.thresholds.maintenance, thresholds.maintenance);
    }
  }

  /**
   * Configure factor weights
   */
  setWeights(weights: Partial<typeof this.weights>): void {
    Object.assign(this.weights, weights);
    
    const total = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 0.01) {
      console.warn(`[PredictiveMaintenance] Weights do not sum to 1.0 (current: ${total})`);
    }
  }

  /**
   * Reset health data for a device
   */
  reset(instrumentId: number): void {
    this.healthScores.delete(instrumentId);
    this.healthHistory.delete(instrumentId);
    console.log(`[PredictiveMaintenance] Reset health data for instrument ${instrumentId}`);
  }

  /**
   * Reset all health data
   */
  resetAll(): void {
    this.healthScores.clear();
    this.healthHistory.clear();
    console.log('[PredictiveMaintenance] Reset all health data');
  }
}

// Singleton instance
export const predictiveMaintenanceService = new PredictiveMaintenanceService();
