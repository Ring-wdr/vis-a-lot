"use client";

// 리스트 표: 열 선택·정렬·그룹핑·다중 선택. 리스트, 내 작업, 저장된 뷰(리스트 표시)가 쓴다.
// 정렬은 받은 행 안에서 화면이 한다 (서버 정렬은 화면의 정렬 고르기가 맡는다).

import {
  type ColumnDef,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  type SortingState,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { priorityLabel } from "@/entities/post/lib/labels";
import {
  COLUMN_LABELS,
  DEFAULT_COLUMNS,
  groupPosts,
  POST_COLUMNS,
  type PostColumn,
  statusOrder,
} from "@/entities/post/model/post-model";
import type {
  PostStatus,
  PostSummary,
  ViewGroupBy,
} from "@/shared/api/feed/types";
import { tv } from "@/shared/lib/tw";
import {
  DueLabel,
  dayTime,
  PriorityMark,
  StatusBadge,
  Thumb,
  UserChip,
  useStatusName,
  useToday,
  useUserName,
} from "./post-meta";

export { POST_COLUMNS, type PostColumn };

export type PostTableProps = {
  posts: PostSummary[];
  columns?: readonly PostColumn[];
  groupBy?: ViewGroupBy | null;
  /** 다중 선택(일괄 변경). 없으면 선택 칸을 그리지 않는다 */
  selected?: ReadonlySet<string>;
  onSelectedChange?: (ids: Set<string>) => void;
  onOpen?: (key: string) => void;
};

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, alphanumeric: sortFn_alphanumeric },
});

const helper = createColumnHelper<typeof features, PostSummary>();

const cell = tv({
  base: "border-b border-line px-2 py-1.5 text-left align-middle",
  variants: {
    head: {
      true: "z-sticky sticky top-0 bg-panel text-xs font-semibold whitespace-nowrap text-fg-muted",
    },
  },
});

/** 열마다 폭·줄바꿈 */
const COLUMN_CLASS: Record<PostColumn, string> = {
  key: "w-20 font-mono text-xs whitespace-nowrap text-fg-muted",
  title: "min-w-60",
  status: "w-24",
  priority: "w-20",
  assignee: "w-32 max-w-40 whitespace-nowrap",
  dueDate: "w-20",
  updatedAt: "w-28 text-xs whitespace-nowrap text-fg-muted tabular-nums",
  thumbnail: "w-16",
};

type Ctx = {
  userName: (id: string) => string;
  today: string;
  onOpen?: (key: string) => void;
};

// biome-ignore lint/suspicious/noExplicitAny: 열마다 값 타입이 달라 목록으로 모을 때는 any로 둔다
type PostColumnDef = ColumnDef<typeof features, PostSummary, any>;

function buildColumns(cols: readonly PostColumn[], ctx: Ctx): PostColumnDef[] {
  const defs: Record<PostColumn, PostColumnDef> = {
    key: helper.accessor("key", {
      id: "key",
      header: COLUMN_LABELS.key,
      sortFn: "alphanumeric",
    }),
    title: helper.accessor("title", {
      id: "title",
      header: COLUMN_LABELS.title,
      sortFn: "alphanumeric",
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-1.5">
          {/* 행을 키보드로 여는 자리 */}
          <button
            type="button"
            className="min-w-0 cursor-pointer truncate text-left font-medium text-fg hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              ctx.onOpen?.(row.original.key);
            }}
          >
            {row.original.title}
          </button>
          {row.original.blocked && (
            <Ban
              size={12}
              className="flex-none text-danger"
              aria-label="막힘"
            />
          )}
        </span>
      ),
    }),
    status: helper.accessor((p) => statusOrder(p.status), {
      id: "status",
      header: COLUMN_LABELS.status,
      sortFn: "basic",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          groupId={row.original.groupId}
        />
      ),
    }),
    priority: helper.accessor("priority", {
      id: "priority",
      header: COLUMN_LABELS.priority,
      sortFn: "basic",
      sortDescFirst: true,
      cell: ({ row }) => (
        <PriorityMark priority={row.original.priority} showLabel />
      ),
    }),
    assignee: helper.accessor(
      (p) => (p.assigneeId ? ctx.userName(p.assigneeId) : undefined),
      {
        id: "assignee",
        header: COLUMN_LABELS.assignee,
        sortFn: "alphanumeric",
        sortUndefined: "last",
        cell: ({ row }) => <UserChip userId={row.original.assigneeId} />,
      },
    ),
    dueDate: helper.accessor((p) => p.dueDate ?? undefined, {
      id: "dueDate",
      header: COLUMN_LABELS.dueDate,
      sortFn: "basic",
      sortUndefined: "last",
      cell: ({ row }) => <DueLabel post={row.original} today={ctx.today} />,
    }),
    updatedAt: helper.accessor("updatedAt", {
      id: "updatedAt",
      header: COLUMN_LABELS.updatedAt,
      sortFn: "basic",
      sortDescFirst: true,
      cell: ({ row }) => (
        <time dateTime={row.original.updatedAt}>
          {dayTime.format(new Date(row.original.updatedAt))}
        </time>
      ),
    }),
    thumbnail: helper.display({
      id: "thumbnail",
      header: COLUMN_LABELS.thumbnail,
      enableSorting: false,
      cell: ({ row }) => (
        <Thumb
          post={row.original}
          className="aspect-16/10 w-14 rounded-sm border border-line"
        />
      ),
    }),
  };
  return cols.map((c) => defs[c]);
}

