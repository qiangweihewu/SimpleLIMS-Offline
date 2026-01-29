import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, format: string = 'YYYY-MM-DD'): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

export function calculateAge(dateOfBirth: string | Date): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function generateId(prefix: string = ''): string {
  const date = formatDate(new Date(), 'YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return prefix ? `${prefix}-${date}-${random}` : `${date}-${random}`;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function isNumeric(value: string): boolean {
  return !isNaN(parseFloat(value)) && isFinite(Number(value));
}

export function formatNumber(value: number, decimalPlaces: number = 2): string {
  return value.toFixed(decimalPlaces);
}

export function getResultFlag(
  value: number,
  refLow?: number | null,
  refHigh?: number | null,
  panicLow?: number | null,
  panicHigh?: number | null
): 'N' | 'L' | 'H' | 'LL' | 'HH' {
  if (panicLow !== null && panicLow !== undefined && value < panicLow) return 'LL';
  if (panicHigh !== null && panicHigh !== undefined && value > panicHigh) return 'HH';
  if (refLow !== null && refLow !== undefined && value < refLow) return 'L';
  if (refHigh !== null && refHigh !== undefined && value > refHigh) return 'H';
  return 'N';
}

export function getFlagColor(flag: string | null | undefined): string {
  switch (flag) {
    case 'H':
      return 'text-orange-600';
    case 'L':
      return 'text-blue-600';
    case 'HH':
    case 'LL':
    case 'C':
      return 'text-red-600 font-bold';
    default:
      return '';
  }
}

export function getFlagBadgeVariant(flag: string | null | undefined): 'default' | 'warning' | 'destructive' | 'secondary' {
  switch (flag) {
    case 'H':
    case 'L':
      return 'warning';
    case 'HH':
    case 'LL':
    case 'C':
      return 'destructive';
    default:
      return 'secondary';
  }
}
