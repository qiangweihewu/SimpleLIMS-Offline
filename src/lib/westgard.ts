/**
 * Westgard Multi-Rule Quality Control (QC) Algorithm
 * Used to determine if a QC run is in or out of control
 * Reference: Westgard QC Rules for analytical quality assurance
 */

export interface QCResult {
  value: number;
  timestamp: string;
}

export interface WestgardAnalysis {
  mean: number;
  sd: number;
  cv: number; // Coefficient of Variation %
  status: 'pass' | '1_2s' | '1_3s' | '2_2s' | 'r_4s' | '4_1s' | '10x' | 'unknown';
  failedRules: string[];
  message: string;
  isAccepted: boolean;
}

/**
 * Calculate basic statistics for QC values
 */
export function calculateStats(
  values: number[],
  targetValue?: number
): { mean: number; sd: number; cv: number } {
  if (values.length === 0) {
    return { mean: 0, sd: 0, cv: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  
  const variance = values.length > 1
    ? values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1)
    : 0;
  
  const sd = Math.sqrt(variance);
  
  const baseValue = targetValue || mean;
  const cv = baseValue !== 0 ? Math.abs((sd / baseValue) * 100) : 0;

  return { mean, sd, cv };
}

/**
 * Perform Westgard multi-rule QC analysis
 * 
 * @param currentValue The current QC measurement
 * @param previousValues Array of previous QC values (sorted by newest first)
 * @param targetValue Expected value for QC material
 * @param materialSD Standard deviation of QC material
 * @returns Analysis result with status and failed rules
 */
export function analyzeWestgardRules(
  currentValue: number,
  previousValues: QCResult[],
  targetValue: number,
  materialSD: number
): WestgardAnalysis {
  const failedRules: string[] = [];
  
  // Get numeric values sorted from oldest to newest
  const allValues = [currentValue, ...previousValues.map(v => v.value)].reverse();
  
  // Rule 1-2s: One QC result exceeds 2SD from mean (always fails on current value)
  // This is the default acceptance rule - most permissive
  if (Math.abs(currentValue - targetValue) > 2 * materialSD) {
    failedRules.push('1_2s');
  }

  // Rule 1-3s: One QC result exceeds 3SD from mean (critical error, always reject)
  if (Math.abs(currentValue - targetValue) > 3 * materialSD) {
    failedRules.push('1_3s');
    return {
      mean: targetValue,
      sd: materialSD,
      cv: (materialSD / targetValue) * 100,
      status: '1_3s',
      failedRules: ['1_3s'],
      message: 'QC failed: Value exceeds ±3σ limit (critical error)',
      isAccepted: false
    };
  }

  // Rule 2-2s: Two consecutive results exceed 2SD on same side
  if (allValues.length >= 2) {
    const current = allValues[allValues.length - 1];
    const previous = allValues[allValues.length - 2];
    
    const currentDeviation = current - targetValue;
    const previousDeviation = previous - targetValue;
    
    // Both exceed 2SD and on same side
    if (
      Math.abs(currentDeviation) > 2 * materialSD &&
      Math.abs(previousDeviation) > 2 * materialSD &&
      Math.sign(currentDeviation) === Math.sign(previousDeviation)
    ) {
      failedRules.push('2_2s');
    }
  }

  // Rule R-4s: Range of two consecutive results exceeds 4SD
  if (allValues.length >= 2) {
    const range = Math.abs(allValues[allValues.length - 1] - allValues[allValues.length - 2]);
    if (range > 4 * materialSD) {
      failedRules.push('r_4s');
    }
  }

  // Rule 4-1s: Four consecutive results exceed 1SD on same side
  if (allValues.length >= 4) {
    const last4 = allValues.slice(-4);
    const last4Deviations = last4.map(v => v - targetValue);
    
    // Check if all exceed 1SD on same side
    const allPositive = last4Deviations.every(d => d > materialSD);
    const allNegative = last4Deviations.every(d => d < -materialSD);
    
    if (allPositive || allNegative) {
      failedRules.push('4_1s');
    }
  }

  // Rule 10x: Ten consecutive results on same side of target (trend)
  if (allValues.length >= 10) {
    const last10 = allValues.slice(-10);
    const last10Deviations = last10.map(v => v - targetValue);
    
    const allAbove = last10Deviations.every(d => d > 0);
    const allBelow = last10Deviations.every(d => d < 0);
    
    if (allAbove || allBelow) {
      failedRules.push('10x');
    }
  }

  // Determine overall status
  let status: WestgardAnalysis['status'] = 'pass';
  if (failedRules.includes('1_3s')) status = '1_3s';
  else if (failedRules.includes('1_2s')) status = '1_2s';
  else if (failedRules.includes('2_2s')) status = '2_2s';
  else if (failedRules.includes('r_4s')) status = 'r_4s';
  else if (failedRules.includes('4_1s')) status = '4_1s';
  else if (failedRules.includes('10x')) status = '10x';

  // Generate message
  let message = 'QC passed all rules';
  if (failedRules.length > 0) {
    message = `QC warning: Failed rule(s) - ${failedRules.join(', ')}`;
  }

  // Critical failures that require rejection
  const isAccepted = !['1_3s', '1_2s', '2_2s'].includes(status);

  return {
    mean: targetValue,
    sd: materialSD,
    cv: (materialSD / targetValue) * 100,
    status,
    failedRules,
    message,
    isAccepted
  };
}

/**
 * Format percentage for display
 */
export function formatCV(cv: number): string {
  return `${cv.toFixed(2)}%`;
}

/**
 * Get visual color for QC status
 */
export function getQCStatusColor(status: WestgardAnalysis['status']): string {
  switch (status) {
    case 'pass':
      return 'text-green-600';
    case '1_2s':
      return 'text-yellow-600';
    case 'r_4s':
    case '4_1s':
    case '10x':
      return 'text-orange-600';
    case '1_3s':
    case '2_2s':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Get badge variant for QC status
 */
export function getQCStatusVariant(
  status: WestgardAnalysis['status']
): 'default' | 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'pass':
      return 'success';
    case '1_2s':
    case 'r_4s':
    case '4_1s':
    case '10x':
      return 'warning';
    case '1_3s':
    case '2_2s':
      return 'destructive';
    default:
      return 'default';
  }
}

/**
 * Get friendly label for Westgard rule
 */
export function getRuleLabel(rule: string): string {
  const labels: Record<string, string> = {
    '1_2s': '1-2σ (One value outside 2σ)',
    '1_3s': '1-3σ (One value outside 3σ)',
    '2_2s': '2-2σ (Two consecutive beyond 2σ)',
    'r_4s': 'R-4σ (Range > 4σ)',
    '4_1s': '4-1σ (Four consecutive beyond 1σ)',
    '10x': '10× (Ten in a row on one side)'
  };
  return labels[rule] || rule;
}
