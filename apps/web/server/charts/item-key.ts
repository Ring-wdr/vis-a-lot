// split 조합 → 안정적인 item 키. 데이터를 다시 생성해 순서가 바뀌어도 같은 조합이면 같은 키다.
// 개별 속성과 도형이 이 키에 붙는다.

export const NO_SPLIT_KEY = "all";

export function itemKeyOf(values: readonly string[]) {
  if (values.length === 0) return NO_SPLIT_KEY;
  // FNV-1a 64bit를 두 개의 32bit로 나눠 계산한다.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const text = JSON.stringify(values);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return `k${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

export function itemLabelOf(values: readonly string[], separator: string) {
  return values.length === 0 ? "전체" : values.join(separator);
}
