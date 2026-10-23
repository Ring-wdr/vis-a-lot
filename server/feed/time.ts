// 날짜 경계. DB(PGlite)는 timestamptz·date를 Date로 읽고, API는 ISO 문자열('YYYY-MM-DD')로 주고받는다.
// "지금"은 항상 ctx.now를 쓴다 (/feed/dev/clock의 시계 오프셋이 반영된 값). DB 기본값 now()에 기대지 않는다.

/** timestamptz → ISO 문자열 */
export function iso(value: Date | string): string;
export function iso(value: Date | string | null | undefined): string | null;
export function iso(value: Date | string | null | undefined) {
  if (value == null) return null;
  return typeof value === "string"
    ? new Date(value).toISOString()
    : value.toISOString();
}

/** date → 'YYYY-MM-DD'. PGlite는 date를 그 날 UTC 자정의 Date로 읽는다. */
export function day(value: Date | string): string;
export function day(value: Date | string | null | undefined): string | null;
export function day(value: Date | string | null | undefined) {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** now 기준 로컬 날짜 'YYYY-MM-DD' (기한 비교용) */
export function localDay(now: Date, offsetDays = 0) {
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
