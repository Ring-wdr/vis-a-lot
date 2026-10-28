"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { History, LayoutGrid, TriangleAlert } from "lucide-react";
import { useDeferredValue, useEffect, useId, useRef } from "react";
import { itemSizeFor } from "@/entities/chart/lib/grid-layout";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useAutoResize } from "@/features/auto-resize/model/use-auto-resize";
import { useJob, useJobProgress } from "@/shared/api/queries";
import { isTerminal } from "@/shared/api/types";
import { drawsLegend } from "@/shared/config/chart-kinds";
import { useColorScheme } from "@/shared/lib/color-scheme";
import { intlLocale } from "@/shared/lib/i18n";
import { usePixelRatio } from "@/shared/lib/pixel-ratio";
import { cn } from "@/shared/lib/tw";
import { usePendingValue } from "@/shared/lib/use-pending-value";
import { showAlert } from "@/shared/ui/AlertDialog";
import { EmptyState, Spinner } from "@/shared/ui/Loading";
import "../config/messages";
import { ChartItemCard } from "./ChartItemCard";
import { DetailView } from "./DetailView";
import { JobStatusBar } from "./JobStatusBar";
import { PageScroller, type PageScrollerHandle } from "./PageScroller";

// 행·열 수(1..10)마다 클래스를 고른다. Tailwind가 찾을 수 있게 이름을 그대로 적는다.
const GRID_COLS = [
  "",
  "grid-cols-1",
  "grid-cols-2",
  "grid-cols-3",
  "grid-cols-4",
  "grid-cols-5",
  "grid-cols-6",
  "grid-cols-7",
  "grid-cols-8",
  "grid-cols-9",
  "grid-cols-10",
];
const GRID_ROWS = [
  "",
  "grid-rows-1",
  "grid-rows-2",
  "grid-rows-3",
  "grid-rows-4",
  "grid-rows-5",
  "grid-rows-6",
  "grid-rows-7",
  "grid-rows-8",
  "grid-rows-9",
  "grid-rows-10",
];

/** gap은 grid-layout.ts의 GRID_GAP과 같아야 PNG 크기 계산이 맞는다. */
function gridClass({ rows, cols }: { rows: number; cols: number }) {
  return cn(
    "relative grid min-w-0 flex-1 gap-3",
    GRID_ROWS[rows],
    GRID_COLS[cols],
  );
}

const pagerButton =
  "h-6 w-6.5 cursor-pointer rounded-md border border-line bg-elevated disabled:cursor-not-allowed disabled:text-fg-muted disabled:opacity-40";

function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  const { t } = useLingui();
  if (totalPages <= 1) return null;
  return (
    <nav
      className="ml-auto flex h-full flex-none items-center gap-1.5 border-l border-line px-2"
      aria-label={t({ message: "페이지", context: "grid pages" })}
    >
      <button
        type="button"
        className={pagerButton}
        aria-label={t`이전 페이지`}
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        ‹
      </button>
      {/* 페이지 수가 30,000까지 가도 번호가 바뀔 때 버튼이 움직이지 않게 자리를 잡아 둔다. */}
      <span className="min-w-[13ch] text-center tabular-nums">
        {page + 1} / {totalPages}
      </span>
      <button
        type="button"
        className={pagerButton}
        aria-label={t`다음 페이지`}
        disabled={page >= totalPages - 1}
        onClick={() => onPage(page + 1)}
      >
        ›
      </button>
    </nav>
  );
}

