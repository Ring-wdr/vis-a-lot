"use client";

import { useEffect, useId, useRef, useState } from "react";
import { itemSizeFor } from "@/entities/chart/lib/grid-layout";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useAutoResize } from "@/features/auto-resize/model/use-auto-resize";
import { useJob, useJobProgress } from "@/shared/api/queries";
import { isTerminal } from "@/shared/api/types";
import { showAlert } from "@/shared/ui/AlertDialog";
import styles from "@/shared/ui/workspace.module.css";
import { ChartItemCard } from "./ChartItemCard";
import { JobStatusBar } from "./JobStatusBar";
import { PageScroller, type PageScrollerHandle } from "./PageScroller";

function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className={styles.pager} aria-label="페이지">
      <button
        type="button"
        aria-label="이전 페이지"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        ‹
      </button>
      <span className={styles.pagerText}>
        {page + 1} / {totalPages}
      </span>
      <button
        type="button"
        aria-label="다음 페이지"
        disabled={page >= totalPages - 1}
        onClick={() => onPage(page + 1)}
      >
        ›
      </button>
    </nav>
  );
}

export function ChartGrid() {
  const areaRef = useRef<HTMLDivElement>(null);
  const setGridArea = useWorkspace((s) => s.setGridArea);
  const current = useWorkspace((s) => s.current);
  const readOnly = useWorkspace((s) => s.readOnly);
  const page = useWorkspace((s) => s.page);
  const setPage = useWorkspace((s) => s.setPage);
  const scroller = useRef<PageScrollerHandle>(null);
  const gridId = useId();
  // 스크롤하는 동안 보이는 페이지. 서버 조회 페이지(page)는 throttle로 뒤따라온다.
  const [viewPage, setViewPage] = useState(page);
  const moving = viewPage !== page;
  const grid = current?.spec.grid ?? { rows: 1, cols: 1 };
  const pageSize = grid.rows * grid.cols;
  const job = useJob(current?.jobId, page, pageSize);
  // 하단 진행률과 job 종료 여부는 job 전체 long polling으로 받는다.
  const progress = useJobProgress(current?.jobId);
  const totalItems = progress.data?.totalItems ?? job.data?.totalItems ?? null;
  const totalPages =
    totalItems === null ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const jobError = progress.data?.error;
  const gridArea = useWorkspace((s) => s.gridArea);
  // PNG를 띄울 크기. resize 중에는 이 크기로 기존 PNG를 늘리거나 줄여 보여준다.
  const displaySize = gridArea ? itemSizeFor(gridArea, grid) : undefined;
  useAutoResize(current?.chartId, job.data, progress.data?.status, displaySize);

  // job이 실패 사유를 알려 주면 팝업으로도 알린다.
  useEffect(() => {
    if (jobError) showAlert(jobError);
  }, [jobError]);

  const goToPage = (next: number) => {
    const p = Math.min(totalPages - 1, Math.max(0, next));
    setViewPage(p);
    setPage(p);
  };

  // 페이지가 밖에서 바뀌면(grid 변경 등) 보이는 페이지도 맞춘다.
  useEffect(() => setViewPage(page), [page]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setGridArea({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [setGridArea]);

  return (
    <div ref={areaRef} className={styles.gridArea}>
      {!current && (
        <p className={styles.empty}>
          {readOnly
            ? "왼쪽 목록에서 다시 볼 차트를 고르세요."
            : "왼쪽에서 설정을 고르고 draw를 누르세요."}
        </p>
      )}
      {current && (
        <>
          <div className={styles.gridRow}>
            <div
              id={gridId}
              className={styles.grid}
              // 페이지 이동은 오른쪽 스크롤바가 맡는다. grid 위의 휠도 그쪽으로 넘긴다.
              onWheel={(e) => scroller.current?.wheel(e.deltaY)}
              // 행·열 수는 CSS가 data 속성으로 고른다 (1..10).
              data-rows={grid.rows}
              data-cols={grid.cols}
            >
              {job.data?.items.map((item) => (
                <ChartItemCard
                  key={item.key}
                  item={item}
                  chartId={current.chartId}
                  primaryJobId={current.jobId}
                  hasLegend={current.spec.legend !== null}
                  displaySize={displaySize}
                  tooltipColumns={current.spec.tooltip}
                />
              ))}
              {job.data?.totalItems === null &&
                !isTerminal(job.data.status) &&
                Array.from({ length: pageSize }, (_, i) => (
                  <ChartItemCard
                    // biome-ignore lint/suspicious/noArrayIndexKey: 조회 전 자리 표시용
                    key={i}
                    placeholder={
                      job.data?.phase === "dataset"
                        ? "데이터 준비 중"
                        : "데이터 조회"
                    }
                  />
                ))}
              {moving && (
                <div className={styles.pageMoving} aria-live="polite">
                  {(viewPage + 1).toLocaleString()} /{" "}
                  {totalPages.toLocaleString()} 페이지로 이동 중…
                </div>
              )}
            </div>
            <PageScroller
              ref={scroller}
              controls={gridId}
              viewPage={viewPage}
              totalPages={totalPages}
              onPage={setPage}
              onViewPage={setViewPage}
            />
          </div>
          <div className={styles.footer}>
            {job.error ? (
              <span role="alert" className={styles.error}>
                {job.error.message}
              </span>
            ) : (
              progress.data && <JobStatusBar job={progress.data} />
            )}
            <Pager page={viewPage} totalPages={totalPages} onPage={goToPage} />
          </div>
        </>
      )}
    </div>
  );
}
