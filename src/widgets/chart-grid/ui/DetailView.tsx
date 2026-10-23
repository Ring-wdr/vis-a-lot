"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  detailSizeFor,
  thumbnailCountFor,
} from "@/entities/chart/lib/grid-layout";
import { drawsLegend } from "@/entities/chart/model/chart-kinds";
import { ChartImage } from "@/entities/chart/ui/ChartImage";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import type { DrawnChart } from "@/entities/workspace/model/workspace-store";
import { useItemDetail } from "@/features/item-detail/model/use-item-detail";
import { useJobRange } from "@/shared/api/queries";
import { type ItemState, isTerminal } from "@/shared/api/types";
import { useCallbackRef } from "@/shared/lib/use-callback-ref";
import { useDebounced } from "@/shared/lib/use-debounced";
import { useElementSize } from "@/shared/lib/use-element-size";
import { Spinner } from "@/shared/ui/Loading";
import { windowStart } from "../lib/thumbnail-window";
import { ChartItemCard } from "./ChartItemCard";

const RESIZE_DEBOUNCE_MS = 300;

const THUMB_STATUS: Record<ItemState["status"], string> = {
  queued: "대기 중",
  running: "그리는 중",
  success: "",
  failed: "실패",
  cancelled: "취소됨",
};

/** 다른 입력이 키를 쓰는 중이면(입력창, 팝업, 대화상자) 크게 보기 단축키를 쓰지 않는다. */
function keyTaken(e: KeyboardEvent) {
  const target = e.target as Element | null;
  if (target?.closest("input, textarea, select, [role='dialog']")) return true;
  return document.querySelector(":popover-open") !== null;
}

/**
 * 크게 보기. 위에는 item 하나를 영역 크기로 그린 PNG로 보여주고,
 * 아래에는 고정 크기 섬네일을 폭에 들어가는 만큼 늘어놓는다.
 * 브라우저 크기가 바뀌면 보이는 item 한 장만 그 크기로 다시 받는다 (서버가 크기별로 캐시한다).
 */

const navButton =
  "inline-grid w-7 flex-none cursor-pointer place-items-center self-stretch rounded-md border border-line bg-elevated text-fg-secondary disabled:cursor-not-allowed disabled:opacity-40";

export function DetailView({
  current,
  focus,
  totalItems,
  onClose,
}: {
  current: DrawnChart;
  /** 크게 보는 item의 전체 순번 */
  focus: number;
  totalItems: number;
  onClose: () => void;
}) {
  const setFocus = useWorkspace((s) => s.setFocus);
  const itemJobs = useWorkspace((s) => s.itemJobs);
  const [mainRef, mainArea] = useElementSize<HTMLDivElement>();
  const [listRef, listArea] = useElementSize<HTMLOListElement>();

  // 크게 보는 item을 가운데 두고 한 칸씩 미끄러진다. 처음·끝에서는 목록을 꽉 채운 채 멈춘다.
  const count = listArea ? thumbnailCountFor(listArea.width) : 1;
  const start = windowStart(focus, count, totalItems);
  const strip = useJobRange(current.jobId, start, count);
  const offset = strip.data?.offset ?? 0;
  const thumbs = strip.data?.items ?? [];
  const item = thumbs[focus - offset];

  const displaySize = useMemo(
    () => (mainArea ? detailSizeFor(mainArea) : undefined),
    [mainArea],
  );
  // 크기를 바꾸는 동안에는 지금 PNG를 늘려 보여주고, 멈추면 그 크기로 한 장만 받는다.
  const requestSize =
    useDebounced(displaySize, RESIZE_DEBOUNCE_MS) ?? displaySize;
  const busy = item !== undefined && itemJobs[item.key] !== undefined;
  const detail = useItemDetail(current.chartId, item, requestSize, !busy);

  const last = Math.max(0, totalItems - 1);
  const go = (index: number) => setFocus(Math.min(last, Math.max(0, index)));

  // ←/→로 한 item씩, Home/End로 처음·끝, Esc로 grid로 돌아간다.
  const onKey = useCallbackRef((e: KeyboardEvent) => {
    if (e.defaultPrevented || keyTaken(e)) return;
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowLeft") go(focus - 1);
    else if (e.key === "ArrowRight") go(focus + 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(last);
    else return;
    e.preventDefault();
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    // 크게 보기: 위에 item 하나, 아래에 섬네일 목록
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* 이 영역 크기가 곧 크게 보기 PNG 크기다 (grid-layout.ts의 detailSizeFor). */}
      <div ref={mainRef} className="flex min-h-0 flex-1">
        {item ? (
          <ChartItemCard
            key={item.key}
            item={item}
            chartId={current.chartId}
            primaryJobId={current.jobId}
            hasLegend={drawsLegend(current.spec)}
            displaySize={displaySize}
            tooltipColumns={current.spec.tooltip}
            image={detail.image}
            rendering={detail.rendering}
            expanded
            onDoubleClick={onClose}
          />
        ) : (
          <ChartItemCard placeholder="불러오는 중" />
        )}
      </div>
      <nav
        className="flex flex-none items-center gap-1.5"
        aria-label="item 이동"
      >
        <button
          type="button"
          className={navButton}
          title="처음 item"
          aria-label="처음 item"
          disabled={focus === 0}
          onClick={() => go(0)}
        >
          <ChevronsLeft size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={navButton}
          title="이전 item"
          aria-label="이전 item"
          disabled={focus === 0}
          onClick={() => go(focus - 1)}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        {/* gap은 grid-layout.ts의 THUMBNAIL_GAP과 같아야 섬네일 개수 계산이 맞는다. */}
        <ol ref={listRef} className="flex min-w-0 flex-1 gap-2 overflow-hidden">
          {thumbs.map((thumb, i) => {
            const index = offset + i;
            return (
              <li key={thumb.key}>
                <button
                  type="button"
                  // 폭은 섬네일 PNG 폭(THUMBNAIL_WIDTH)에 테두리 2px을 더한 값이다.
                  className="flex w-32.5 cursor-pointer flex-col overflow-hidden rounded-sm border border-line bg-elevated text-fg-secondary hover:border-accent-line aria-current:border-accent aria-current:ring-1 aria-current:ring-accent"
                  aria-current={index === focus}
                  title={thumb.label}
                  onClick={() => go(index)}
                >
                  {thumb.thumbnail ? (
                    <ChartImage data={thumb.thumbnail} alt="" />
                  ) : (
                    // 섬네일이 아직 없을 때 같은 비율로 자리를 잡아 목록 높이가 바뀌지 않게 한다.
                    <span className="flex aspect-[128/80] w-full items-center justify-center gap-1.5 bg-panel text-2xs text-fg-muted">
                      {!isTerminal(thumb.status) && <Spinner size="sm" />}
                      {THUMB_STATUS[thumb.status]}
                    </span>
                  )}
                  <span className="truncate px-1.5 py-0.5 text-left text-2xs">
                    {thumb.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className={navButton}
          title="다음 item"
          aria-label="다음 item"
          disabled={focus >= last}
          onClick={() => go(focus + 1)}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={navButton}
          title="마지막 item"
          aria-label="마지막 item"
          disabled={focus >= last}
          onClick={() => go(last)}
        >
          <ChevronsRight size={14} aria-hidden="true" />
        </button>
        <span className="min-w-[13ch] flex-none text-right text-xs text-fg-secondary tabular-nums">
          {(focus + 1).toLocaleString()} / {totalItems.toLocaleString()}
        </span>
      </nav>
    </div>
  );
}