/** 머리 줄 선택 칸: 모두 / 일부(indeterminate) / 없음 */
function SelectAll({
  checked,
  partial,
  onChange,
}: {
  checked: boolean;
  partial: boolean;
  onChange: (on: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="size-3.5 cursor-pointer accent-accent"
      checked={checked}
      aria-label="모두 선택"
      onChange={(e) => onChange(e.currentTarget.checked)}
    />
  );
}

export function PostTable({
  posts,
  columns = DEFAULT_COLUMNS,
  groupBy = null,
  selected,
  onSelectedChange,
  onOpen,
}: PostTableProps) {
  const userName = useUserName();
  const statusName = useStatusName();
  const today = useToday();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const selectable = !!selected && !!onSelectedChange;

  const defs = useMemo(
    () => buildColumns(columns, { userName, today, onOpen }),
    [columns, userName, today, onOpen],
  );

  const table = useTable({
    features,
    columns: defs,
    data: posts,
    getRowId: (p) => p.id,
    state: { sorting },
    onSortingChange: setSorting,
  });

  const rows = table.getRowModel().rows;
  const groups = useMemo(() => {
    if (!groupBy) return null;
    const byId = new Map(rows.map((r) => [r.id, r]));
    // 그룹의 상태 이름은 첫 게시물의 그룹 이름을 따른다
    const groupOf = new Map(posts.map((p) => [p.status, p.groupId]));
    return groupPosts(
      rows.map((r) => r.original),
      groupBy,
      {
        status: (s: PostStatus) => statusName(s, groupOf.get(s)),
        user: userName,
        priority: priorityLabel,
      },
    ).map((g) => ({
      ...g,
      rows: g.posts.flatMap((p) => byId.get(p.id) ?? []),
    }));
  }, [rows, groupBy, posts, statusName, userName]);

  const ids = posts.map((p) => p.id);
  const selectedCount = selectable
    ? ids.filter((id) => selected.has(id)).length
    : 0;
  const width = columns.length + (selectable ? 1 : 0);

  const toggle = (id: string, on: boolean) => {
    if (!selectable) return;
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelectedChange(next);
  };

  const renderRow = (row: (typeof rows)[number]) => (
    <tr
      key={row.id}
      data-selected={(selectable && selected.has(row.id)) || undefined}
      className="cursor-pointer hover:bg-panel-hover data-selected:bg-accent-soft"
      onClick={() => onOpen?.(row.original.key)}
    >
      {selectable && (
        <td className={cell({ class: "w-8" })}>
          <input
            type="checkbox"
            className="size-3.5 cursor-pointer accent-accent"
            checked={selected.has(row.id)}
            aria-label={`${row.original.key} 선택`}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => toggle(row.id, e.currentTarget.checked)}
          />
        </td>
      )}
      {row.getAllCells().map((c) => (
        <td
          key={c.id}
          className={cell({ class: COLUMN_CLASS[c.column.id as PostColumn] })}
        >
          <table.FlexRender cell={c} />
        </td>
      ))}
    </tr>
  );

  return (
    // relative: 칸 안의 sr-only 글자(absolute)가 스크롤 상자 밖으로 나가 페이지를 넓히지 않게 한다
    <div className="relative overflow-x-auto rounded-lg border border-line bg-elevated">
      <table className="w-full border-separate border-spacing-0 text-ui">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {selectable && (
                <th scope="col" className={cell({ head: true, class: "w-8" })}>
                  <SelectAll
                    checked={ids.length > 0 && selectedCount === ids.length}
                    partial={selectedCount > 0 && selectedCount < ids.length}
                    onChange={(on) => {
                      const next = new Set(selected);
                      for (const id of ids) {
                        if (on) next.add(id);
                        else next.delete(id);
                      }
                      onSelectedChange(next);
                    }}
                  />
                </th>
              )}
              {hg.headers.map((h) => {
                const sorted = h.column.getIsSorted();
                const canSort = h.column.getCanSort();
                return (
                  <th
                    key={h.id}
                    scope="col"
                    className={cell({
                      head: true,
                      class: COLUMN_CLASS[h.column.id as PostColumn],
                    })}
                    aria-sort={
                      sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : undefined
                    }
                  >
                    {canSort ? (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 font-sans hover:text-fg"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        <table.FlexRender header={h} />
                        {sorted === "asc" && (
                          <ArrowUp size={12} aria-hidden="true" />
                        )}
                        {sorted === "desc" && (
                          <ArrowDown size={12} aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      <table.FlexRender header={h} />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        {groups ? (
          groups.map((g) => {
            const open = !collapsed.has(g.id);
            return (
              <tbody key={g.id}>
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={width}
                    className={cell({
                      class: "bg-panel-subtle py-1 text-xs font-semibold",
                    })}
                  >
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1"
                      aria-expanded={open}
                      onClick={() => {
                        const next = new Set(collapsed);
                        if (open) next.add(g.id);
                        else next.delete(g.id);
                        setCollapsed(next);
                      }}
                    >
                      {open ? (
                        <ChevronDown size={14} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={14} aria-hidden="true" />
                      )}
                      {g.label}
                      <span className="font-normal text-fg-muted tabular-nums">
                        {g.rows.length}
                      </span>
                    </button>
                  </th>
                </tr>
                {open && g.rows.map(renderRow)}
              </tbody>
            );
          })
        ) : (
          <tbody>{rows.map(renderRow)}</tbody>
        )}
      </table>
    </div>
  );
}
