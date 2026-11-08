"use client";

// 칸반 보드: 상태 열(카테고리 순), 드래그로 상태 변경, 팀 스윔레인. 보드와 저장된 뷰(보드 표시)가 쓴다.
// 놓으면 바로 옮겨 보여 주고(낙관적), API가 실패하면 되돌리고 이유를 띄운다.

import {
  type Announcements,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, MessageSquare } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  BOARD_STATUSES,
  byStatus,
  type Lane,
  planMove,
  teamLanes,
} from "@/entities/post/model/post-model";
import {
  DueLabel,
  PriorityMark,
  UserChip,
  useStatusName,
  useToday,
} from "@/entities/post/ui/post-meta";
import { invalidatePosts } from "@/shared/api/feed/post-queries";
import { postsApi } from "@/shared/api/feed/posts";
import type { PostStatus, PostSummary, Team } from "@/shared/api/feed/types";
import { useLocale } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/tw";
import { showAlert } from "@/shared/ui/AlertDialog";
import { Spinner } from "@/shared/ui/Loading";
import "../config/messages";
import { askCancel, askHold, askReject } from "./move-dialogs";

export type PostBoardProps = {
  posts: PostSummary[];
  /** 팀별 스윔레인. 없으면 한 줄 */
  swimlane?: "team" | null;
  teams?: Team[];
  onOpen?: (key: string) => void;
  /** 열 이름에 쓸 그룹 (그룹이 바꾼 상태 이름). 없으면 첫 게시물의 그룹 */
  groupId?: string;
};

const NO_TEAMS: Team[] = [];

/** 열 머리의 카테고리 표시 */
const CATEGORY_DOT: Record<PostStatus, string> = {
  unresolved: "bg-line-strong",
  in_progress: "bg-accent-line",
  in_review: "bg-accent",
  on_hold: "bg-panel-active",
  resolved: "bg-fg-secondary",
  cancelled: "bg-fg-muted",
};

type CellData = { status: PostStatus; label: string };
type CardData = { post: PostSummary };

/** 포인터는 포인터 아래 열, 키보드는 카드가 겹친 열 */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

/** 키보드 화살표: 옆 열(좌우) / 위아래 스윔레인의 같은 열로 건너뛴다 */
const jumpToCell: KeyboardCoordinateGetter = (event, { context }) => {
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (!collisionRect) return;
  const dx =
    event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  const dy = event.code === "ArrowDown" ? 1 : event.code === "ArrowUp" ? -1 : 0;
  if (!dx && !dy) return;
  event.preventDefault();
  const cx = collisionRect.left + collisionRect.width / 2;
  const cy = collisionRect.top + collisionRect.height / 2;
  let best: { x: number; y: number; d: number } | null = null;
  for (const c of droppableContainers.getEnabled()) {
    const r = droppableRects.get(c.id);
    if (!r) continue;
    const rx = r.left + r.width / 2;
    const ahead = dx ? (rx - cx) * dx : (r.top + r.height / 2 - cy) * dy;
    // 같은 줄(좌우) 또는 같은 열(위아래)에서 진행 방향으로 가장 가까운 칸
    const inLine = dx
      ? r.top <= cy && cy <= r.bottom
      : r.left <= cx && cx <= r.right;
    if (ahead <= 1 || !inLine) continue;
    if (!best || ahead < best.d)
      best = {
        x: r.left + (r.width - collisionRect.width) / 2,
        y: r.top + 8,
        d: ahead,
      };
  }
  return best ? { x: best.x, y: best.y } : undefined;
};

function BoardCardBody({ post, today }: { post: PostSummary; today: string }) {
  const { t } = useLingui();
  return (
    <>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-2xs text-fg-muted">{post.key}</span>
        {post.blocked && (
          <Ban
            size={12}
            className="text-danger"
            aria-label={t({ message: "막힘", context: "blocked post icon" })}
          />
        )}
        <span className="ml-auto">
          <PriorityMark priority={post.priority} />
        </span>
      </span>
      <span className="line-clamp-2 text-ui font-medium text-fg">
        {post.title}
      </span>
      {post.progress > 0 && (
        <span
          className="block h-1 overflow-hidden rounded-full bg-panel-strong"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full bg-accent"
            style={{ width: `${post.progress}%` }}
          />
        </span>
      )}
      <span className="flex min-w-0 items-center gap-2">
        <UserChip userId={post.assigneeId} compact />
        <span className="ml-auto inline-flex items-center gap-2">
          {post.commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs text-fg-muted tabular-nums">
              <MessageSquare size={12} aria-hidden="true" />
              {post.commentCount}
              <span className="sr-only">
                <Trans
                  context="unit after a card's comment count"
                  comment="숫자 바로 뒤에 붙는다. 영어는 앞에 공백을 둔다"
                >
                  개 댓글
                </Trans>
              </span>
            </span>
          )}
          <DueLabel post={post} today={today} />
        </span>
      </span>
    </>
  );
}

