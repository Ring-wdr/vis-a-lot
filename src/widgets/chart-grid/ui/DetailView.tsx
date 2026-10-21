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
import { ChartImage } from "@/entities/chart/ui/ChartImage";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import type { DrawnChart } from "@/entities/workspace/model/workspace-store";
import { useItemDetail } from "@/features/item-detail/model/use-item-detail";
import { useJob } from "@/shared/api/queries";
import type { ItemState } from "@/shared/api/types";
import { useCallbackRef } from "@/shared/lib/use-callback-ref";
import { useDebounced } from "@/shared/lib/use-debounced";
import { useElementSize } from "@/shared/lib/use-element-size";
import styles from "@/shared/ui/workspace.module.css";
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

  // 섬네일 수만큼 끊어 한 묶음씩 받는다. 넘어가면 다음 묶음을 받는다.
  const count = listArea ? thumbnailCountFor(listArea.width) : 1;
  const stripPage = Math.floor(focus / count);
  const strip = useJob(current.jobId, stripPage, count, {
    keepPrevious: true,
  });
  const offset = strip.data ? strip.data.page * strip.data.pageSize : 0;
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
    <div className={styles.detail}>
      <div ref={mainRef} className={styles.detailMain}>
        {item ? (
          <ChartItemCard
            key={item.key}
            item={item}
            chartId={current.chartId}
            primaryJobId={current.jobId}
            hasLegend={current.spec.legend !== null}
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
      <nav className={styles.thumbNav} aria-label="item 이동">
        <button
          type="button"
          title="처음 item"
          aria-label="처음 item"
          disabled={focus === 0}
          onClick={() => go(0)}
        >
          <ChevronsLeft size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title="이전 item"
          aria-label="이전 item"
          disabled={focus === 0}
          onClick={() => go(focus - 1)}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <ol ref={listRef} className={styles.thumbList}>
          {thumbs.map((thumb, i) => {
            const index = offset + i;
            return (
              <li key={thumb.key}>
                <button
                  type="button"
                  className={styles.thumb}
                  aria-current={index === focus}
                  title={thumb.label}
                  onClick={() => go(index)}
                >
                  {thumb.thumbnail ? (
                    <ChartImage data={thumb.thumbnail} alt="" />
                  ) : (
                    <span className={styles.thumbEmpty}>
                      {THUMB_STATUS[thumb.status]}
                    </span>
                  )}
                  <span className={styles.thumbLabel}>{thumb.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          title="다음 item"
          aria-label="다음 item"
          disabled={focus >= last}
          onClick={() => go(focus + 1)}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title="마지막 item"
          aria-label="마지막 item"
          disabled={focus >= last}
          onClick={() => go(last)}
        >
          <ChevronsRight size={14} aria-hidden="true" />
        </button>
        <span className={styles.thumbCount}>
          {(focus + 1).toLocaleString()} / {totalItems.toLocaleString()}
        </span>
      </nav>
    </div>
  );
}