export function ChartGrid() {
  const { t } = useLingui();
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
  // 스크롤하는 동안 보이는 페이지. 서버 조회 페이지(page)는 throttle로 뒤따라오고,
  // 따라잡으면 다시 page를 그대로 보여 준다.
  const [viewPage, scrolling] = usePendingValue(page);
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
  const pageText = (viewPage + 1).toLocaleString(intlLocale());
  const totalText = totalPages.toLocaleString(intlLocale());
  const jobError = progress.data?.error;
  const gridArea = useWorkspace((s) => s.gridArea);
  // PNG를 띄울 크기. resize 중에는 이 크기로 기존 PNG를 늘리거나 줄여 보여준다.
  // 화면 배율이 바뀌거나(다른 모니터로 옮김) 테마가 바뀌면 그 배율·테마로 다시 그린다.
  const pixelRatio = usePixelRatio();
  const theme = useColorScheme();
  const displaySize = gridArea
    ? itemSizeFor(gridArea, grid, { pixelRatio, theme })
    : undefined;
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
    scrolling.change(p);
    scrolling.commit(() => setPage(p));
  };

  // grid로 돌아오면 크게 보던 item이 있는 페이지를 보여준다.
  const closeDetail = () => {
    if (focus !== null) goToPage(Math.floor(focus / pageSize));
    setFocus(null);
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
    // grid와 하단 바를 세로로 쌓는다. 하단 바 높이(32px + 위 여백 12px)는
    // grid-layout.ts의 GRID_FOOTER_HEIGHT와 같아야 PNG 크기 계산이 맞는다.
    <div ref={areaRef} className="relative flex size-full flex-col">
      {!current &&
        (opening ? (
          // history·공유 링크의 차트를 여는 중: 그 grid 모양대로 자리를 잡아 둔다.
          <div className={gridClass(draftGrid)} aria-busy="true">
            {Array.from({ length: draftGrid.rows * draftGrid.cols }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 여는 동안의 자리 표시용
              <ChartItemCard key={i} placeholder={t`차트 여는 중`} />
            ))}
          </div>
        ) : readOnly ? (
          <EmptyState
            icon={<History size={20} />}
            title={t`다시 볼 차트 고르기`}
          >
            <Trans>
              왼쪽 목록에서 차트를 고르면 저장된 설정과 확대·도형·색 그대로 다시
              그립니다.
            </Trans>
          </EmptyState>
        ) : (
          <EmptyState
            icon={<LayoutGrid size={20} />}
            title={t`아직 그린 차트가 없습니다`}
          >
            <Trans>
              왼쪽에서 데이터와 x, y를 고르고 draw를 누르세요. split by를 고르면
              조합마다 item 하나씩 grid로 그립니다.
            </Trans>
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
            <div className="flex min-h-0 flex-1 gap-2">
              <div
                id={gridId}
                className={gridClass(grid)}
                // 페이지 이동은 오른쪽 스크롤바가 맡는다. grid 위의 휠도 그쪽으로 넘긴다.
                onWheel={(e) => scroller.current?.wheel(e.deltaY)}
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
                          ? t`데이터 준비 중`
                          : t`데이터 조회`
                      }
                    />
                  ))}
                {/* item 목록이 정해지기 전에 실패하면(지운 데이터, 스키마 오류 등) 빈 grid 대신 사유를 보여준다. */}
                {job.data?.status === "failed" &&
                  job.data.totalItems === null && (
                    <div className="col-span-full row-span-full self-center">
                      <EmptyState
                        icon={<TriangleAlert size={20} />}
                        title={t`그리지 못했습니다`}
                      >
                        {jobError ?? <Trans>다시 draw를 눌러 보세요.</Trans>}
                      </EmptyState>
                    </div>
                  )}
                {moving && (
                  // 스크롤 중 보이는 페이지와 조회한 페이지가 다를 때 grid를 덮는 안내
                  <div
                    className="z-overlay absolute inset-0 flex items-center justify-center gap-2 rounded-md bg-overlay text-sm text-fg-secondary tabular-nums"
                    aria-live="polite"
                  >
                    <Spinner />
                    {t({
                      message: `${pageText} / ${totalText} 페이지로 이동 중…`,
                      comment:
                        "pageText: 지금 페이지 번호, totalText: 전체 페이지 수",
                    })}
                  </div>
                )}
              </div>
              <PageScroller
                ref={scroller}
                controls={gridId}
                viewPage={viewPage}
                totalPages={totalPages}
                onPage={(p) => scrolling.commit(() => setPage(p))}
                onViewPage={scrolling.change}
              />
            </div>
          )}
          {/* 하단 바: 테두리 상자 하나에 job 상태 구획들과 페이지 이동을 나란히 둔다. */}
          <div className="mt-3 flex h-8 items-center overflow-hidden rounded-md border border-line bg-elevated text-xs whitespace-nowrap text-fg-secondary tabular-nums shadow-sm">
            {/* job 구획은 폭에 따라 덜 중요한 것부터 숨기고(JobStatusBar의 @container 변형), 페이지 이동은 늘 보인다. */}
            <div className="@container flex h-full min-w-0 flex-1 items-center overflow-hidden">
              {job.error ? (
                <span role="alert" className="px-3 text-xs text-danger">
                  {job.error.message}
                </span>
              ) : (
                progress.data && <JobStatusBar job={progress.data} />
              )}
            </div>
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
