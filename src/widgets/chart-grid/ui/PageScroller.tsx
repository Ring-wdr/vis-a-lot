"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type Ref,
  startTransition,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { throttle } from "@/shared/lib/throttle";
import { tv } from "@/shared/lib/tw";
import { useCallbackRef } from "@/shared/lib/use-callback-ref";
import {
  clampPage,
  createWheelAccumulator,
  pageAt,
  thumbSize,
  thumbTop,
} from "../lib/page-scroll";

// 화살표 모양은 ::after 테두리로 그린 작은 삼각형
const arrow = tv({
  base: "relative aspect-square w-full flex-none cursor-default bg-panel text-fg-secondary after:absolute after:inset-0 after:m-auto after:size-0 after:border-x-4 after:border-x-transparent after:content-[''] enabled:hover:bg-panel-strong enabled:hover:text-fg enabled:active:bg-panel-active disabled:text-fg-muted/50",
  variants: {
    dir: {
      up: "after:border-b-4 after:border-b-current",
      down: "after:border-t-4 after:border-t-current",
    },
  },
});

/** 서버에서 페이지를 받아오는 간격. 빠르게 넘겨도 이 간격으로만 조회한다. */
const FETCH_THROTTLE_MS = 200;
/** 화살표·트랙을 누르고 있으면 이만큼 기다린 뒤 */
const REPEAT_DELAY_MS = 350;
/** 이 간격으로 계속 넘긴다 (Windows 스크롤바와 같은 감각) */
const REPEAT_INTERVAL_MS = 60;

export type PageScrollerHandle = {
  /** grid 위에서 굴린 휠을 이 스크롤바로 넘긴다. */
  wheel: (deltaY: number) => void;
};

/**
 * grid 오른쪽의 페이지 스크롤바. 네이티브 스크롤 대신 위/아래 화살표, 트랙, thumb을 직접 그린다.
 * thumb의 한 칸이 곧 한 페이지다.
 *
 * - 화살표: 한 페이지. 누르고 있으면 잠시 뒤부터 계속 넘긴다.
 * - 트랙: 누른 쪽으로 한 페이지씩, thumb이 포인터에 닿을 때까지 계속 넘긴다.
 * - thumb 끌기: 포인터를 따라가고, 놓으면 페이지 위치에 맞춘다.
 * - 휠: 굴린 양을 모아 일정량마다 한 페이지. 키보드: ↑↓, PageUp/PageDown, Home/End.
 *
 * thumb 위치는 이 컴포넌트의 state로 바로 옮기고, 페이지가 바뀌어 grid를 다시 그리는 일
 * (onViewPage)은 transition으로 미뤄 grid 렌더가 무거워도 thumb이 끊기지 않게 한다.
 * 서버 조회 페이지(onPage)는 throttle로만 바꿔 한 번에 많이 넘겨도 조회가 몇 번만 일어나게 한다.
 */
