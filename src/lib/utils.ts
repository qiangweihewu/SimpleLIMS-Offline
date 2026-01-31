import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get patient name from object with i18n language support
 */
export function getPatientNameFromObject(patient: any, language?: string): string {
  if (!patient) return 'Unknown'

  const firstName = patient.first_name || patient.firstName || ''
  const lastName = patient.last_name || patient.lastName || ''

  // Reverse order for Chinese language
  if (language === 'zh') {
    return `${lastName}${firstName}`.trim() || 'Unknown'
  }

  return `${firstName} ${lastName}`.trim() || 'Unknown'
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dob: string | Date): number {
  const birth = typeof dob === 'string' ? new Date(dob) : dob
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

/**
 * Format date to locale string
 */
export function formatDate(date: string | Date, locale = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(locale)
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get flag color for result display
 */
export function getFlagColor(flag: string | undefined): string {
  switch (flag) {
    case 'N':
      return 'bg-green-100 text-green-800'
    case 'H':
      return 'bg-orange-100 text-orange-800'
    case 'L':
      return 'bg-orange-100 text-orange-800'
    case 'HH':
      return 'bg-red-100 text-red-800'
    case 'LL':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get applicable reference range
 */
export function getApplicableRefRange(gender: string, dob: string | Date, test: any): { low?: number, high?: number } {
  // Logic to select based on gender/age (omitted for now, just returning test defaults)
  // You can extend this to use gender/age if test has age-specific ranges
  return {
    low: test?.ref_range_low,
    high: test?.ref_range_high
  }
}

/**
 * Get result flag based on value and reference range
 */
export function getResultFlag(value: number | null, refLow?: number, refHigh?: number): string | undefined {
  if (value === null || value === undefined) return undefined
  if (refLow === undefined || refHigh === undefined) return 'N'

  if (value < refLow) return 'L'
  if (value > refHigh) return 'H'
  return 'N'
}

/**
 * Check if value is numeric
 */
export function isNumeric(value: any): boolean {
  return !isNaN(parseFloat(value)) && isFinite(value)
}

/**
 * Get display name (patient name, sample ID, etc.)
 */
export function getDisplayName(nameOrItem: any, nameEn?: string, language?: string): string {
  if (typeof nameOrItem === 'object' && nameOrItem !== null) {
    return nameOrItem?.name || nameOrItem?.sample_id || nameOrItem?.patientName || 'Unknown'
  }
  // Treat as name, nameEn, language
  if (language === 'en' && nameEn) return nameEn
  return nameOrItem || 'Unknown'
}

/**
 * Perform delta check - compare against previous result
 */
interface DeltaCheckResult {
  hasDeltaAlert: boolean;
  previousValue?: number;
  previousDate?: string;
  changePercent?: number;
}

export function performDeltaCheck(currentValue: number, history: { numeric_value: number, created_at: string }[], thresholdPercent = 30): DeltaCheckResult {
  if (!history || history.length === 0) return { hasDeltaAlert: false };

  // Sort history by date desc
  const sorted = [...history].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latestPrevious = sorted[0];

  const previousValue = latestPrevious.numeric_value;
  const change = Math.abs(currentValue - previousValue);
  const changePercent = (change / Math.abs(previousValue)) * 100;

  return {
    hasDeltaAlert: changePercent > thresholdPercent,
    previousValue,
    previousDate: latestPrevious.created_at,
    changePercent
  };
}
