// 순서 필드(legend 순서·범주 순서)의 목록 계산. 서버 server/render/order.ts와 같은 규칙이다
// (화면은 서버 코드를 import하지 않는다).

import type { OrderSort } from "@/entities/chart/model/chart-options";

/** 앞의 0을 떼고 자릿수, 그다음 글자 순으로 숫자 덩어리를 견준다. */
function compareDigits(a: string, b: string) {
  const x = a.replace(/^0+(?=\d)/, "");
  const y = b.replace(/^0+(?=\d)/, "");
  if (x.length !== y.length) return x.length - y.length;
  return x < y ? -1 : x > y ? 1 : 0;
}

/** 자연 정렬 비교. 글자 안 숫자는 수로("A2" < "A10"), 나머지 글자는 코드 순으로 견준다. */
export function naturalCompare(a: string, b: string): number {
  const xs = a.match(/\d+|\D+/g) ?? [];
  const ys = b.match(/\d+|\D+/g) ?? [];
  const n = Math.min(xs.length, ys.length);
  for (let k = 0; k < n; k++) {
    const x = xs[k];
    const y = ys[k];
    if (x === y) continue;
    const c =
      /\d/.test(x[0]) && /\d/.test(y[0]) ? compareDigits(x, y) : x < y ? -1 : 1;
    if (c !== 0) return c;
  }
  if (xs.length !== ys.length) return xs.length - ys.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * 필드에 보이는 목록: 저장한 순서(order)의 값을 앞에(values에 없는 값은 건너뛴다), 나머지를 sort 순으로 뒤에.
 * pinned는 앞에 놓인 저장 값 수다.
 */
export function orderedList(
  values: readonly string[],
  order: readonly string[],
  sort: OrderSort,
): { list: string[]; pinned: number } {
  const known = new Set(values);
  const head: string[] = [];
  for (const v of order) if (known.has(v) && !head.includes(v)) head.push(v);
  const placed = new Set(head);
  const rest = values.filter((v) => !placed.has(v));
  if (sort === "natural") rest.sort(naturalCompare);
  return { list: [...head, ...rest], pinned: head.length };
}

/**
 * 목록에서 from번째 값을 to번째 자리로 옮긴 뒤 저장할 순서. 목록 맨 위부터 마지막으로 옮긴 값까지가 order다.
 * 앞서 옮겨 둔 값(pinned)은 지키므로, 저장 값보다 위로 옮기면 저장 값 수가 하나 늘 뿐이다.
 */
export function moveInOrder(
  list: readonly string[],
  pinned: number,
  from: number,
  to: number,
): string[] {
  if (from === to || from < 0 || to < 0 || from >= list.length) {
    return list.slice(0, pinned);
  }
  const next = [...list];
  const [moved] = next.splice(from, 1);
  const at = Math.min(to, next.length);
  next.splice(at, 0, moved);
  const length = Math.max(pinned + (from >= pinned ? 1 : 0), at + 1);
  return next.slice(0, length);
}
