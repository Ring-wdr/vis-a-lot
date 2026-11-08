// 업로드에서 고른 날짜 시간 형식(yyyy-MM-dd HH:mm:ss.SSS 같은 패턴)으로 값을 읽어 Postgres가 받는
// ISO 문자열로 바꾼다. 행마다 부르므로 패턴은 한 번만 정규식으로 바꿔 두고 쓴다.

type Field =
  | "year"
  | "year2"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "ms";

/** 긴 토큰부터 맞춘다 (yyyy를 yy보다 먼저). */
const TOKENS: [token: string, pattern: string, field: Field][] = [
  ["yyyy", "(\\d{4})", "year"],
  ["yy", "(\\d{2})", "year2"],
  ["MM", "(\\d{2})", "month"],
  ["M", "(\\d{1,2})", "month"],
  ["dd", "(\\d{2})", "day"],
  ["d", "(\\d{1,2})", "day"],
  ["HH", "(\\d{2})", "hour"],
  ["H", "(\\d{1,2})", "hour"],
  ["mm", "(\\d{2})", "minute"],
  ["m", "(\\d{1,2})", "minute"],
  ["ss", "(\\d{2})", "second"],
  ["s", "(\\d{1,2})", "second"],
  ["SSS", "(\\d{1,3})", "ms"],
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** 패턴에 날짜 토큰이 하나도 없으면 형식으로 볼 수 없다. */
export class DatetimeFormatError extends Error {}

/**
 * 패턴을 값 → ISO 문자열(없는 칸은 0) 변환 함수로 바꾼다. 형식에 맞지 않거나
 * 없는 날짜(2월 31일 등)면 null을 돌려준다.
 */
export function compileDatetimeFormat(format: string) {
  const fields: Field[] = [];
  let source = "";
  let i = 0;
  while (i < format.length) {
    const match = TOKENS.find(([token]) => format.startsWith(token, i));
    if (match) {
      source += match[1];
      fields.push(match[2]);
      i += match[0].length;
    } else {
      source += escapeRegExp(format[i]);
      i++;
    }
  }
  if (!fields.includes("year") && !fields.includes("year2")) {
    throw new DatetimeFormatError(
      `날짜 시간 형식 '${format}'에 연도(yyyy 또는 yy)가 없습니다.`,
    );
  }
  const re = new RegExp(`^${source}$`);

  return (value: string): string | null => {
    const m = re.exec(value.trim());
    if (!m) return null;
    const v = {
      year: 0,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      ms: 0,
    };
    fields.forEach((field, k) => {
      const n = Number(m[k + 1]);
      if (field === "year2") v.year = 2000 + n;
      // 1~3자리 밀리초는 소수점 아래 자리로 읽는다 (5 → 500ms).
      else if (field === "ms") v.ms = Number(m[k + 1].padEnd(3, "0"));
      else v[field] = n;
    });
    if (
      v.month < 1 ||
      v.month > 12 ||
      v.hour > 23 ||
      v.minute > 59 ||
      v.second > 59
    )
      return null;
    // 달력에 없는 날은 Date가 다음 달로 넘기므로 되돌아온 날짜로 확인한다.
    const date = new Date(Date.UTC(v.year, v.month - 1, v.day));
    if (date.getUTCMonth() !== v.month - 1 || date.getUTCDate() !== v.day)
      return null;
    return `${pad(v.year, 4)}-${pad(v.month)}-${pad(v.day)} ${pad(v.hour)}:${pad(v.minute)}:${pad(v.second)}.${pad(v.ms, 3)}`;
  };
}
