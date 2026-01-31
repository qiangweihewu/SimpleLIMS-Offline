/**
 * TAT (Turnaround Time) Calculation & Analysis
 * Tracks sample processing time from collection to completion
 */

export type Priority = 'routine' | 'urgent' | 'stat';

export interface TATThresholds {
  stat: number;    // minutes
  urgent: number;  // minutes
  routine: number; // minutes
}

export interface TATMetrics {
  totalMinutes: number;
  status: 'completed' | 'in_progress' | 'at_risk' | 'violated';
  thresholdMinutes: number;
  percentOfThreshold: number; // 0-100%
  minutesRemaining?: number;  // negative means violated
  message: string;
}

export interface TATBreakdown {
  totalMinutes: number;
  registrationToProcessing: number;  // Time to start processing
  processingTime: number;             // Time to get results
  verificationTime: number;           // Time to verify/release
}

// Default TAT thresholds (CLIA/CAP standards)
export const DEFAULT_TAT_THRESHOLDS: TATThresholds = {
  stat: 30,     // Critical samples: 30 minutes
  urgent: 240,  // Urgent: 4 hours
  routine: 1440 // Routine: 24 hours
};

/**
 * Get TAT threshold for priority level
 */
export function getTATThreshold(priority: Priority): number {
  return DEFAULT_TAT_THRESHOLDS[priority] || DEFAULT_TAT_THRESHOLDS.routine;
}

/**
 * Calculate elapsed minutes from timestamp
 */
function minutesElapsed(timestamp: string | null): number {
  if (!timestamp) return 0;
  const now = new Date();
  const past = new Date(timestamp);
  return Math.floor((now.getTime() - past.getTime()) / 1000 / 60);
}

/**
 * Analyze TAT for a sample
 * @param collectedAt Sample collection timestamp
 * @param priority Sample priority
 * @param completedAt Optional completion timestamp (if null, in-progress)
 * @returns TAT metrics with status
 */
export function analyzeTAT(
  collectedAt: string,
  priority: Priority,
  completedAt?: string | null
): TATMetrics {
  const thresholdMinutes = getTATThreshold(priority);
  const totalMinutes = minutesElapsed(collectedAt);

  let status: TATMetrics['status'];
  let percentOfThreshold: number;
  let minutesRemaining: number | undefined;
  let message: string;

  if (completedAt) {
    // Sample is completed
    const completionMinutes = minutesElapsed(collectedAt);
    status = 'completed';
    percentOfThreshold = (completionMinutes / thresholdMinutes) * 100;
    
    if (completionMinutes <= thresholdMinutes) {
      message = `✓ Completed in ${formatTATTime(completionMinutes)} (${percentOfThreshold.toFixed(0)}% of ${priority} limit)`;
    } else {
      message = `⚠ Completed in ${formatTATTime(completionMinutes)} - EXCEEDED ${formatTATTime(thresholdMinutes)} limit`;
    }
  } else {
    // Sample still in progress
    percentOfThreshold = (totalMinutes / thresholdMinutes) * 100;
    minutesRemaining = thresholdMinutes - totalMinutes;

    if (totalMinutes > thresholdMinutes) {
      status = 'violated';
      message = `🔴 VIOLATED: Exceeded ${formatTATTime(thresholdMinutes)} limit by ${formatTATTime(Math.abs(minutesRemaining))}`;
    } else if (percentOfThreshold >= 80) {
      status = 'at_risk';
      message = `🟡 AT RISK: ${formatTATTime(minutesRemaining)} remaining (${percentOfThreshold.toFixed(0)}% of limit)`;
    } else {
      status = 'in_progress';
      message = `In progress: ${formatTATTime(minutesRemaining)} remaining`;
    }
  }

  return {
    totalMinutes,
    status,
    thresholdMinutes,
    percentOfThreshold: Math.min(percentOfThreshold, 100),
    minutesRemaining,
    message
  };
}

/**
 * Calculate TAT breakdown for a sample
 */
export function calculateTATBreakdown(
  collectedAt: string | null,
  processingStartedAt: string | null,
  resultEnteredAt: string | null,
  verifiedAt: string | null
): TATBreakdown {
  const now = new Date();

  const getMinutes = (timestamp: string | null) => {
    if (!timestamp) return 0;
    return Math.floor((new Date(timestamp).getTime() - new Date(collectedAt || now).getTime()) / 1000 / 60);
  };

  const processingTime = getMinutes(processingStartedAt);
  const resultTime = getMinutes(resultEnteredAt);
  const verificationTime = getMinutes(verifiedAt);

  return {
    totalMinutes: verificationTime,
    registrationToProcessing: processingTime,
    processingTime: resultTime - processingTime,
    verificationTime: verificationTime - resultTime
  };
}

