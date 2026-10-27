"use client";

// 목록 필터 줄: 검색, 다중 선택(상태·카테고리·우선순위·사람·유형·팀·형식), 태그, 기한 범위, 기한 지남.
// 상태는 화면이 URL에 들고 있고, 여기서는 바뀐 필터를 onChange로 돌려줄 뿐이다.

import { ChevronDown, Search, X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  PRIORITY_LABELS,
  statusLabel,
} from "@/entities/post/lib/labels";
import { BOARD_STATUSES } from "@/entities/post/model/post-model";
import { countFilters } from "@/features/filter-posts/model/filter-url";
import type {
  FeedUser,
  PostFilter,
  PostFormat,
  PostStatus,
  PostType,
  StatusCategory,
  StatusNames,
  Team,
} from "@/shared/api/feed/types";
import { tv } from "@/shared/lib/tw";
import { useDebounced } from "@/shared/lib/use-debounced";
import { useDraftState } from "@/shared/lib/use-draft-state";
import { button } from "@/shared/ui/button";
import { Popover } from "@/shared/ui/Popover";

export const filterChip = tv({
  slots: {
    trigger:
      "inline-flex h-7 max-w-56 min-w-0 cursor-pointer items-center gap-1 rounded-md border border-line bg-elevated px-2 text-xs whitespace-nowrap text-fg-secondary hover:border-line-strong aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:text-accent",
    value: "min-w-0 truncate font-semibold",
    list: "flex max-h-72 flex-col gap-0.5 overflow-y-auto",
    option:
      "flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-ui hover:bg-panel-hover",
    check: "size-3.5 flex-none accent-accent",
    foot: "mt-2 flex justify-between gap-2 border-t border-line pt-2",
    field: "flex flex-col gap-1 text-xs text-fg-secondary",
    input:
      "h-7.5 rounded-md border border-line bg-elevated px-2 text-ui text-fg",
  },
  variants: {
    // 조건이 걸린 버튼
    on: { true: { trigger: "border-accent-line bg-accent-soft text-accent" } },
  },
});

const c = filterChip();

export type PickOption<T extends string | number> = {
  value: T;
  label: string;
};

const NONE: readonly never[] = [];

/** 버튼 + 체크 목록 팝오버. 고른 것이 하나면 그 이름, 여럿이면 개수를 보인다 */
export function MultiPick<T extends string | number>({
  label,
  options,
  value: given = NONE,
  onChange: emit,
  width = 220,
  highlight = true,
}: {
  label: string;
  options: readonly PickOption<T>[];
  value?: readonly T[];
  onChange: (next: T[]) => void;
  width?: number;
  /** 고른 것이 있을 때 버튼을 강조한다 (필터). 열 고르기처럼 늘 고른 것이 있으면 끈다 */
  highlight?: boolean;
}) {
  // URL이 바뀌어 값이 돌아오기 전에도 체크가 바로 보이게 고른 값을 먼저 들고 있는다
  const [value, setValue] = useDraftState<readonly T[]>(given, given.join(","));
  const onChange = (next: T[]) => {
    setValue(next);
    emit(next);
  };
  const chosen = options.filter((o) => value.includes(o.value));
  const summary =
    chosen.length === 1
      ? chosen[0].label
      : chosen.length
        ? `${chosen.length}`
        : "";
  return (
    <Popover
      width={width}
      triggerClassName={c.trigger({ on: highlight && chosen.length > 0 })}
      trigger={
        <span className="inline-flex min-w-0 items-center gap-1">
          {label}
          {summary && <span className={c.value()}>: {summary}</span>}
          <ChevronDown size={12} aria-hidden="true" />
        </span>
      }
      panelClassName="p-2"
    >
      {(close) => (
        <fieldset>
          <legend className="mb-1 px-1.5 text-2xs font-semibold text-fg-muted">
            {label}
          </legend>
          {options.length === 0 ? (
            <p className="px-1.5 py-1 text-xs text-fg-muted">
              고를 항목이 없습니다
            </p>
          ) : (
            <div className={c.list()}>
              {options.map((o) => (
                <label key={String(o.value)} className={c.option()}>
                  <input
                    type="checkbox"
                    className={c.check()}
                    checked={value.includes(o.value)}
                    onChange={(e) => {
                      const on = e.currentTarget.checked;
                      onChange(
                        on
                          ? [...value, o.value]
                          : value.filter((v) => v !== o.value),
                      );
                    }}
                  />
                  <span className="truncate">{o.label}</span>
                </label>
              ))}
            </div>
          )}
          <div className={c.foot()}>
            <button
              type="button"
              className={button({ size: "sm" })}
              disabled={!value.length}
              onClick={() => onChange([])}
            >
              모두 해제
            </button>
            <button
              type="button"
              className={button({ size: "sm", variant: "primary" })}
              onClick={close}
            >
              닫기
            </button>
          </div>
        </fieldset>
      )}
    </Popover>
  );
}

