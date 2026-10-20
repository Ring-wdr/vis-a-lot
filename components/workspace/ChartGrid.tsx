"use client";

import { useEffect, useRef } from "react";
import { GRID_FOOTER_HEIGHT, GRID_GAP } from "@/lib/grid-layout";
import { useJob } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace-store";
import type { JobStateResponse } from "@/server/api/types";
import { ChartItemCard } from "./ChartItemCard";
import styles from "./Workspace.module.css";

function JobFooter({ job }: { job: JobStateResponse | undefined }) {
  if (!job) return null;
  const { phase, progress, status } = job;
  const label =
    phase === "dataset"
      ? `데이터 준비 중 ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}`
      : phase === "query"
        ? "데이터 조회 중"
        : `${progress.done.toLocaleString()} / ${progress.total.toLocaleString()} item`;
  return (
    <div className={styles.footer}>
      <progress
        value={phase === "query" ? undefined : progress.done}
        max={progress.total || 1}
      />
      <span>
        {label}
        {status === "success" && " · 완료"}
        {status === "failed" && " · 일부 실패"}
      </span>
    </div>
  );
}

export function ChartGrid() {
  const areaRef = useRef<HTMLDivElement>(null);
  const setGridArea = useWorkspace((s) => s.setGridArea);
  const current = useWorkspace((s) => s.current);
  const page = useWorkspace((s) => s.page);
  const grid = current?.spec.grid ?? { rows: 1, cols: 1 };
  const pageSize = grid.rows * grid.cols;
  const job = useJob(current?.jobId, page, pageSize);

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
        <p className={styles.empty}>왼쪽에서 설정을 고르고 draw를 누르세요.</p>
      )}
      {current && (
        <>
          <div
            className={styles.grid}
            style={{
              gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
              gap: GRID_GAP,
              height: `calc(100% - ${GRID_FOOTER_HEIGHT}px)`,
            }}
          >
            {job.data?.items.map((item) => (
              <ChartItemCard key={item.key} item={item} />
            ))}
            {job.data?.totalItems === null &&
              Array.from({ length: pageSize }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 조회 전 자리 표시용
                <ChartItemCard key={i} />
              ))}
          </div>
          {job.error && <p role="alert">{job.error.message}</p>}
          <JobFooter job={job.data} />
        </>
      )}
    </div>
  );
}