export function PageScroller({
  ref,
  controls,
  viewPage,
  totalPages,
  onPage,
  onViewPage,
}: {
  ref?: Ref<PageScrollerHandle>;
  /** 스크롤바가 넘기는 grid의 id */
  controls: string;
  /** 지금 보이는 페이지 */
  viewPage: number;
  totalPages: number;
  onPage: (page: number) => void;
  onViewPage: (page: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [track, setTrack] = useState(0);
  /** thumb을 끄는 동안의 위치. 놓으면 페이지 위치로 돌아간다. */
  const [dragTop, setDragTop] = useState<number | null>(null);
  const dragOffset = useRef(0);
  /** thumb과 화살표가 따르는 페이지. grid보다 먼저(긴급하게) 바뀐다. */
  const [shownPage, setShownPage] = useState(viewPage);
  const current = useRef(shownPage);
  current.current = shownPage;
  // 밖에서 페이지가 바뀌면(이전/다음 버튼, grid 변경) 따라간다.
  useEffect(() => setShownPage(viewPage), [viewPage]);
  const onPageRef = useCallbackRef(onPage);
  const onViewPageRef = useCallbackRef(onViewPage);
  const repeatTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wheelPages = useMemo(() => createWheelAccumulator(), []);

  const fetchPage = useMemo(
    () =>
      throttle(
        (p: number) => startTransition(() => onPageRef(p)),
        FETCH_THROTTLE_MS,
      ),
    [onPageRef],
  );

  const stopRepeat = () => {
    clearTimeout(repeatTimer.current);
    clearInterval(repeatTimer.current);
    repeatTimer.current = undefined;
  };
  useEffect(
    () => () => {
      fetchPage.cancel();
      clearTimeout(repeatTimer.current);
      clearInterval(repeatTimer.current);
    },
    [fetchPage],
  );

  /** 페이지로 옮긴다. 이미 그 페이지면 false (계속 넘기기를 멈추는 신호) */
  const go = (next: number) => {
    const page = clampPage(next, totalPages);
    if (page === current.current) return false;
    current.current = page;
    setShownPage(page);
    startTransition(() => onViewPageRef(page));
    fetchPage(page);
    return true;
  };

  /** 한 번 넘기고, 누르고 있으면 잠시 뒤부터 step이 false를 돌려줄 때까지 계속 넘긴다. */
  const startRepeat = (step: () => boolean) => {
    stopRepeat();
    if (!step()) return;
    repeatTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => {
        if (!step()) stopRepeat();
      }, REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
  };

  useImperativeHandle(ref, () => ({
    wheel: (deltaY) => {
      const pages = wheelPages(deltaY);
      if (pages !== 0) go(current.current + pages);
    },
  }));

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setTrack(entry.contentRect.height),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const disabled = totalPages <= 1;
  const thumb = thumbSize(track, totalPages);
  const top = dragTop ?? thumbTop(track, thumb, shownPage, totalPages);

  /** 누르는 동안 pointer를 잡아 버튼 밖에서 떼도 멈추게 한다. */
  const hold = (e: ReactPointerEvent<HTMLElement>, step: () => boolean) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startRepeat(step);
  };

  const onTrackDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || disabled) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    // 누른 쪽으로 한 페이지씩, thumb이 포인터 위치에 닿으면 멈춘다.
    const target = pageAt(track, thumb, y - thumb / 2, totalPages);
    const dir = y < top ? -1 : 1;
    hold(e, () => {
      const page = current.current;
      if (dir < 0 ? page <= target : page >= target) return false;
      return go(page + dir);
    });
  };

  const onThumbDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = trackRef.current?.getBoundingClientRect();
    dragOffset.current = e.clientY - (rect?.top ?? 0) - top;
    setDragTop(top);
  };

  const onThumbMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragTop === null) return;
    const rect = trackRef.current?.getBoundingClientRect();
    const next = Math.min(
      track - thumb,
      Math.max(0, e.clientY - (rect?.top ?? 0) - dragOffset.current),
    );
    setDragTop(next);
    go(pageAt(track, thumb, next, totalPages));
  };

  const keyStep = Math.max(1, Math.round(totalPages / 10));

  return (
    <div
      // Windows 방식 스크롤바: 위 화살표 · 트랙(+thumb) · 아래 화살표.
      // 폭은 grid-layout.ts의 PAGE_SCROLLER_WIDTH와 같아야 PNG 크기 계산이 맞는다.
      className="flex w-4 flex-none touch-none flex-col rounded-[0.1875rem] border border-line bg-panel outline-none select-none focus-visible:ring-2 focus-visible:ring-accent"
      role="scrollbar"
      aria-controls={controls}
      aria-orientation="vertical"
      aria-label="페이지"
      aria-valuemin={1}
      aria-valuemax={totalPages}
      aria-valuenow={shownPage + 1}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onWheel={(e) => {
        const pages = wheelPages(e.deltaY);
        if (pages !== 0) go(current.current + pages);
      }}
      onKeyDown={(e) => {
        const moves: Record<string, number> = {
          ArrowUp: current.current - 1,
          ArrowDown: current.current + 1,
          PageUp: current.current - keyStep,
          PageDown: current.current + keyStep,
          Home: 0,
          End: totalPages - 1,
        };
        if (!(e.key in moves)) return;
        e.preventDefault();
        go(moves[e.key]);
      }}
    >
      <button
        type="button"
        tabIndex={-1}
        className={arrow({ dir: "up" })}
        aria-label="이전 페이지"
        disabled={disabled || shownPage <= 0}
        onPointerDown={(e) => hold(e, () => go(current.current - 1))}
        onPointerUp={stopRepeat}
        onPointerCancel={stopRepeat}
      />
      <div
        ref={trackRef}
        className="relative min-h-0 flex-1 bg-panel-subtle"
        onPointerDown={onTrackDown}
        onPointerUp={stopRepeat}
        onPointerCancel={stopRepeat}
      >
        {!disabled && (
          <div
            className="absolute inset-x-0.5 top-0 rounded-xs bg-fg-muted/70 not-data-dragging:hover:bg-fg-muted data-dragging:bg-fg-secondary"
            data-dragging={dragTop !== null || undefined}
            // thumb 길이와 위치는 페이지 수와 현재 페이지로 계산한 값이다.
            style={{ height: thumb, transform: `translateY(${top}px)` }}
            onPointerDown={onThumbDown}
            onPointerMove={onThumbMove}
            onPointerUp={() => setDragTop(null)}
            onPointerCancel={() => setDragTop(null)}
          />
        )}
      </div>
      <button
        type="button"
        tabIndex={-1}
        className={arrow({ dir: "down" })}
        aria-label="다음 페이지"
        disabled={disabled || shownPage >= totalPages - 1}
        onPointerDown={(e) => hold(e, () => go(current.current + 1))}
        onPointerUp={stopRepeat}
        onPointerCancel={stopRepeat}
      />
    </div>
  );
}
