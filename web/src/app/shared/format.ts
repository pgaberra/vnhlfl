import { Pipe, PipeTransform } from '@angular/core';
import { StandingRecord } from '../data/models';

const points = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const whole = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat('sv-SE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Fantasy points: `5 234,2`. */
export function formatPoints(value: number | null | undefined): string {
  return value === null || value === undefined ? '–' : points.format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return '–';
  return (decimals ? oneDecimal : whole).format(value);
}

/** Win percentage the way Yahoo prints it: `.524`, `1.000`. */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  const text = value.toFixed(3);
  return text.startsWith('0') ? text.slice(1) : text;
}

export function formatRecord(r: Pick<StandingRecord, 'wins' | 'losses' | 'ties'>): string {
  return `${r.wins}-${r.losses}-${r.ties}`;
}

/** Swedish ordinal: 1:a, 2:a, 3:e, 11:e, 21:a. */
export function ordinal(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  return `${n}:${(last === 1 || last === 2) && lastTwo !== 11 && lastTwo !== 12 ? 'a' : 'e'}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  return shortDate.format(new Date(`${iso}T12:00:00`));
}

@Pipe({ name: 'points' })
export class PointsPipe implements PipeTransform {
  transform = formatPoints;
}

@Pipe({ name: 'num' })
export class NumberPipe implements PipeTransform {
  transform = formatNumber;
}

@Pipe({ name: 'pct' })
export class PctPipe implements PipeTransform {
  transform = formatPct;
}

@Pipe({ name: 'record' })
export class RecordPipe implements PipeTransform {
  transform = formatRecord;
}

@Pipe({ name: 'ordinal' })
export class OrdinalPipe implements PipeTransform {
  transform = ordinal;
}

@Pipe({ name: 'day' })
export class DayPipe implements PipeTransform {
  transform = formatDate;
}
