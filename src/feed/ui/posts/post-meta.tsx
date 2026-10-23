"use client";

// 카드·표·보드가 함께 쓰는 작은 표시: 상태 배지, 우선순위, 사람, 기한, 형식 아이콘, 썸네일.

import {
  ChartColumn,
  Code,
  Film,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { cn, tv } from "@/shared/lib/tw";
import { useGroupMap, useUserMap } from "../../api/lookups";
import { useClock } from "../../api/queries";
import type { PostFormat, PostStatus, PostSummary } from "../../api/types";
import { FORMAT_LABELS, priorityLabel, statusLabel } from "../../lib/labels";
import { isOverdue } from "./post-model";

/** 오늘 'YYYY-MM-DD'. 개발 장치의 시계 오프셋을 따른다 */
export function useToday() {
  const now = useClock().data?.now;
  return useMemo(() => {
    const d = now ? new Date(now) : new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dd}`;
  }, [now]);
}

/** 그룹이 바꾼 상태 이름을 붙이는 함수 */
export function useStatusName() {
  const groups = useGroupMap();
  return useMemo(
    () => (status: PostStatus, groupId?: string) =>
      statusLabel(
        status,
        groupId ? groups.get(groupId)?.statusNames : undefined,
      ),
    [groups],
  );
}

/** id → 이름. 모르는 id는 그대로 */
export function useUserName() {
  const users = useUserMap();
  return useMemo(() => (id: string) => users.get(id)?.name ?? id, [users]);
}

const statusBadge = tv({
  base: "inline-flex h-5 flex-none items-center rounded-sm px-1.5 text-2xs font-semibold whitespace-nowrap",
  variants: {
    status: {
      unresolved: "border border-line-strong bg-elevated text-fg-secondary",
      in_progress: "bg-accent-soft text-accent",
      in_review: "bg-accent text-on-accent",
      on_hold: "bg-panel-strong text-fg-secondary",
      resolved: "bg-panel-subtle text-fg-muted",
      cancelled: "bg-panel-subtle text-fg-muted line-through",
    },
  },
});

export function StatusBadge({
  status,
  groupId,
}: {
  status: PostStatus;
  groupId?: string;
}) {
  const name = useStatusName();
  return (
    <span className={statusBadge({ status })}>{name(status, groupId)}</span>
  );
}

/** 우선순위 막대 4칸. 긴급은 danger */
const BARS = [1, 2, 3, 4] as const;
const BAR_HEIGHT = ["h-1.5", "h-2", "h-2.5", "h-3"] as const;

export function PriorityMark({
  priority,
  showLabel = false,
}: {
  priority: number;
  showLabel?: boolean;
}) {
  const label = priorityLabel(priority);
  return (
    <span
      className="inline-flex flex-none items-center gap-1 text-xs text-fg-secondary"
      title={`우선순위 ${label}`}
    >
      <span className="inline-flex items-end gap-px" aria-hidden="true">
        {BARS.map((b, i) => (
          <span
            key={b}
            className={cn(
              "w-1 rounded-xs",
              BAR_HEIGHT[i],
              b > priority
                ? "bg-line"
                : priority >= 4
                  ? "bg-danger"
                  : "bg-fg-secondary",
            )}
          />
        ))}
      </span>
      {showLabel ? label : <span className="sr-only">우선순위 {label}</span>}
    </span>
  );
}

/** 사람: 이름 첫 글자 동그라미 + 이름 */
export function UserChip({
  userId,
  compact = false,
  emptyLabel = "담당자 없음",
}: {
  userId: string | null;
  /** 이름을 숨기고 동그라미만 (이름은 title·sr-only로) */
  compact?: boolean;
  emptyLabel?: string;
}) {
  const users = useUserMap();
  if (!userId)
    return <span className="text-xs text-fg-muted">{emptyLabel}</span>;
  const name = users.get(userId)?.name ?? userId;
  return (
    <span
      className="inline-flex min-w-0 items-center gap-1.5 text-xs text-fg-secondary"
      title={name}
    >
      <span
        className="inline-grid size-5 flex-none place-items-center rounded-full bg-accent-soft text-3xs font-semibold text-accent"
        aria-hidden="true"
      >
        {name.slice(0, 1)}
      </span>
      {compact ? (
        <span className="sr-only">{name}</span>
      ) : (
        <span className="truncate">{name}</span>
      )}
    </span>
  );
}

const shortDay = (day: string) => {
  const [, m, d] = day.split("-");
  return `${Number(m)}/${Number(d)}`;
};

/** 기한. 지난 열린 게시물은 빨갛게 */
export function DueLabel({
  post,
  today,
}: {
  post: Pick<PostSummary, "dueDate" | "category">;
  today: string;
}) {
  if (!post.dueDate) return <span className="text-xs text-fg-muted">—</span>;
  const overdue = isOverdue(post, today);
  return (
    <time
      dateTime={post.dueDate}
      data-overdue={overdue || undefined}
      className="text-xs whitespace-nowrap text-fg-secondary tabular-nums data-overdue:font-semibold data-overdue:text-danger"
      title={overdue ? `기한 지남 (${post.dueDate})` : post.dueDate}
    >
      {shortDay(post.dueDate)}
      {overdue && <span className="sr-only"> 기한 지남</span>}
    </time>
  );
}

export const FORMAT_ICONS: Record<PostFormat, LucideIcon> = {
  chart: ChartColumn,
  image: ImageIcon,
  video: Film,
  code: Code,
};

/** 썸네일. 없거나 못 읽으면 형식 아이콘 */
export function Thumb({
  post,
  className,
}: {
  post: Pick<PostSummary, "thumbnail" | "format" | "title">;
  className?: string;
}) {
  const Icon = FORMAT_ICONS[post.format];
  return (
    <span
      className={cn(
        "relative grid place-items-center overflow-hidden bg-panel text-fg-muted",
        className,
      )}
    >
      <Icon size={20} aria-label={FORMAT_LABELS[post.format]} />
      {post.thumbnail && (
        // biome-ignore lint/performance/noImgElement: 정적 export라 next/image 최적화가 없고, 썸네일은 data URL이다
        <img
          src={post.thumbnail}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          onError={(e) => {
            e.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}

export const dayTime = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
