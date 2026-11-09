"use client";

// 게시물 넘겨 보기: 보고서의 게시물을 하나씩 큰 카드로 보여준다. 이전/다음 버튼, ←/→ 키, Esc로 보고서로 돌아간다.

import { Trans, useLingui } from "@lingui/react/macro";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  PanelRightOpen,
} from "lucide-react";
import { useEffect } from "react";
import { eventSentence, isSystemEvent } from "@/entities/post/lib/event-text";
import {
  DueLabel,
  PriorityMark,
  StatusBadge,
  Thumb,
  UserChip,
  useToday,
  useUserName,
} from "@/entities/post/ui/post-meta";
import { usePresentNav } from "@/features/present-mode/model/present-nav";
import { useGroupMap } from "@/shared/api/feed/lookups";
import { usePost, usePostEvents } from "@/shared/api/feed/post-queries";

import { useOpenPeek, usePeekKey } from "@/shared/lib/peek";
import { relativeTime } from "@/shared/lib/time";
import { button } from "@/shared/ui/button";
import { EmptyState, LoadingText, Skeleton } from "@/shared/ui/Loading";
import "../config/messages";

export type DeckItem = {
  key: string;
  /** 이 게시물이 보고서에 들어간 이유 (해결·생성 등) */
  note?: string;
};

const typing = (target: EventTarget | null) =>
  !!(target as HTMLElement | null)?.closest(
    "input, textarea, select, [contenteditable='true']",
  );

