"use client";

import { isTerminal, type JobStateResponse } from "@server/api/types";
import { useEffect, useRef } from "react";
import {
  GRID_FOOTER_HEIGHT,
  GRID_GAP,
  itemSizeFor,
} from "@/entities/chart/lib/grid-layout";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useAutoResize } from "@/features/auto-resize/model/use-auto-resize";
import { useJob, useJobProgress } from "@/shared/api/queries";
import { showAlert } from "@/shared/ui/AlertDialog";
import styles from "@/shared/ui/workspace.module.css";
import { ChartItemCard } from "./ChartItemCard";

const STATUS_SUFFIX: Partial<Record<JobStateResponse["status"], string>> = {
  success: " · 완료",
  failed: " · 일부 실패",
  cancelled: " · 취소됨",
};

const WHEEL_THRESHOLD = 20;
const WHEEL_COOLDOWN_MS = 350;

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
      <span>
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

function JobStatusText({ job }: { job: JobStateResponse | undefined }) {
  if (!job) return null;
  const { phase, progress, status } = job;
  if (job.error) {
    return (
      <span role="alert" className={styles.error}>
        {job.error}
      </span>
    );
  }
  // init 단계에서는 spinner만 보여주고, 생성 진행률은 왼쪽 데이터 패널이 보여준다.
  if (phase === "dataset" || phase === "query") {
    return (
      <>
        {!isTerminal(status) && (
          <span className={styles.spinner} aria-hidden="true" />
        )}
        <span>
          {phase === "dataset" ? "데이터 준비 중" : "데이터 조회 중"}
          {STATUS_SUFFIX[status]}
        </span>
      </>
    );
  }
  return (
    <>
      <progress value={progress.done} max={progress.total || 1} />
      <span>
        {progress.done.toLocaleString()} / {progress.total.toLocaleString()}{" "}
        item
        {STATUS_SUFFIX[status]}
      </span>
    </>
  );
}

export function ChartGrid() {
  const areaRef = useRef<HTMLDivElement>(null);
  const setGridArea = useWorkspace((s) => s.setGridArea);
  const current = useWorkspace((s) => s.current);
  const readOnly = useWorkspace((s) => s.readOnly);
  const page = useWorkspace((s) => s.page);
  const setPage = useWorkspace((s) => s.setPage);
  const lastWheel = useRef(0);
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
    setPage(Math.min(totalPages - 1, Math.max(0, next)));
  };

  // 스크롤 한 번에 한 페이지씩 넘긴다. 페이지 이동은 렌더 job에 영향을 주지 않는다.
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < WHEEL_THRESHOLD || totalPages <= 1) return;
    const now = performance.now();
    if (now - lastWheel.current < WHEEL_COOLDOWN_MS) return;
    lastWheel.current = now;
    goToPage(page + (e.deltaY > 0 ? 1 : -1));
  };

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
          <div
            className={styles.grid}
            onWheel={onWheel}
            style={{
              gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
              gap: GRID_GAP,
              height: `calc(100% - ${GRID_FOOTER_HEIGHT}px)`,
            }}
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
          </div>
          <div className={styles.footer}>
            {job.error ? (
              <span role="alert" className={styles.error}>
                {job.error.message}
              </span>
            ) : (
              <JobStatusText job={progress.data} />
            )}
            <Pager page={page} totalPages={totalPages} onPage={goToPage} />
          </div>
        </>
      )}
    </div>
  );
}
