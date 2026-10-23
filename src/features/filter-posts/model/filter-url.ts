// 리스트·보드의 필터·정렬·그룹핑·열을 URL query에 담는다. 링크로 나누고 뒤로 가기로 돌아올 수 있게 한다.
// 다른 query(g, peek 등)는 건드리지 않는다.

import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  STATUS_LABELS,
} from "@/entities/post/lib/labels";
import {
  DEFAULT_COLUMNS,
  POST_COLUMNS,
  type PostColumn,
} from "@/entities/post/model/post-model";
import type {
  PostFilter,
  PostFormat,
  PostSortField,
  PostStatus,
  StatusCategory,
  ViewGroupBy,
} from "@/shared/api/feed/types";

export type ListSort = { field: PostSortField; dir: "asc" | "desc" };

export type ListState = {
  filter: PostFilter;
  sort: ListSort;
  groupBy: ViewGroupBy | null;
  columns: readonly PostColumn[];
};

export const DEFAULT_SORT: ListSort = { field: "updatedAt", dir: "desc" };

export const SORT_FIELDS: readonly PostSortField[] = [
  "updatedAt",
  "createdAt",
  "dueDate",
  "priority",
  "key",
  "title",
  "status",
];

const GROUP_BYS = ["status", "assignee", "priority"] as const;

/** query 이름. 필터 키는 이 표에 있는 것만 URL로 간다 (groupIds 등은 화면이 정한다) */
const P = {
  statuses: "status",
  categories: "category",
  priorities: "priority",
  assigneeIds: "assignee",
  requesterIds: "requester",
  postTypeIds: "type",
  teamIds: "team",
  formats: "format",
  tags: "tag",
  dueFrom: "due_from",
  dueTo: "due_to",
  overdue: "overdue",
  q: "q",
  sort: "sort",
  groupBy: "group",
  columns: "cols",
} as const;

const OWNED = Object.values(P) as string[];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const list = (s: URLSearchParams, name: string) =>
  (s.get(name) ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const oneOf = <T extends string>(values: readonly T[]) => {
  const set = new Set<string>(values);
  return (v: string): v is T => set.has(v);
};

const isStatus = oneOf(Object.keys(STATUS_LABELS) as PostStatus[]);
const isCategory = oneOf(Object.keys(CATEGORY_LABELS) as StatusCategory[]);
const isFormat = oneOf(Object.keys(FORMAT_LABELS) as PostFormat[]);
const isSortField = oneOf(SORT_FIELDS);
const isGroupBy = oneOf(GROUP_BYS);
const isColumn = oneOf(POST_COLUMNS);

const uniq = <T>(values: T[]) => [...new Set(values)];

export function decodeListState(search: URLSearchParams): ListState {
  const filter: PostFilter = {};
  const statuses = uniq(list(search, P.statuses).filter(isStatus));
  if (statuses.length) filter.statuses = statuses;
  const categories = uniq(list(search, P.categories).filter(isCategory));
  if (categories.length) filter.categories = categories;
  const priorities = uniq(
    list(search, P.priorities)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 4),
  );
  if (priorities.length) filter.priorities = priorities;
  for (const key of [
    "assigneeIds",
    "requesterIds",
    "postTypeIds",
    "teamIds",
    "tags",
  ] as const) {
    const values = uniq(list(search, P[key]));
    if (values.length) filter[key] = values;
  }
  const formats = uniq(list(search, P.formats).filter(isFormat));
  if (formats.length) filter.formats = formats;
  const dueFrom = search.get(P.dueFrom);
  if (dueFrom && DAY.test(dueFrom)) filter.dueFrom = dueFrom;
  const dueTo = search.get(P.dueTo);
  if (dueTo && DAY.test(dueTo)) filter.dueTo = dueTo;
  if (search.get(P.overdue) === "1") filter.overdue = true;
  const q = search.get(P.q)?.trim();
  if (q) filter.q = q;

  const [field, dir] = (search.get(P.sort) ?? "").split(".");
  const sort: ListSort =
    field && isSortField(field) && (dir === "asc" || dir === "desc")
      ? { field, dir }
      : DEFAULT_SORT;

  const g = search.get(P.groupBy) ?? "";
  const groupBy: ViewGroupBy | null = isGroupBy(g) ? g : null;

  const cols = search.has(P.columns)
    ? uniq(list(search, P.columns).filter(isColumn))
    : null;
  // 표 순서는 POST_COLUMNS 순서로 맞춘다
  const columns = cols
    ? POST_COLUMNS.filter((c) => cols.includes(c))
    : DEFAULT_COLUMNS;

  return { filter, sort, groupBy, columns };
}

/** base의 다른 query는 두고, 목록 상태만 다시 쓴다. 기본값은 적지 않는다. */
export function encodeListState(
  state: Partial<ListState>,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const next = new URLSearchParams(base);
  for (const name of OWNED) next.delete(name);
  const f = state.filter ?? {};
  const setList = (name: string, values?: readonly (string | number)[]) => {
    if (values?.length) next.set(name, values.join(","));
  };
  setList(P.statuses, f.statuses);
  setList(P.categories, f.categories);
  setList(P.priorities, f.priorities);
  setList(P.assigneeIds, f.assigneeIds);
  setList(P.requesterIds, f.requesterIds);
  setList(P.postTypeIds, f.postTypeIds);
  setList(P.teamIds, f.teamIds);
  setList(P.formats, f.formats);
  setList(P.tags, f.tags);
  if (f.dueFrom) next.set(P.dueFrom, f.dueFrom);
  if (f.dueTo) next.set(P.dueTo, f.dueTo);
  if (f.overdue) next.set(P.overdue, "1");
  if (f.q?.trim()) next.set(P.q, f.q.trim());
  const sort = state.sort;
  if (
    sort &&
    (sort.field !== DEFAULT_SORT.field || sort.dir !== DEFAULT_SORT.dir)
  )
    next.set(P.sort, `${sort.field}.${sort.dir}`);
  if (state.groupBy) next.set(P.groupBy, state.groupBy);
  const cols = state.columns;
  if (cols && cols.join(",") !== DEFAULT_COLUMNS.join(","))
    next.set(P.columns, cols.join(","));
  return next;
}

/** 걸려 있는 필터 조건 수 (groupIds·검색어 제외) */
export function countFilters(filter: PostFilter) {
  let n = 0;
  for (const key of [
    "statuses",
    "categories",
    "priorities",
    "assigneeIds",
    "requesterIds",
    "postTypeIds",
    "teamIds",
    "formats",
    "tags",
  ] as const)
    if (filter[key]?.length) n++;
  if (filter.dueFrom || filter.dueTo) n++;
  if (filter.overdue) n++;
  return n;
}

/** 화면이 정하는 조건(groupIds)과 URL 조건을 합친 요청용 필터 */
export const withGroup = (filter: PostFilter, groupId: string): PostFilter => ({
  ...filter,
  groupIds: [groupId],
});
