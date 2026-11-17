// item 제목 검색: item 이름(split 조합 이름)에 건 조건으로 item 순서를 거른다.

import type { z } from "@hono/zod-openapi";
import type { ItemSearchSchema } from "../services/chart/schemas";

export type ItemSearch = z.infer<typeof ItemSearchSchema>;
type ItemSearchCond = ItemSearch[number];

function matches(label: string, { keyword, match }: ItemSearchCond) {
  const k = keyword.toLowerCase();
  switch (match) {
    case "contains":
      return label.includes(k);
    case "startsWith":
      return label.startsWith(k);
    case "endsWith":
      return label.endsWith(k);
    case "exact":
      return label === k;
  }
}

/** 조건 하나라도 맞으면(OR) 남긴다. 대소문자를 가리지 않는다. 조건이 없으면 모두 맞는다. */
export function matchesSearch(label: string, search: ItemSearch) {
  if (search.length === 0) return true;
  const lower = label.toLowerCase();
  return search.some((cond) => matches(lower, cond));
}

/** 거른 순서를 기억할 때 쓰는 조건 문자열. 조건이 없으면 undefined */
export function searchKeyOf(search: ItemSearch | undefined) {
  if (!search || search.length === 0) return undefined;
  return JSON.stringify(search.map((c) => [c.keyword.toLowerCase(), c.match]));
}

/** order(item 키)를 이름 조건으로 거른다. 이름은 labelOf로 찾는다. */
export function filterOrder(
  order: readonly string[],
  labelOf: (key: string) => string | undefined,
  search: ItemSearch,
) {
  return order.filter((key) => matchesSearch(labelOf(key) ?? "", search));
}
