"use client";

// 목록 표시 고르기: 정렬(서버), 그룹핑, 열. 리스트와 저장된 뷰가 쓴다.

import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { segmented } from "@/shared/ui/segmented";
import type { PostSortField, ViewGroupBy } from "../../api/types";
import {
  COLUMN_LABELS,
  POST_COLUMNS,
  type PostColumn,
} from "../posts/post-model";
import { MultiPick } from "./FilterBar";
import { type ListSort, SORT_FIELDS } from "./filter-url";
import { SinglePick } from "./SinglePick";

const seg = segmented();

export const SORT_LABELS: Record<PostSortField, string> = {
  updatedAt: "수정일",
  createdAt: "만든 날",
  dueDate: "기한",
  priority: "우선순위",
  key: "키",
  title: "제목",
  status: "상태",
};

const SORT_OPTIONS = SORT_FIELDS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

export function SortPick({
  sort,
  onChange,
}: {
  sort: ListSort;
  onChange: (sort: ListSort) => void;
}) {
  const asc = sort.dir === "asc";
  return (
    <span className="inline-flex items-center gap-1">
      <SinglePick
        label="정렬"
        value={sort.field}
        options={SORT_OPTIONS}
        onPick={(field) => onChange({ ...sort, field })}
      />
      <button
        type="button"
        className="inline-grid size-7 cursor-pointer place-items-center rounded-md border border-line bg-elevated text-fg-secondary hover:border-line-strong"
        aria-label={
          asc ? "오름차순 (누르면 내림차순)" : "내림차순 (누르면 오름차순)"
        }
        title={asc ? "오름차순" : "내림차순"}
        onClick={() => onChange({ ...sort, dir: asc ? "desc" : "asc" })}
      >
        {asc ? (
          <ArrowUpNarrowWide size={14} aria-hidden="true" />
        ) : (
          <ArrowDownWideNarrow size={14} aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

const GROUP_OPTIONS: { value: ViewGroupBy | null; label: string }[] = [
  { value: null, label: "없음" },
  { value: "status", label: "상태" },
  { value: "assignee", label: "담당자" },
  { value: "priority", label: "우선순위" },
];

export function GroupByPick({
  value,
  onChange,
}: {
  value: ViewGroupBy | null;
  onChange: (v: ViewGroupBy | null) => void;
}) {
  return (
    <fieldset className="inline-flex items-center gap-1.5">
      <legend className="sr-only">그룹</legend>
      <span className="text-xs text-fg-muted" aria-hidden="true">
        그룹
      </span>
      <span className={seg.root({ class: "self-auto" })}>
        {GROUP_OPTIONS.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className={seg.item()}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </span>
    </fieldset>
  );
}

const COLUMN_OPTIONS = POST_COLUMNS.filter((c) => c !== "title").map(
  (value) => ({ value, label: COLUMN_LABELS[value] }),
);

/** 열 고르기. 제목은 늘 보인다 */
export function ColumnPick({
  columns,
  onChange,
}: {
  columns: readonly PostColumn[];
  onChange: (columns: PostColumn[]) => void;
}) {
  return (
    <MultiPick
      label="열"
      highlight={false}
      options={COLUMN_OPTIONS}
      value={columns.filter((c) => c !== "title")}
      onChange={(picked) =>
        onChange(
          POST_COLUMNS.filter((c) => c === "title" || picked.includes(c)),
        )
      }
    />
  );
}