/** 팝오버 안 폼 (태그·기한) */
function PopoverForm({
  label,
  summary,
  children,
  width = 240,
}: {
  label: string;
  summary: string;
  width?: number;
  children: (close: () => void) => ReactNode;
}) {
  return (
    <Popover
      width={width}
      triggerClassName={c.trigger({ on: !!summary })}
      trigger={
        <span className="inline-flex min-w-0 items-center gap-1">
          {label}
          {summary && <span className={c.value()}>: {summary}</span>}
          <ChevronDown size={12} aria-hidden="true" />
        </span>
      }
    >
      {children}
    </Popover>
  );
}

function TagForm({
  tags,
  onChange,
  close,
}: {
  tags: readonly string[];
  onChange: (tags: string[]) => void;
  close: () => void;
}) {
  const [text, setText] = useDraftState(tags.join(", "));
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onChange([
          ...new Set(
            text
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          ),
        ]);
        close();
      }}
    >
      <label className={c.field()}>
        태그 (쉼표로 여럿)
        <input
          className={c.input()}
          value={text}
          placeholder="예: 매출, 대시보드"
          onChange={(e) => setText(e.currentTarget.value)}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className={button({ size: "sm" })}
          onClick={() => {
            onChange([]);
            close();
          }}
        >
          지우기
        </button>
        <button
          type="submit"
          className={button({ size: "sm", variant: "primary" })}
        >
          적용
        </button>
      </div>
    </form>
  );
}

function DueForm({
  from,
  to,
  onChange,
  close,
}: {
  from?: string | null;
  to?: string | null;
  onChange: (from: string | undefined, to: string | undefined) => void;
  close: () => void;
}) {
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        onChange(
          String(data.get("from") ?? "") || undefined,
          String(data.get("to") ?? "") || undefined,
        );
        close();
      }}
    >
      <label className={c.field()}>
        부터
        <input
          name="from"
          type="date"
          className={c.input()}
          defaultValue={from ?? ""}
        />
      </label>
      <label className={c.field()}>
        까지
        <input
          name="to"
          type="date"
          className={c.input()}
          defaultValue={to ?? ""}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className={button({ size: "sm" })}
          onClick={() => {
            onChange(undefined, undefined);
            close();
          }}
        >
          지우기
        </button>
        <button
          type="submit"
          className={button({ size: "sm", variant: "primary" })}
        >
          적용
        </button>
      </div>
    </form>
  );
}

const shortDay = (d?: string | null) => (d ? d.slice(5).replace("-", "/") : "");

/** 검색어: 치는 동안은 화면에 두고, 멈추면 onChange */
function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (q: string) => void;
}) {
  // URL이 바깥에서 바뀌면(뒤로 가기, 지우기) 따라간다
  const [text, setText] = useDraftState(value);
  const debounced = useDebounced(text, 300);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 멈춘 값이 바뀔 때만 보낸다 (onChange·value는 매번 바뀐다)
  useEffect(() => {
    if (debounced.trim() !== value) onChange(debounced.trim());
  }, [debounced]);
  return (
    <label className="relative flex h-7 w-48 min-w-0 items-center">
      <Search
        size={13}
        className="pointer-events-none absolute left-2 text-fg-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        className="size-full rounded-md border border-line bg-elevated pr-2 pl-7 text-xs text-fg"
        placeholder="제목·본문 검색"
        aria-label="검색"
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
      />
    </label>
  );
}

export type FilterBarProps = {
  filter: PostFilter;
  onChange: (next: PostFilter) => void;
  /** 고를 사람 (보통 그룹 멤버) */
  users: readonly FeedUser[];
  teams?: readonly Team[];
  postTypes?: readonly PostType[];
  statusNames?: StatusNames;
  /** 보드처럼 상태가 열인 화면: 상태·카테고리 고르기를 숨긴다 */
  compact?: boolean;
};

