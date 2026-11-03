import type { GameDate } from '../types';

// 게임 날짜는 UTC 기준 YYYY-MM-DD 문자열로만 다룬다 (시간대 영향 제거).

export function parseDate(d: GameDate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function formatISO(date: Date): GameDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(d: GameDate, days: number): GameDate {
  const date = parseDate(d);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISO(date);
}

export function diffDays(a: GameDate, b: GameDate): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000);
}

export function weekday(d: GameDate): number {
  return parseDate(d).getUTCDay();
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatKorean(d: GameDate, withWeekday = true): string {
  const date = parseDate(d);
  const s = `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;
  return withWeekday ? `${s} (${WEEKDAYS[date.getUTCDay()]})` : s;
}

export function formatShort(d: GameDate): string {
  const date = parseDate(d);
  return `${date.getUTCMonth() + 1}.${date.getUTCDate()} (${WEEKDAYS[date.getUTCDay()]})`;
}

export function ageOn(birthDate: GameDate, on: GameDate): number {
  const b = parseDate(birthDate);
  const o = parseDate(on);
  let age = o.getUTCFullYear() - b.getUTCFullYear();
  const m = o.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && o.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export const WEEKDAY_LABELS = WEEKDAYS;
