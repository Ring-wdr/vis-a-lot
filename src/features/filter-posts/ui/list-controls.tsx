"use client";

// 목록 표시 고르기: 정렬(서버), 그룹핑, 열. 리스트와 저장된 뷰가 쓴다.

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
import { defineMessages, useT } from "@/shared/lib/i18n";
import { segmented } from "@/shared/ui/segmented";
import { MultiPick } from "./FilterBar";
import { SinglePick } from "./SinglePick";

const seg = segmented();

const messages = defineMessages<{
  sortFields: Record<PostSortField, string>;
  sort: string;
  ascLabel: string;
  descLabel: string;
  asc: string;
  desc: string;
  groupBy: Record<ViewGroupBy | "none", string>;
  group: string;
  columns: string;
}>({
  ko: {
    sortFields: {
      updatedAt: "수정일",
      createdAt: "만든 날",
      dueDate: "기한",
      priority: "우선순위",
      key: "키",
      title: "제목",
      status: "상태",
    },
    sort: "정렬",
    ascLabel: "오름차순 (누르면 내림차순)",
    descLabel: "내림차순 (누르면 오름차순)",
    asc: "오름차순",
    desc: "내림차순",
    groupBy: {
      none: "없음",
      status: "상태",
      assignee: "담당자",
      priority: "우선순위",
    },
    group: "그룹",
    columns: "열",
  },
  en: {
    sortFields: {
      updatedAt: "Updated",
      createdAt: "Created",
      dueDate: "Due",
      priority: "Priority",
      key: "Key",
      title: "Title",
      status: "Status",
    },
    sort: "Sort",
    ascLabel: "Ascending (click for descending)",
    descLabel: "Descending (click for ascending)",
    asc: "Ascending",
    desc: "Descending",
    groupBy: {
      none: "None",
      status: "Status",
      assignee: "Assignee",
      priority: "Priority",
    },
    group: "Group",
    columns: "Columns",
  },
});

export function SortPick({
  sort,
  onChange,
}: {
  sort: ListSort;
  onChange: (sort: ListSort) => void;
}) {
  const text = useT(messages);
  const asc = sort.dir === "asc";
  const options = SORT_FIELDS.map((value) => ({
    value,
    label: text.sortFields[value],
  }));
  return (
    <span className="inline-flex items-center gap-1">
      <SinglePick
        label={text.sort}
        value={sort.field}
        options={options}
        onPick={(field) => onChange({ ...sort, field })}
      />
      <button
        type="button"
        className="inline-grid size-7 cursor-pointer place-items-center rounded-md border border-line bg-elevated text-fg-secondary hover:border-line-strong"
        aria-label={asc ? text.ascLabel : text.descLabel}
        title={asc ? text.asc : text.desc}
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
  const text = useT(messages);
  return (
    <fieldset className="inline-flex items-center gap-1.5">
      <legend className="sr-only">{text.group}</legend>
      <span
        className="text-xs whitespace-nowrap text-fg-muted"
        aria-hidden="true"
      >
        {text.group}
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
            {text.groupBy[o ?? "none"]}
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
  const text = useT(messages);
  // 열 이름은 지금 언어로 읽는다 (useT가 언어 변경을 구독한다)
  const options = POST_COLUMNS.filter((c) => c !== "title").map((value) => ({
    value,
    label: columnLabels()[value],
  }));
  return (
    <MultiPick
      label={text.columns}
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
