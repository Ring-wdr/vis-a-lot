"use client";

// 목록 표시 고르기: 정렬(서버), 그룹핑, 열. 리스트와 저장된 뷰가 쓴다.

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import {
  columnLabels,
  POST_COLUMNS,
  type PostColumn,
} from "@/entities/post/model/post-model";
import {
  type ListSort,
  SORT_FIELDS,
} from "@/features/filter-posts/model/filter-url";
import type { PostSortField, ViewGroupBy } from "@/shared/api/feed/types";
import { segmented } from "@/shared/ui/segmented";
import "../config/messages";
import { MultiPick } from "./FilterBar";
import { SinglePick } from "./SinglePick";

const seg = segmented();

const SORT_FIELD_LABELS = {
  updatedAt: msg({ message: "수정일", context: "sort field" }),
  createdAt: msg({ message: "만든 날", context: "sort field" }),
  dueDate: msg({ message: "기한", context: "sort field" }),
  priority: msg({ message: "우선순위", context: "sort field" }),
  key: msg({ message: "키", context: "sort field" }),
  title: msg({ message: "제목", context: "sort field" }),
  status: msg({ message: "상태", context: "sort field" }),
} satisfies Record<PostSortField, MessageDescriptor>;

const GROUP_BY_LABELS = {
  none: msg({ message: "없음", context: "group posts by: no grouping" }),
  status: msg({ message: "상태", context: "group posts by" }),
  assignee: msg({ message: "담당자", context: "group posts by" }),
  priority: msg({ message: "우선순위", context: "group posts by" }),
} satisfies Record<ViewGroupBy | "none", MessageDescriptor>;

const GROUP = msg({ message: "그룹", context: "group posts by (label)" });

export function SortPick({
  sort,
  onChange,
}: {
  sort: ListSort;
  onChange: (sort: ListSort) => void;
}) {
  const { t, i18n } = useLingui();
  const asc = sort.dir === "asc";
  const options = SORT_FIELDS.map((value) => ({
    value,
    label: i18n._(SORT_FIELD_LABELS[value]),
  }));
  return (
    <span className="inline-flex items-center gap-1">
      <SinglePick
        label={t`정렬`}
        value={sort.field}
        options={options}
        onPick={(field) => onChange({ ...sort, field })}
      />
      <button
        type="button"
        className="inline-grid size-7 cursor-pointer place-items-center rounded-md border border-line bg-elevated text-fg-secondary hover:border-line-strong"
        aria-label={
          asc ? t`오름차순 (누르면 내림차순)` : t`내림차순 (누르면 오름차순)`
        }
        title={asc ? t`오름차순` : t`내림차순`}
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

const GROUP_OPTIONS: readonly (ViewGroupBy | null)[] = [
  null,
  "status",
  "assignee",
  "priority",
];

export function GroupByPick({
  value,
  onChange,
}: {
  value: ViewGroupBy | null;
  onChange: (v: ViewGroupBy | null) => void;
}) {
  const { i18n } = useLingui();
  return (
    <fieldset className="inline-flex items-center gap-1.5">
      <legend className="sr-only">{i18n._(GROUP)}</legend>
      <span
        className="text-xs whitespace-nowrap text-fg-muted"
        aria-hidden="true"
      >
        {i18n._(GROUP)}
      </span>
      <span className={seg.root({ class: "self-auto" })}>
        {GROUP_OPTIONS.map((o) => (
          <button
            key={String(o)}
            type="button"
            className={seg.item()}
            aria-pressed={value === o}
            onClick={() => onChange(o)}
          >
            {i18n._(GROUP_BY_LABELS[o ?? "none"])}
          </button>
        ))}
      </span>
    </fieldset>
  );
}

/** 열 고르기. 제목은 늘 보인다 */
export function ColumnPick({
  columns,
  onChange,
}: {
  columns: readonly PostColumn[];
  onChange: (columns: PostColumn[]) => void;
}) {
  const { t } = useLingui();
  // 열 이름은 지금 언어로 읽는다 (useLingui가 언어 변경을 구독한다)
  const options = POST_COLUMNS.filter((c) => c !== "title").map((value) => ({
    value,
    label: columnLabels()[value],
  }));
  return (
    <MultiPick
      label={t({ message: "열", context: "table columns" })}
      highlight={false}
      options={options}
      value={columns.filter((c) => c !== "title")}
      onChange={(picked) =>
        onChange(
          POST_COLUMNS.filter((c) => c === "title" || picked.includes(c)),
        )
      }
    />
  );
}