export function PresentDeck({
  items,
  title,
}: {
  items: DeckItem[];
  /** 보고서 이름 (머리 줄에 작게) */
  title: string;
}) {
  const { t } = useLingui();
  const { slide, openSlide, closeSlides } = usePresentNav();
  const peek = usePeekKey();
  const index = Math.min(slide ?? 0, Math.max(items.length - 1, 0));
  const item = items[index];
  const last = items.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      // 옆 패널이 열려 있으면 Esc는 패널이 받는다
      if (peek) return;
      if ((e.key === "ArrowRight" || e.key === "PageDown") && index < last) {
        e.preventDefault();
        openSlide(index + 1);
      } else if ((e.key === "ArrowLeft" || e.key === "PageUp") && index > 0) {
        e.preventDefault();
        openSlide(index - 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeSlides();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, last, peek, openSlide, closeSlides]);

  return (
    <div className="mx-auto flex w-full max-w-280 flex-col gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button()} onClick={closeSlides}>
          <ArrowLeft size={16} aria-hidden="true" />
          <Trans>보고서로 돌아가기</Trans>
        </button>
        <span className="truncate text-sm text-fg-muted">{title}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={button()}
            disabled={index <= 0}
            aria-keyshortcuts="ArrowLeft"
            onClick={() => openSlide(index - 1)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            <Trans context="slide navigation">이전</Trans>
          </button>
          <span
            className="min-w-16 text-center font-semibold tabular-nums"
            aria-live="polite"
          >
            {items.length ? `${index + 1} / ${items.length}` : "0 / 0"}
          </span>
          <button
            type="button"
            className={button()}
            disabled={index >= last}
            aria-keyshortcuts="ArrowRight"
            onClick={() => openSlide(index + 1)}
          >
            <Trans context="slide navigation">다음</Trans>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      {item ? (
        <SlideCard key={item.key} item={item} />
      ) : (
        <EmptyState
          icon={<FileQuestion size={20} />}
          title={t`넘겨 볼 게시물이 없습니다`}
        >
          <p>
            <Trans>보고서 조건을 넓혀 보세요.</Trans>
          </p>
        </EmptyState>
      )}
    </div>
  );
}

/** 큰 요약 카드: 썸네일, 키·제목, 상태, 담당자, 기한, 진행률, 최근 활동 */
function SlideCard({ item }: { item: DeckItem }) {
  const { t } = useLingui();
  const key = item.key;
  const post = usePost(item.key);
  const events = usePostEvents(item.key);
  const groups = useGroupMap();
  const userName = useUserName();
  const today = useToday();
  const openPeek = useOpenPeek();

  if (post.isPending)
    return (
      <div
        className="flex flex-col gap-4 rounded-xl border border-line bg-elevated p-6"
        aria-busy="true"
      >
        <LoadingText>
          {t({
            message: `${key} 불러오는 중`,
            comment: "key: 게시물 키 (FD-12)",
          })}
        </LoadingText>
        <Skeleton width={70} className="h-6" />
        <Skeleton width={90} />
        <Skeleton width={50} />
      </div>
    );
  if (post.isError)
    return (
      <EmptyState
        icon={<FileQuestion size={20} />}
        title={t({
          message: `${key}를 불러오지 못했습니다`,
          comment: "key: 게시물 키 (FD-12)",
        })}
      >
        <p>{post.error.message}</p>
      </EmptyState>
    );

  const p = post.data;
  const statusNames = groups.get(p.groupId)?.statusNames;
  const latest = events.data?.filter((e) => !isSystemEvent(e)).at(-1);

  return (
    <article
      className="grid gap-6 rounded-xl border border-line bg-elevated p-5 shadow-card md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:p-8"
      aria-label={`${p.key} ${p.title}`}
    >
      <Thumb
        post={p}
        className="aspect-video w-full rounded-lg border border-line"
      />
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-fg-muted">{p.key}</span>
          <StatusBadge status={p.status} groupId={p.groupId} />
          {item.note && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
              {item.note}
            </span>
          )}
        </div>
        <h2 className="text-xl font-bold break-keep">{p.title}</h2>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 text-base">
          <dt className="text-fg-muted">
            <Trans context="post field">담당자</Trans>
          </dt>
          <dd>
            <UserChip userId={p.assigneeId} />
          </dd>
          <dt className="text-fg-muted">
            <Trans context="post field">기한</Trans>
          </dt>
          <dd>
            {p.dueDate ? (
              <span className="inline-flex items-center gap-2">
                <DueLabel post={p} today={today} />
                <span className="text-xs text-fg-muted">{p.dueDate}</span>
              </span>
            ) : (
              <span className="text-fg-muted">
                <Trans context="no due date">없음</Trans>
              </span>
            )}
          </dd>
          <dt className="text-fg-muted">
            <Trans context="post field">우선순위</Trans>
          </dt>
          <dd>
            <PriorityMark priority={p.priority} showLabel />
          </dd>
          <dt className="text-fg-muted">
            <Trans context="post field">진행률</Trans>
          </dt>
          <dd className="flex items-center gap-3">
            <span
              className="h-2.5 w-full max-w-60 overflow-hidden rounded-full bg-panel-strong"
              role="progressbar"
              aria-valuenow={p.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t({ message: "진행률", context: "post field" })}
            >
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${p.progress}%` }}
              />
            </span>
            <span className="tabular-nums">{p.progress}%</span>
          </dd>
        </dl>
        <div className="rounded-lg bg-panel p-3">
          <p className="text-xs font-semibold text-fg-muted">
            <Trans>최근 활동</Trans>
          </p>
          {latest ? (
            <p className="mt-1 text-base">
              {eventSentence(latest, {
                userName: (id) =>
                  id
                    ? userName(id)
                    : t({ message: "누군가", comment: "이름을 모르는 행위자" }),
                statusNames,
              })}
              <span className="ml-2 text-xs text-fg-muted">
                {relativeTime(latest.createdAt)}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-fg-muted">
              {events.isPending ? t`불러오는 중` : t`활동이 없습니다`}
            </p>
          )}
        </div>
        <button
          type="button"
          className={button({ size: "sm", class: "self-start" })}
          onClick={() => openPeek(p.key)}
        >
          <PanelRightOpen size={14} aria-hidden="true" />
          <Trans>자세히 보기</Trans>
        </button>
      </div>
    </article>
  );
}
