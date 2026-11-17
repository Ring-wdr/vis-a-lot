// legend 값과 범주 x축의 순서. 직접 정한 목록(order)을 앞에 두고, 나머지는 sort 순으로 뒤에 둔다.
// 렌더러(Worker)와 job-manager가 함께 쓰므로 import 없는 순수 함수로 둔다.

/** 나머지 값의 순서. default는 받은 순서(컬럼 값 순), natural은 글자 안 숫자를 수로 비교한다. */
type Sort = "default" | "natural";

const DIGIT = /\d/;

/** 글자를 숫자 덩어리와 나머지 덩어리로 나눈다. "L10a" → ["L", "10", "a"] */
function chunksOf(s: string) {
  return s.match(/\d+|\D+/g) ?? [];
}

/** 숫자 덩어리 비교. 앞의 0을 떼고 자릿수, 그다음 글자 순으로 견줘 큰 수도 정확하다. */
function compareDigits(a: string, b: string) {
  const x = a.replace(/^0+(?=\d)/, "");
  const y = b.replace(/^0+(?=\d)/, "");
  if (x.length !== y.length) return x.length - y.length;
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * 자연 정렬 비교. 글자 안 숫자는 수로("A2" < "A10"), 나머지 글자는 코드 순으로 견준다.
 * 수가 같고 표기만 다르면("01"과 "1") 원래 글자 순이다.
 */
export function naturalCompare(a: string, b: string): number {
  const xs = chunksOf(a);
  const ys = chunksOf(b);
  const n = Math.min(xs.length, ys.length);
  for (let k = 0; k < n; k++) {
    const x = xs[k];
    const y = ys[k];
    if (x === y) continue;
    const dx = DIGIT.test(x[0]);
    const dy = DIGIT.test(y[0]);
    const c = dx && dy ? compareDigits(x, y) : x < y ? -1 : 1;
    if (c !== 0) return c;
  }
  if (xs.length !== ys.length) return xs.length - ys.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * values를 놓을 순서(values의 인덱스). order에 적은 값을 적은 순서대로 앞에 두고(values에 없는 값은 건너뛴다),
 * 나머지는 sort 순으로 뒤에 둔다. default는 values의 순서 그대로다.
 */
export function orderIndexes(
  values: readonly string[],
  order: readonly string[],
  sort: Sort,
): number[] {
  const at = new Map<string, number>();
  values.forEach((v, i) => {
    if (!at.has(v)) at.set(v, i);
  });
  const placed = new Set<number>();
  const head: number[] = [];
  for (const v of order) {
    const i = at.get(v);
    if (i === undefined || placed.has(i)) continue;
    placed.add(i);
    head.push(i);
  }
  const rest: number[] = [];
  for (let i = 0; i < values.length; i++) if (!placed.has(i)) rest.push(i);
  // Array.prototype.sort는 안정 정렬이라 같은 값은 원래 순서를 지킨다.
  if (sort === "natural")
    rest.sort((i, j) => naturalCompare(values[i], values[j]));
  return [...head, ...rest];
}

/** orderIndexes 순서로 늘어놓은 값 */
export function orderValues(
  values: readonly string[],
  order: readonly string[],
  sort: Sort,
): string[] {
  return orderIndexes(values, order, sort).map((i) => values[i]);
}

/** 순서가 그대로인지 (0, 1, 2 …) */
export function isIdentityOrder(indexes: readonly number[]) {
  return indexes.every((v, i) => v === i);
}