const PRIORITY_OPTIONS = ([4, 3, 2, 1, 0] as const).map((p) => ({
  value: p as number,
  label: PRIORITY_LABELS[p],
}));
const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABELS) as StatusCategory[]).map(
  (value) => ({ value, label: CATEGORY_LABELS[value] }),
);
const FORMAT_OPTIONS = (Object.keys(FORMAT_LABELS) as PostFormat[]).map(
  (value) => ({ value, label: FORMAT_LABELS[value] }),
);

/** 값이 비면 키를 지워서 URL이 깨끗하게 남게 한다 */
function patch<K extends keyof PostFilter>(
  filter: PostFilter,
  key: K,
  value: PostFilter[K] | undefined,
): PostFilter {
  const next = { ...filter };
  const empty =
    value === undefined ||
    value === "" ||
    value === false ||
    (Array.isArray(value) && value.length === 0);
  if (empty) delete next[key];
  else next[key] = value;
  return next;
}

export function FilterBar({
  filter,
  onChange,
  users,
  teams = [],
  postTypes = [],
  statusNames,
  compact = false,
}: FilterBarProps) {
  const set = <K extends keyof PostFilter>(key: K, value: PostFilter[K]) =>
    onChange(patch(filter, key, value));
  const people = users.map((u) => ({ value: u.id, label: u.name }));
  const statusOptions = BOARD_STATUSES.map((s: PostStatus) => ({
    value: s,
    label: statusLabel(s, statusNames),
  }));
  const active = countFilters(filter) + (filter.q ? 1 : 0);

  return (
    <search className="flex flex-wrap items-center gap-1.5" aria-label="필터">
      <SearchBox value={filter.q ?? ""} onChange={(q) => set("q", q)} />
      {!compact && (
        <>
          <MultiPick
            label="상태"
            options={statusOptions}
            value={filter.statuses}
            onChange={(v) => set("statuses", v)}
          />
          <MultiPick
            label="카테고리"
            options={CATEGORY_OPTIONS}
            value={filter.categories}
            onChange={(v) => set("categories", v)}
          />
        </>
      )}
      <MultiPick
        label="우선순위"
        options={PRIORITY_OPTIONS}
        value={filter.priorities}
        onChange={(v) => set("priorities", v)}
      />
      <MultiPick
        label="담당자"
        options={people}
        value={filter.assigneeIds}
        onChange={(v) => set("assigneeIds", v)}
      />
      <MultiPick
        label="요청자"
        options={people}
        value={filter.requesterIds}
        onChange={(v) => set("requesterIds", v)}
      />
      <MultiPick
        label="유형"
        options={postTypes.map((t) => ({ value: t.id, label: t.name }))}
        value={filter.postTypeIds}
        onChange={(v) => set("postTypeIds", v)}
      />
      <MultiPick
        label="팀"
        options={teams.map((t) => ({ value: t.id, label: t.name }))}
        value={filter.teamIds}
        onChange={(v) => set("teamIds", v)}
      />
      <MultiPick
        label="형식"
        options={FORMAT_OPTIONS}
        value={filter.formats}
        onChange={(v) => set("formats", v)}
      />
      <PopoverForm
        label="태그"
        summary={
          filter.tags?.length === 1
            ? filter.tags[0]
            : filter.tags?.length
              ? String(filter.tags.length)
              : ""
        }
      >
        {(close) => (
          <TagForm
            tags={filter.tags ?? []}
            onChange={(v) => set("tags", v)}
            close={close}
          />
        )}
      </PopoverForm>
      <PopoverForm
        label="기한"
        width={200}
        summary={
          filter.dueFrom || filter.dueTo
            ? `${shortDay(filter.dueFrom)}~${shortDay(filter.dueTo)}`
            : ""
        }
      >
        {(close) => (
          <DueForm
            from={filter.dueFrom}
            to={filter.dueTo}
            close={close}
            onChange={(from, to) =>
              onChange(patch(patch(filter, "dueFrom", from), "dueTo", to))
            }
          />
        )}
      </PopoverForm>
      <button
        type="button"
        className={c.trigger()}
        aria-pressed={!!filter.overdue}
        onClick={() => set("overdue", !filter.overdue)}
      >
        기한 지남
      </button>
      {active > 0 && (
        <button
          type="button"
          className="inline-flex h-7 cursor-pointer items-center gap-1 px-1.5 text-xs text-fg-muted hover:text-fg"
          onClick={() => onChange({})}
        >
          <X size={12} aria-hidden="true" />
          필터 지우기
        </button>
      )}
    </search>
  );
}
