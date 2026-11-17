"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { useLocale } from "@vis-a-lot/shared/lib/i18n";
import { TriangleAlert } from "lucide-react";
import { memo, type ReactNode, useEffect } from "react";
import { chartKindLabel } from "@/entities/chart/lib/title";
import {
  ActivePanelScope,
  PanelScope,
  type RenderPanel,
  useBoard,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import {
  selectIsActive,
  selectPanelNumber,
} from "@/entities/workspace/model/board-store";
import { useTabs } from "@/entities/workspace/model/tabs-scope";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { AddPanelButton } from "@/features/arrange-panels/ui/AddPanelButton";
import { ClearBoardButton } from "@/features/arrange-panels/ui/ClearBoardButton";
import { LayoutPresetButton } from "@/features/arrange-panels/ui/LayoutPresetButton";
import { SettingsButton } from "@/features/chart-settings/ui/SettingsButton";
import { DrawButton } from "@/features/draw-chart/ui/DrawButton";
import { useOpenInGallery } from "@/features/open-chart/model/open-in-gallery";
import { useDatasets, useSaveBoard } from "@/shared/api/queries";
import { useCallbackRef } from "@/shared/lib/use-callback-ref";
import { button } from "@/shared/ui/button";
import { EmptyState, Spinner } from "@/shared/ui/Loading";
import { AnalyticsBoard } from "@/widgets/analytics-board/ui/AnalyticsBoard";
import { AnalyticsToolbar } from "@/widgets/analytics-toolbar/ui/AnalyticsToolbar";
import { AppHeader } from "@/widgets/app-header/ui/AppHeader";
import { PanelChart } from "@/widgets/chart-grid/ui/PanelChart";
import { ControlPanel } from "@/widgets/control-panel/ui/ControlPanel";
import { FilterPanel } from "@/widgets/filter-panel/ui/FilterPanel";
import "../config/messages";
import { createBoardAutosave } from "../model/board-autosave";
import { useSettingsDrawer } from "../model/board-drawer";
import { useBoardHydrate } from "../model/use-board-hydrate";
import { BoardStatusBar } from "./BoardStatusBar";
import { PanelJobs } from "./PanelJobs";

/**
 * 칸 하나의 내용: 그 칸의 작업 store로 감싼 칸 차트. 보드 위젯이 칸 id만 넘기므로 memo해
 * 다른 칸이나 보드가 바뀌어도 다시 그리지 않는다. 고른 칸인지만 보드에서 고른다.
 */
const PanelContent = memo(function PanelContent({
  panelId,
}: {
  panelId: string;
}) {
  const active = useBoard(selectIsActive(panelId));
  const openInGallery = useOpenInGallery();
  return (
    <PanelScope panelId={panelId}>
      <PanelChart active={active} onOpenInGallery={openInGallery} />
    </PanelScope>
  );
});

/** 칸 이름표의 번호 뒤: 차트 종류 · 데이터셋 이름. 그린 차트가 있으면 그린 설정, 없으면 고치는 설정을 적는다. */
function PanelLabelText() {
  useLocale();
  const chartType = useWorkspace((s) => (s.current?.spec ?? s.draft).chartType);
  const subType = useWorkspace((s) => (s.current?.spec ?? s.draft).subType);
  const dataset = useWorkspace((s) => (s.current?.spec ?? s.draft).dataset);
  const name = useDatasets().data?.datasets.find((d) => d.id === dataset)?.name;
  const chart = chartKindLabel({ chartType, subType });
  return name ? `${chart} · ${name}` : chart;
}

const PanelLabel = memo(function PanelLabel({ panelId }: { panelId: string }) {
  return (
    <PanelScope panelId={panelId}>
      <PanelLabelText />
    </PanelScope>
  );
});

/** 보드 위젯이 칸 자리에 끼우는 내용. 참조가 바뀌면 모든 칸이 다시 그려지므로 모듈에 고정한다. */
const renderPanel: RenderPanel = (panelId) => (
  <PanelContent panelId={panelId} />
);
const renderLabel: RenderPanel = (panelId) => <PanelLabel panelId={panelId} />;

/** 도구 줄의 칸 배치 버튼: 칸 추가, 레이아웃, 보드 비우기 */
const ARRANGE: ReactNode = (
  <>
    <AddPanelButton />
    <LayoutPresetButton />
    <ClearBoardButton />
  </>
);

/** 보드 자동 저장. mutation을 들고 있을 뿐 그리지 않는다. */
function BoardAutosave() {
  const board = useBoardStore();
  const hydrated = useBoard((s) => s.hydrated);
  const { mutate } = useSaveBoard();
  const save = useCallbackRef(mutate);
  useEffect(() => {
    if (!hydrated) return;
    const autosave = createBoardAutosave(board, (body) => save(body));
    // 화면을 떠나면 기다리던 저장을 바로 보낸다.
    return () => {
      autosave.flush();
      autosave.stop();
    };
  }, [board, hydrated, save]);
  return null;
}

/** 왼쪽 패널 맨 위: 활성 칸의 번호와 차트 이름 */
function PanelHeading() {
  // 차트 이름(chartKindLabel)도 지금 언어로 읽으므로 useLocale로 언어 변경을 구독한다.
  useLocale();
  const number = useBoard((s) => selectPanelNumber(s.activePanelId)(s));
  const chartType = useWorkspace((s) => s.draft.chartType);
  const subType = useWorkspace((s) => s.draft.subType);
  const chart = chartKindLabel({ chartType, subType });
  return (
    <h2 className="truncate text-xs font-semibold text-fg-secondary">
      <Trans comment="number: 칸 번호, chart: 차트 종류 이름">
        칸 {number} · {chart}
      </Trans>
    </h2>
  );
}

/** 좁은 폭에서 왼쪽 패널 서랍을 여는 버튼. 넓은 폭에서는 숨긴다. */
function SettingsDrawerToggle() {
  const { t } = useLingui();
  const open = useSettingsDrawer((s) => s.open);
  const toggle = useSettingsDrawer((s) => s.toggle);
  return (
    <button
      type="button"
      className={button({ size: "sm", class: "whitespace-nowrap lg:hidden" })}
      aria-pressed={open}
      aria-controls="analytics-panel-settings"
      onClick={toggle}
    >
      {t({ message: "설정", context: "analytics panel settings drawer" })}
    </button>
  );
}

/**
 * 왼쪽 패널: 활성 칸의 설정. grid·split by는 없다(칸 = 차트 한 장). 하단에 전체 설정과 draw를 고정한다.
 * 64rem보다 좁으면 보드 위에 겹치는 서랍이 된다.
 */
function PanelSettings() {
  const { t } = useLingui();
  const open = useSettingsDrawer((s) => s.open);
  return (
    <aside
      id="analytics-panel-settings"
      aria-label={t`칸 설정`}
      data-open={open || undefined}
      className="z-drawer col-1 row-[3/5] flex min-h-0 flex-col border-r border-line bg-panel max-lg:w-[min(16.25rem,100%)] max-lg:shadow-drawer max-lg:not-data-open:hidden"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <PanelHeading />
        <ControlPanel split={false} />
      </div>
      <div className="flex flex-col gap-2 border-t border-line bg-panel px-4 py-3">
        <SettingsButton />
        <DrawButton />
      </div>
    </aside>
  );
}

/** 오른쪽 필터 서랍: 활성 칸의 필터. 보드 위에 겹쳐 연다 (보드가 좁아져 모든 칸을 다시 그리지 않게). */
function FilterDrawer() {
  const open = useTabs((s) => s.filterPanelOpen);
  if (!open) return null;
  return (
    <div className="z-drawer col-[-2/-1] row-3 flex min-h-0 w-[min(18.75rem,100%)] justify-self-end shadow-drawer">
      <FilterPanel />
    </div>
  );
}

/** 저장한 보드를 받기 전에는 보드 대신 진행이나 실패를 보인다. 받은 뒤에는 children을 그린다. */
function BoardGate({ children }: { children: ReactNode }) {
  const { t } = useLingui();
  const { hydrated, error, retry, retrying } = useBoardHydrate();
  if (hydrated) return children;
  return (
    <main className="col-span-full row-[2/-1] flex items-center justify-center">
      {error ? (
        <EmptyState
          icon={<TriangleAlert size={20} />}
          title={t`보드를 불러오지 못했습니다`}
        >
          <p>{error.message}</p>
          <button
            type="button"
            className={button({ size: "sm", class: "mt-2" })}
            disabled={retrying}
            onClick={retry}
          >
            <Trans>다시 시도</Trans>
          </button>
        </EmptyState>
      ) : (
        <span className="flex items-center gap-2 text-sm text-fg-secondary">
          <Spinner />
          <Trans>보드 불러오는 중</Trans>
        </span>
      )}
    </main>
  );
}

/**
 * analytics 화면 틀: 상단 바, 보드 도구 줄, 왼쪽 패널(활성 칸 설정), 보드, 필터 서랍, 하단 줄.
 * 칸마다 데이터·차트·필터가 따로다. 왼쪽 패널·도구 줄·필터 서랍은 활성 칸의 작업 store(ActivePanelScope)를 보고,
 * 칸 안은 보드 위젯이 renderPanel로 칸마다 그 칸의 store(PanelScope)를 쓴다.
 * 보드 상태는 세션 범위(SessionScope의 BoardScope)라 `/`에 다녀와도 남는다.
 */
export function AnalyticsView() {
  return (
    <div className="grid h-screen grid-cols-[16.25rem_minmax(0,1fr)] grid-rows-[3rem_2.75rem_minmax(0,1fr)_2rem] bg-surface text-fg max-lg:grid-cols-[minmax(0,1fr)]">
      <AppHeader />
      <BoardGate>
        <ActivePanelScope>
          <AnalyticsToolbar
            arrange={ARRANGE}
            leading={<SettingsDrawerToggle />}
          />
          <PanelSettings />
          <FilterDrawer />
        </ActivePanelScope>
        <main className="col-2 row-3 min-h-0 min-w-0 p-2 max-lg:col-1">
          <AnalyticsBoard renderPanel={renderPanel} renderLabel={renderLabel} />
        </main>
        <div className="col-2 row-4 min-w-0 max-lg:col-1">
          <BoardStatusBar />
        </div>
        <PanelJobs />
        <BoardAutosave />
      </BoardGate>
    </div>
  );
}
