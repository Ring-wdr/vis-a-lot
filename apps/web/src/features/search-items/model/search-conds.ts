// item 제목 검색 조건 다루기: 더하기(중복·한도), 지우기.

import type {
  ItemSearch,
  ItemSearchCond,
  ItemSearchMatch,
} from "@/shared/api/types";

/** 서버(GET /jobs/:jobId의 search)와 같은 한도. 화면은 server를 import하지 않아 값을 옮겨 적는다. */
export const MAX_SEARCH_CONDS = 10;
export const MAX_SEARCH_KEYWORD = 100;

/** 일치 방식. 고르는 순서대로 */
export const SEARCH_MATCHES = [
  "contains",
  "startsWith",
  "endsWith",
  "exact",
] as const satisfies readonly ItemSearchMatch[];

/** 글자와 방식이 같은 조건(대소문자 무시)이 이미 있는지 */
export function hasCond(search: ItemSearch, cond: ItemSearchCond) {
  const keyword = cond.keyword.toLowerCase();
  return search.some(
    (c) => c.match === cond.match && c.keyword.toLowerCase() === keyword,
  );
}

export type AddCondResult =
  | { ok: true; search: ItemSearch }
  | { ok: false; reason: "empty" | "duplicate" | "limit" | "tooLong" };

/** 조건 하나를 더한다. 앞뒤 공백은 뺀다. */
export function addCond(
  search: ItemSearch,
  keyword: string,
  match: ItemSearchMatch,
): AddCondResult {
  const cond = { keyword: keyword.trim(), match };
  if (cond.keyword === "") return { ok: false, reason: "empty" };
  if (cond.keyword.length > MAX_SEARCH_KEYWORD)
    return { ok: false, reason: "tooLong" };
  if (hasCond(search, cond)) return { ok: false, reason: "duplicate" };
  if (search.length >= MAX_SEARCH_CONDS) return { ok: false, reason: "limit" };
  return { ok: true, search: [...search, cond] };
}

export function removeCond(search: ItemSearch, index: number): ItemSearch {
  return search.filter((_, i) => i !== index);
}
