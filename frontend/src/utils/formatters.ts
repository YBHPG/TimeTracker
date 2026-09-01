import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Task, TimeInterval } from '../types';

/**
 * Safely parses an ISO date string into a JavaScript Date object in local time.
 * If the string lacks a timezone suffix (Z or offset), it is treated as UTC.
 */
export function parseDateSafe(isoString: string): Date {
  if (!isoString) return new Date();
  if (typeof isoString !== 'string') return new Date(isoString);
  
  let str = isoString.trim();
  // If naive ISO without timezone (e.g. "2026-09-01T23:04:51.123456"), treat as UTC
  if (str.includes('T') && !str.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(str)) {
    str = str + 'Z';
  }
  
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function formatTimeHM(isoString: string): string {
  try {
    const date = parseDateSafe(isoString);
    return format(date, 'HH:mm');
  } catch {
    return '--:--';
  }
}

export function formatTimeHMS(isoString: string): string {
  try {
    const date = parseDateSafe(isoString);
    return format(date, 'HH:mm:ss');
  } catch {
    return '--:--:--';
  }
}

export function calculateIntervalDurationSeconds(interval: TimeInterval): number {
  try {
    const start = parseDateSafe(interval.start_time).getTime();
    const end = interval.end_time ? parseDateSafe(interval.end_time).getTime() : Date.now();
    const diff = Math.max(0, Math.floor((end - start) / 1000));
    return diff;
  } catch {
    return 0;
  }
}

export function calculateTaskDurationSeconds(task: Task): number {
  if (!task.intervals || task.intervals.length === 0) return 0;
  return task.intervals.reduce((acc, inv) => acc + calculateIntervalDurationSeconds(inv), 0);
}

export function formatDurationHuman(seconds: number): string {
  if (seconds <= 0) return '0 мин';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ч`);
  if (m > 0 || h > 0) parts.push(`${m} мин`);
  if (s > 0 && h === 0 && m === 0) parts.push(`${s} сек`);

  return parts.join(' ');
}

export function formatDurationDigital(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

export function getDayOfWeekName(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const name = format(date, 'EEEE');
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return '';
  }
}

export function getFormattedDayMonth(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return format(date, 'd MMMM');
  } catch {
    return dateStr;
  }
}

export function formatDatePretty(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (isToday(date)) {
      return `Сегодня, ${format(date, 'd MMMM', { locale: ru })}`;
    }
    if (isYesterday(date)) {
      return `Вчера, ${format(date, 'd MMMM', { locale: ru })}`;
    }
    return format(date, 'd MMMM yyyy, EEEE', { locale: ru });
  } catch {
    return dateStr;
  }
}

export function getTodayDateStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
