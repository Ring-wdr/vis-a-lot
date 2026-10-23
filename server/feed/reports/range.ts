// 보고 기간·숫자 다듬기. 날짜 경계는 scheduler와 같이 로컬 자정을 쓴다.

import { FeedError } from "../context";

/** 기간 최대 길이 (from·to 포함 날짜 수) */
export const MAX_RANGE_DAYS = 366;

/** 'YYYY-MM-DD' → 그 로컬 날짜의 자정 */
export function localMidnight(value: string, offsetDays = 0) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d + offsetDays);
}

/** [from 자정, to 다음 날 자정). from > to이거나 366일을 넘으면 400 */
export function reportRange(from: string, to: string): [Date, Date] {
  if (from > to) throw new FeedError(400, "시작일이 끝일보다 늦습니다");
  const start = localMidnight(from);
  const end = localMidnight(to, 1);
  // 일광 절약 시간이 있어도 날짜 수가 맞게 반올림한다
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days > MAX_RANGE_DAYS)
    throw new FeedError(400, `기간은 ${MAX_RANGE_DAYS}일을 넘을 수 없습니다`);
  return [start, end];
}

/** 소수 한 자리 */
export const round1 = (n: number) => Math.round(n * 10) / 10;

export const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
