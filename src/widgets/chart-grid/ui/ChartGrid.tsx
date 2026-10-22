"use client";

import { History, LayoutGrid, TriangleAlert } from "lucide-react";
import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { itemSizeFor } from "@/entities/chart/lib/grid-layout";
import { drawsLegend } from "@/entities/chart/model/chart-kinds";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useAutoResize } from "@/features/auto-resize/model/use-auto-resize";
import { useJob, useJobProgress } from "@/shared/api/queries";
import { isTerminal } from "@/shared/api/types";
import { showAlert } from "@/shared/ui/AlertDialog";
import { EmptyState, Spinner } from "@/shared/ui/Loading";
import styles from "@/shared/ui/workspace.module.css";
import { ChartItemCard } from "./ChartItemCard";
import { DetailView } from "./DetailView";
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
  const opening = useWorkspace((s) => s.opening);
  const draftGrid = useWorkspace((s) => s.draft.grid);
  const page = useWorkspace((s) => s.page);
  const setPage = useWorkspace((s) => s.setPage);
  const focus = useWorkspace((s) => s.focus);
  const setFocus = useWorkspace((s) => s.setFocus);
  const scroller = useRef<PageScrollerHandle>(null);
  const gridId = useId();
  // 스크롤하는 동안 보이는 페이지. 서버 조회 페이지(page)는 throttle로 뒤따라온다.
  const [viewPage, setViewPage] = useState(page);
  // page는 zustand store 값이라 transition으로 감쌀 수 없어(외부 store 갱신은 항상 동기),
  // 조회와 item 렌더는 deferred 값으로 해 스크롤바 조작보다 뒤로 미룬다.
  const deferredPage = useDeferredValue(page);
  const moving = viewPage !== deferredPage;
  const grid = current?.spec.grid ?? { rows: 1, cols: 1 };
  const pageSize = grid.rows * grid.cols;
  const job = useJob(current?.jobId, deferredPage, pageSize);
  // 하단 진행률과 job 종료 여부는 job 전체 long polling으로 받는다.
  const progress = useJobProgress(current?.jobId);
  const totalItems = progress.data?.totalItems ?? job.data?.totalItems ?? null;
  const totalPages =
    totalItems === null ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const jobError = progress.data?.error;
  const gridArea = useWorkspace((s) => s.gridArea);
  // PNG를 띄울 크기. resize 중에는 이 크기로 기존 PNG를 늘리거나 줄여 보여준다.
  const displaySize = gridArea ? itemSizeFor(gridArea, grid) : undefined;
  const detailOpen = focus !== null && totalItems !== null;
  // 크게 보는 동안에는 grid가 보이지 않으니 grid item을 새 크기로 다시 그리지 않는다. 돌아오면 맞춘다.
  useAutoResize(
    current?.chartId,
    job.data,
    progress.data?.status,
    detailOpen ? undefined : displaySize,
  );

  // job이 실패 사유를 알려 주면 팝업으로도 알린다.
  useEffect(() => {
    if (jobError) showAlert(jobError);
  }, [jobError]);

  const goToPage = (next: number) => {
    const p = Math.min(totalPages - 1, Math.max(0, next));
    setViewPage(p);
    setPage(p);
  };

  // grid로 돌아오면 크게 보던 item이 있는 페이지를 보여준다.
  const closeDetail = () => {
    if (focus !== null) goToPage(Math.floor(focus / pageSize));
    setFocus(null);
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
      {!current &&
        (opening ? (
          // history·공유 링크의 차트를 여는 중: 그 grid 모양대로 자리를 잡아 둔다.
          <div
            className={styles.grid}
            data-rows={draftGrid.rows}
            data-cols={draftGrid.cols}
            aria-busy="true"
          >
            {Array.from({ length: draftGrid.rows * draftGrid.cols }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 여는 동안의 자리 표시용
              <ChartItemCard key={i} placeholder="차트 여는 중" />
            ))}
          </div>
        ) : readOnly ? (
          <EmptyState icon={<History size={20} />} title="다시 볼 차트 고르기">
            왼쪽 목록에서 차트를 고르면 저장된 설정과 확대·도형·색 그대로 다시
            그립니다.
          </EmptyState>
        ) : (
          <EmptyState
            icon={<LayoutGrid size={20} />}
            title="아직 그린 차트가 없습니다"
          >
            왼쪽에서 데이터와 x, y를 고르고 draw를 누르세요. split by를 고르면
            조합마다 item 하나씩 grid로 그립니다.
          </EmptyState>
        ))}
      {current && (
        <>
          {detailOpen ? (
            <DetailView
              current={current}
              focus={focus}
              totalItems={totalItems}
              onClose={closeDetail}
            />
          ) : (
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
                {job.data?.items.map((item, i) => (
                  <ChartItemCard
                    key={item.key}
                    item={item}
                    onDoubleClick={() =>
                      setFocus(job.data.page * job.data.pageSize + i)
                    }
                    chartId={current.chartId}
                    primaryJobId={current.jobId}
                    hasLegend={drawsLegend(current.spec)}
                    displaySize={displaySize}
                    tooltipColumns={current.spec.tooltip}
                  />
                ))}
                {/* 첫 응답 전이거나 item 목록이 정해지기 전에는 그 grid 모양대로 자리를 잡아 둔다. */}
                {(!job.data ||
                  (job.data.totalItems === null &&
                    !isTerminal(job.data.status))) &&
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
                {/* item 목록이 정해지기 전에 실패하면(지운 데이터, 스키마 오류 등) 빈 grid 대신 사유를 보여준다. */}
                {job.data?.status === "failed" &&
                  job.data.totalItems === null && (
                    <div className={styles.gridMessage}>
                      <EmptyState
                        icon={<TriangleAlert size={20} />}
                        title="그리지 못했습니다"
                      >
                        {jobError ?? "다시 draw를 눌러 보세요."}
                      </EmptyState>
                    </div>
                  )}
                {moving && (
                  <div className={styles.pageMoving} aria-live="polite">
                    <Spinner />
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
          )}
          <div className={styles.footer}>
            {job.error ? (
              <span role="alert" className={styles.error}>
                {job.error.message}
              </span>
            ) : (
              progress.data && <JobStatusBar job={progress.data} />
            )}
            {!detailOpen && (
              <Pager
                page={viewPage}
                totalPages={totalPages}
                onPage={goToPage}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
