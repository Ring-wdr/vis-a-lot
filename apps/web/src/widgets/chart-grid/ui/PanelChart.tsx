"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { useColorScheme } from "@vis-a-lot/shared/lib/color-scheme";
import { ChartNoAxesCombined, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { detailSizeFor } from "@/entities/chart/lib/grid-layout";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useAutoResize } from "@/features/auto-resize/model/use-auto-resize";
import { useJob, useJobProgress } from "@/shared/api/queries";
import {
  type ChartSpec,
  type ItemSize,
  isTerminal,
  type JobStateResponse,
} from "@/shared/api/types";
import { drawsLegend } from "@/shared/config/chart-kinds";
import { usePixelRatio } from "@/shared/lib/pixel-ratio";
import { EmptyState } from "@/shared/ui/Loading";
import "../config/messages";
import { ChartItemCard } from "./ChartItemCard";

/** 칸은 차트 한 장이라 item 하나만 받는다. */
const PAGE_SIZE = 1;

/** 칸이 진행률 응답에서 쓰는 값. 진행률(done·counts)은 빼서, 응답이 와도 이 값이 같으면 다시 그리지 않는다. */
const panelProgress = (job: JobStateResponse) => ({
  status: job.status,
  error: job.error,
});

/**
 * 칸 크기에 맞춰 PNG를 다시 그린다. 다시 그리는 중인 item(itemJobs)을 구독하므로 칸 본문과 떼어 둔다.
 * PNG 크기가 칸과 다를 때만 보낸다(크기·배율·테마). 그리는 중이면 끝난 뒤에 확인한다.
 */
function PanelAutoResize({
  chartId,
  job,
  jobStatus,
  desired,
}: {
  chartId: string;
  job: JobStateResponse | undefined;
  jobStatus: JobStateResponse["status"] | undefined;
  desired: ItemSize | undefined;
}) {
  useAutoResize(chartId, job, jobStatus, desired);
  return null;
}

/** 그린 차트. 칸 크기로 PNG를 띄우고 진행 중이면 단계와 진행률을 보인다. */
function DrawnPanel({
  chartId,
  jobId,
  spec,
  displaySize,
  onOpenInGallery,
}: {
  chartId: string;
  jobId: string;
  spec: ChartSpec;
  displaySize: ItemSize | undefined;
  onOpenInGallery: (spec: ChartSpec) => void;
}) {
  const { t } = useLingui();
  const job = useJob(jobId, 0, PAGE_SIZE);
  const progress = useJobProgress(jobId, panelProgress);
  const status = progress.data?.status;
  const jobError = progress.data?.error;
  const item = job.data?.items[0];

  return (
    <>
      <PanelAutoResize
        chartId={chartId}
        job={job.data}
        jobStatus={status}
        desired={displaySize}
      />
      {item ? (
        <ChartItemCard
          item={item}
          chartId={chartId}
          primaryJobId={jobId}
          hasLegend={drawsLegend(spec)}
          displaySize={displaySize}
          onOpenInGallery={() => onOpenInGallery(spec)}
        />
      ) : status && isTerminal(status) ? (
        // item 목록이 정해지기 전에 끝나면(지운 데이터, 스키마 오류, 취소) 사유를 보인다.
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<TriangleAlert size={20} />}
            title={
              status === "cancelled"
                ? t({ message: "취소됨", context: "item status" })
                : t`그리지 못했습니다`
            }
          >
            {status === "cancelled" ? (
              <Trans>draw를 누르면 다시 그립니다.</Trans>
            ) : (
              (jobError ?? <Trans>다시 draw를 눌러 보세요.</Trans>)
            )}
          </EmptyState>
        </div>
      ) : (
        <ChartItemCard
          placeholder={
            job.data?.phase === "dataset" ? t`데이터 준비 중` : t`데이터 조회`
          }
        />
      )}
      {job.error && (
        <p
          role="alert"
          className="absolute inset-x-2 bottom-2 truncate text-xs text-danger"
        >
          {job.error.message}
        </p>
      )}
    </>
  );
}

/**
 * analytics 칸 하나의 차트. 칸을 감싼 PanelScope의 작업 store를 본다.
 * 칸 영역 전체가 item 한 장이다: 크기를 재 작업 store(gridArea)에 두고, draw·다시 열기·resize가 그 크기로 PNG를 그린다.
 * 페이지·하단 job 줄·크게 보기는 없다(최대화는 칸 틀이 맡는다). 상태: 그린 적 없음 → 여는 중 → 그리는 중 → 그림 / 실패.
 */
export function PanelChart({
  active,
  onOpenInGallery,
}: {
  /** 고른 칸인지. 빈 칸 안내에 왼쪽 패널 설명을 붙인다. */
  active: boolean;
  /** 우클릭 메뉴의 `gallery에서 열기`. 그린 설정을 넘긴다. */
  onOpenInGallery: (spec: ChartSpec) => void;
}) {
  const { t } = useLingui();
  const areaRef = useRef<HTMLDivElement>(null);
  const setGridArea = useWorkspace((s) => s.setGridArea);
  const chartId = useWorkspace((s) => s.current?.chartId);
  const jobId = useWorkspace((s) => s.current?.jobId);
  const spec = useWorkspace((s) => s.current?.spec);
  const opening = useWorkspace((s) => s.opening);
  const gridArea = useWorkspace((s) => s.gridArea);
  // 화면 배율이나 테마가 바뀌면 그 배율·테마로 다시 그린다.
  const pixelRatio = usePixelRatio();
  const theme = useColorScheme();
  // 값이 같으면 같은 참조를 넘겨 item이 다시 그려지지 않게 한다.
  const displaySize = useMemo(
    () =>
      gridArea ? detailSizeFor(gridArea, { pixelRatio, theme }) : undefined,
    [gridArea, pixelRatio, theme],
  );

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // 숨긴 칸(다른 칸을 최대화)은 크기가 0이다. 이전 크기를 그대로 두어 다시 그리지 않는다.
      if (width > 0 && height > 0) setGridArea({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [setGridArea]);

  return (
    <div ref={areaRef} className="relative flex size-full min-h-0 min-w-0">
      {chartId && jobId && spec ? (
        <DrawnPanel
          chartId={chartId}
          jobId={jobId}
          spec={spec}
          displaySize={displaySize}
          onOpenInGallery={onOpenInGallery}
        />
      ) : opening ? (
        // 저장한 보드를 다시 여는 중: 칸 자리에 진행 표시를 둔다.
        <ChartItemCard placeholder={t`차트 여는 중`} />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<ChartNoAxesCombined size={20} />}
            title={t`차트를 그려 주세요`}
          >
            {active && (
              <Trans>
                왼쪽 패널에서 데이터와 x, y를 고르고 draw를 누르세요.
              </Trans>
            )}
          </EmptyState>
        </div>
      )}
    </div>
  );
}