const cardClass =
  "flex w-full min-w-0 cursor-grab touch-none flex-col gap-1.5 rounded-md border border-line bg-elevated p-2.5 text-left shadow-xs outline-accent hover:border-line-strong focus-visible:outline-2 data-pending:opacity-60";

function BoardCard({
  post,
  today,
  pending,
  onOpen,
  suppressClick,
}: {
  post: PostSummary;
  today: string;
  pending: boolean;
  onOpen?: (key: string) => void;
  suppressClick: React.RefObject<boolean>;
}) {
  const { t } = useLingui();
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: post.id,
    data: { post } satisfies CardData,
    disabled: pending,
    attributes: { roleDescription: t`옮길 수 있는 카드` },
  });
  return (
    <li className="relative">
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        data-pending={pending || undefined}
        className={cn(cardClass, isDragging && "opacity-30")}
        aria-label={`${post.key} ${post.title}`}
        onClick={() => {
          if (!suppressClick.current) onOpen?.(post.key);
        }}
      >
        <BoardCardBody post={post} today={today} />
      </button>
      {pending && (
        <span className="absolute top-2 right-2">
          <Spinner size="sm" />
        </span>
      )}
    </li>
  );
}

function BoardCell({
  laneId,
  status,
  label,
  children,
  count,
  showCount,
}: {
  laneId: string;
  status: PostStatus;
  label: string;
  count: number;
  showCount: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLingui();
  const { setNodeRef, isOver } = useDroppable({
    id: `${laneId}|${status}`,
    data: { status, label } satisfies CellData,
  });
  return (
    <section
      ref={setNodeRef}
      aria-label={t({
        message: `${label} ${plural(count, { other: "#건" })}`,
        comment: "{label}은 보드 칸 이름(상태, 스윔레인이면 '팀 · 상태')",
      })}
      data-over={isOver || undefined}
      className="flex min-h-24 min-w-0 flex-col gap-2 rounded-lg border border-transparent bg-panel p-2 data-over:border-accent data-over:bg-accent-soft"
    >
      {showCount && (
        <p className="px-0.5 text-2xs text-fg-muted tabular-nums">
          {t`${plural(count, { other: "#건" })}`}
        </p>
      )}
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

export function PostBoard({
  posts,
  swimlane = null,
  teams = NO_TEAMS,
  onOpen,
  groupId,
}: PostBoardProps) {
  const { t } = useLingui();
  const locale = useLocale();
  const client = useQueryClient();
  const today = useToday();
  const statusName = useStatusName();
  const nameGroup = groupId ?? posts[0]?.groupId;
  const label = (s: PostStatus) => statusName(s, nameGroup);

  /** 낙관적으로 옮긴 상태. 서버 결과를 다시 받으면 지운다 */
  const [moved, setMoved] = useState<Record<string, PostStatus>>({});
  const [active, setActive] = useState<PostSummary | null>(null);
  const suppressClick = useRef(false);

  const shown = useMemo(
    () => posts.map((p) => (moved[p.id] ? { ...p, status: moved[p.id] } : p)),
    [posts, moved],
  );
  const lanes: Lane[] = useMemo(
    () =>
      swimlane === "team"
        ? teamLanes(shown, teams, locale)
        : [{ id: "all", label: "", posts: shown }],
    [shown, swimlane, teams, locale],
  );
  const totals = byStatus(shown);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      // Enter는 카드 열기로 두고, Space로 집고 놓는다
      keyboardCodes: {
        start: ["Space"],
        cancel: ["Escape"],
        end: ["Space", "Enter"],
      },
      coordinateGetter: jumpToCell,
    }),
  );

  const forget = (id: string) =>
    setMoved((m) => {
      const { [id]: _, ...rest } = m;
      return rest;
    });

  async function move(post: PostSummary, to: PostStatus) {
    const kind = planMove(post.status, to);
    if (!kind) return;
    let call: () => Promise<unknown>;
    switch (kind) {
      case "requestReview":
        call = () => postsApi.requestReview(post.id);
        break;
      case "approve":
        call = () => postsApi.approve(post.id);
        break;
      case "reopen":
        call = () => postsApi.reopen(post.id);
        break;
      case "reject": {
        const comment = await askReject(post.title);
        if (!comment) return;
        call = () => postsApi.reject(post.id, comment);
        break;
      }
      case "hold": {
        const hold = await askHold(post.title, today);
        if (!hold) return;
        call = () => postsApi.transition(post.id, { to, ...hold });
        break;
      }
      case "cancel": {
        const reason = await askCancel(post.title);
        if (!reason) return;
        call = () => postsApi.transition(post.id, { to, reason });
        break;
      }
      default:
        call = () => postsApi.transition(post.id, { to });
    }
    setMoved((m) => ({ ...m, [post.id]: to }));
    try {
      await call();
      await invalidatePosts(client);
      forget(post.id);
    } catch (e) {
      forget(post.id);
      const key = post.key;
      const toName = label(to);
      const reason = e instanceof Error ? e.message : String(e);
      showAlert(
        t({
          message: `${key}을(를) ${toName}(으)로 옮기지 못했습니다: ${reason}`,
          comment: "{key}는 게시물 키, {toName}은 옮기려던 상태 이름",
        }),
      );
    }
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    suppressClick.current = true;
    setActive((active.data.current as CardData | undefined)?.post ?? null);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    // 놓은 직후의 click(Enter 포함)으로 카드가 열리지 않게 한 박자 늦게 푼다
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const post = (active.data.current as CardData | undefined)?.post;
    const cell = over?.data.current as CellData | undefined;
    if (!post || !cell) return;
    const current = shown.find((p) => p.id === post.id) ?? post;
    void move(current, cell.status);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const key = (active.data.current as CardData | undefined)?.post.key ?? "";
      return t`${key} 카드를 집었습니다. 화살표로 열을 옮기고 Space로 놓습니다.`;
    },
    onDragOver: ({ over }) => {
      if (!over) return undefined;
      const label = (over.data.current as CellData).label;
      return t`${label} 열 위`;
    },
    onDragEnd: ({ over }) => {
      if (!over) return t`놓을 열이 없어 그대로 둡니다.`;
      const label = (over.data.current as CellData).label;
      return t`${label} 열에 놓았습니다.`;
    },
    onDragCancel: () => t`옮기기를 취소했습니다.`,
  };

  const pendingIds = new Set(Object.keys(moved));
  const lanesOn = swimlane === "team";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActive(null);
        suppressClick.current = false;
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: t`Space로 카드를 집고, 화살표로 열을 옮긴 뒤 Space로 놓습니다. Esc는 취소, Enter는 카드 열기입니다.`,
        },
      }}
    >
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-max grid-cols-[repeat(6,minmax(15rem,1fr))] gap-2">
          {BOARD_STATUSES.map((s) => (
            <h2
              key={s}
              className="z-sticky sticky top-0 flex items-center gap-1.5 bg-surface p-1 text-xs font-semibold text-fg-secondary"
            >
              <span
                className={cn("size-2 flex-none rounded-full", CATEGORY_DOT[s])}
                aria-hidden="true"
              />
              {label(s)}
              <span className="font-normal text-fg-muted tabular-nums">
                {totals[s].length}
              </span>
            </h2>
          ))}
          {lanes.map((lane) => {
            const cells = byStatus(lane.posts);
            return (
              <div key={lane.id} className="contents">
                {lanesOn && (
                  <h3 className="col-span-full mt-2 flex items-center gap-1.5 border-t border-line px-1 pt-2 text-xs font-semibold">
                    {lane.label}
                    <span className="font-normal text-fg-muted tabular-nums">
                      {lane.posts.length}
                    </span>
                  </h3>
                )}
                {BOARD_STATUSES.map((s) => (
                  <BoardCell
                    key={s}
                    laneId={lane.id}
                    status={s}
                    label={lanesOn ? `${lane.label} · ${label(s)}` : label(s)}
                    count={cells[s].length}
                    showCount={lanesOn}
                  >
                    {cells[s].map((p) => (
                      <BoardCard
                        key={p.id}
                        post={p}
                        today={today}
                        pending={pendingIds.has(p.id)}
                        onOpen={onOpen}
                        suppressClick={suppressClick}
                      />
                    ))}
                  </BoardCell>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <DragOverlay>
        {active && (
          <div className={cn(cardClass, "cursor-grabbing shadow-lg")}>
            <BoardCardBody post={active} today={today} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
