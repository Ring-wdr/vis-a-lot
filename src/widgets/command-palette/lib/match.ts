// 팔레트 항목 맞추기: 띄어쓰기로 나눈 낱말이 모두 들어 있으면 맞는다. 한글은 초성(ㅂㄷ → 보드)으로도 맞춘다.
// 점수가 작을수록 앞이다. 맞지 않으면 null.

const CHOSEONG = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const JUNG_JONG = 21 * 28;

/** 글자마다 초성으로 바꾼다. 한글 음절이 아니면 그대로 */
export function toChoseong(text: string) {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    out +=
      code >= HANGUL_START && code <= HANGUL_END
        ? CHOSEONG[Math.floor((code - HANGUL_START) / JUNG_JONG)]
        : ch;
  }
  return out;
}

const isChoseongOnly = (text: string) => /^[ㄱ-ㅎ]+$/.test(text);

const normalize = (text: string) =>
  text.toLowerCase().replace(/\s+/g, " ").trim();

/** 낱말 하나의 점수: 앞에서 맞으면 0, 낱말 처음에서 맞으면 1, 가운데면 2, 초성이면 3 */
function termScore(
  haystack: string,
  compact: string,
  cho: string,
  term: string,
) {
  const at = haystack.indexOf(term);
  if (at === 0) return 0;
  if (at > 0) return haystack[at - 1] === " " ? 1 : 2;
  // 띄어쓰기 없이 적은 것 ("활동보고" → "활동 보고")
  if (compact.includes(term)) return 2;
  if (isChoseongOnly(term) && cho.includes(term)) return 3;
  return null;
}

/** label과 keywords에서 q를 찾는다. 빈 q는 모두 맞는다(0) */
export function matchScore(
  q: string,
  label: string,
  keywords: readonly string[] = [],
): number | null {
  const terms = normalize(q).split(" ").filter(Boolean);
  if (terms.length === 0) return 0;
  const fields = [label, ...keywords].map((f) => {
    const n = normalize(f);
    return {
      n,
      compact: n.replace(/ /g, ""),
      cho: toChoseong(n.replace(/ /g, "")),
    };
  });
  let total = 0;
  for (const term of terms) {
    let best: number | null = null;
    fields.forEach((f, i) => {
      const s = termScore(f.n, f.compact, f.cho, term);
      // 키워드에서 맞은 것은 이름에서 맞은 것보다 뒤
      if (s !== null) {
        const score = s + (i === 0 ? 0 : 0.5);
        if (best === null || score < best) best = score;
      }
    });
    if (best === null) return null;
    total += best;
  }
  return total;
}