/**
 * Format minutes into readable time format
 * Examples: "5m", "2h 30m", "1h", "45m"
 */
export function formatTATTime(minutes: number): string {
  if (minutes < 1) return '< 1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${Math.round(mins)}m`;
}

/**
 * Get TAT status color for UI display
 */
export function getTATStatusColor(status: TATMetrics['status']): string {
  switch (status) {
    case 'completed':
      return 'text-green-600';
    case 'in_progress':
      return 'text-blue-600';
    case 'at_risk':
      return 'text-yellow-600';
    case 'violated':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Get TAT badge variant
 */
export function getTATBadgeVariant(status: TATMetrics['status']): 'default' | 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'default';
    case 'at_risk':
      return 'warning';
    case 'violated':
      return 'destructive';
    default:
      return 'default';
  }
}

/**
 * Get TAT progress bar color
 */
export function getTATProgressColor(percentOfThreshold: number): string {
  if (percentOfThreshold <= 50) return 'bg-green-500';
  if (percentOfThreshold <= 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

/**
 * Identify bottlenecks in sample processing
 */
export interface Bottleneck {
  stage: 'registration' | 'processing' | 'verification';
  minutes: number;
  percentOfTotal: number;
  isBottleneck: boolean;
}

export function identifyBottlenecks(breakdown: TATBreakdown): Bottleneck[] {
  const stages = [
    { stage: 'registration' as const, minutes: breakdown.registrationToProcessing },
    { stage: 'processing' as const, minutes: breakdown.processingTime },
    { stage: 'verification' as const, minutes: breakdown.verificationTime }
  ];

  const maxMinutes = Math.max(...stages.map(s => s.minutes));
  const threshold = maxMinutes * 0.5; // Stage taking 50%+ of max is a bottleneck

  return stages.map(s => ({
    ...s,
    percentOfTotal: breakdown.totalMinutes > 0 ? (s.minutes / breakdown.totalMinutes) * 100 : 0,
    isBottleneck: s.minutes >= threshold
  }));
}

/**
 * Calculate average TAT across multiple samples
 */
export function calculateAverageTAT(
  samples: Array<{
    collected_at: string;
    priority: Priority;
    is_released: number;
    released_at?: string;
  }>
): Record<Priority, { avgMinutes: number; count: number; violated: number }> {
  const result: Record<Priority, { avgMinutes: number; count: number; violated: number }> = {
    stat: { avgMinutes: 0, count: 0, violated: 0 },
    urgent: { avgMinutes: 0, count: 0, violated: 0 },
    routine: { avgMinutes: 0, count: 0, violated: 0 }
  };

  for (const sample of samples) {
    const metrics = analyzeTAT(sample.collected_at, sample.priority, sample.released_at);
    result[sample.priority].count++;
    result[sample.priority].avgMinutes += metrics.totalMinutes;
    if (metrics.status === 'violated') {
      result[sample.priority].violated++;
    }
  }

  // Calculate averages
  for (const priority of ['stat', 'urgent', 'routine'] as const) {
    if (result[priority].count > 0) {
      result[priority].avgMinutes = result[priority].avgMinutes / result[priority].count;
    }
  }

  return result;
}

/**
 * Generate TAT summary report
 */
export interface TATSummary {
  totalSamples: number;
  completedSamples: number;
  violatedSamples: number;
  atRiskSamples: number;
  inProgressSamples: number;
  violationRate: number; // percentage
  avgTATMinutes: number;
  byPriority: Record<Priority, { count: number; violated: number; avgMinutes: number }>;
}

export function generateTATSummary(samples: Array<{
  collected_at: string;
  priority: Priority;
  is_released: number;
  released_at?: string;
}>): TATSummary {
  const completed = samples.filter(s => s.is_released === 1);
  const inProgress = samples.filter(s => s.is_released === 0);

  const completedMetrics = completed.map(s => analyzeTAT(s.collected_at, s.priority, s.released_at));
  const inProgressMetrics = inProgress.map(s => analyzeTAT(s.collected_at, s.priority));

  const allMetrics = [...completedMetrics, ...inProgressMetrics];
  const violated = allMetrics.filter(m => m.status === 'violated').length;
  const atRisk = inProgressMetrics.filter(m => m.status === 'at_risk').length;

  const totalMinutes = allMetrics.reduce((sum, m) => sum + m.totalMinutes, 0);
  const avgTATMinutes = allMetrics.length > 0 ? totalMinutes / allMetrics.length : 0;

  return {
    totalSamples: samples.length,
    completedSamples: completed.length,
    violatedSamples: violated,
    atRiskSamples: atRisk,
    inProgressSamples: inProgress.length,
    violationRate: samples.length > 0 ? (violated / samples.length) * 100 : 0,
    avgTATMinutes,
    byPriority: calculateAverageTAT(samples)
  };
}
