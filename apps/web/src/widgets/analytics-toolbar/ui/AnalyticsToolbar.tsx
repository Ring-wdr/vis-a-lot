"use client";

import { Trans } from "@lingui/react/macro";
import { Filter } from "lucide-react";
import type { ReactNode } from "react";
import { useBoard } from "@/entities/workspace/model/board-scope";
import { useTabs } from "@/entities/workspace/model/tabs-scope";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { ChartActionBar } from "@/features/chart-actions/ui/ChartActionBar";
import { openControlLimitSettings } from "@/features/chart-settings/ui/SettingsDialog";
import { DrawAllButton } from "@/features/draw-chart/ui/DrawAllButton";
import { ModeBar } from "@/features/select-mode/ui/ModeBar";
import { ChartFeedPostButton } from "@/features/share-chart/ui/FeedPostButton";
import { ShareButton } from "@/features/share-chart/ui/ShareButton";
import "../config/messages";

const divider = "my-2 w-px flex-none self-stretch bg-line";

/** 모드 바. 고른 모드는 보드 전체에 적용한다 (그 칸의 차트가 지원하지 않으면 그 칸만 기본 모드). */
function BoardModeBar() {
  const mode = useBoard((s) => s.mode);
  const setMode = useBoard((s) => s.setMode);
  return <ModeBar mode={mode} onModeChange={setMode} />;
}

/** 필터 서랍 열기/닫기. 활성 칸에 걸린 필터 수를 보인다. 열린 상태는 gallery와 함께 쓴다. */
function FilterToggle() {
  const open = useTabs((s) => s.filterPanelOpen);
  const toggle = useTabs((s) => s.toggleFilterPanel);
  const count = useWorkspace((s) => s.draft.filters?.length ?? 0);
  return (
    <button
      type="button"
      className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-md border border-line bg-elevated px-2.5 py-1 text-xs whitespace-nowrap text-fg-secondary aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
      aria-pressed={open}
      onClick={toggle}
    >
      <Filter size={13} aria-hidden="true" />
      <Trans context="filter panel button">필터</Trans>
      {count > 0 && (
        <span className="inline-grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-3xs text-on-accent">
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * analytics 보드의 도구 줄: 칸 배치 버튼(arrange), draw all, 모드 바(보드 전체), 활성 칸의 차트 도구, 공유, 필터.
 * 활성 칸의 WorkspaceScope(ActivePanelScope) 안에서 그린다. 칸 배치 버튼은 다른 feature라 조합하는 쪽이 넘긴다.
 */
export function AnalyticsToolbar({
  arrange,
  leading,
}: {
  /** 칸 추가·레이아웃·보드 비우기 */
  arrange?: ReactNode;
  /** 맨 앞에 둘 것 (좁은 폭의 설정 서랍 버튼) */
  leading?: ReactNode;
}) {
  return (
    // 모드 바·차트 도구가 각자 toolbar라 겉은 묶음으로만 둔다.
    <div className="col-span-full flex min-w-0 items-center gap-3 overflow-x-auto border-b border-line bg-surface px-4">
      {leading}
      {arrange && (
        <div className="flex flex-none items-center gap-1">{arrange}</div>
      )}
      <DrawAllButton />
      <span className={divider} aria-hidden="true" />
      <BoardModeBar />
      <span className={divider} aria-hidden="true" />
      <ChartActionBar
        onOpenControlLimit={openControlLimitSettings}
        allChartsExcel={false}
      />
      <div className="ml-auto flex flex-none items-center gap-2 self-stretch">
        <ShareButton />
        <ChartFeedPostButton />
        <span className={divider} aria-hidden="true" />
        <FilterToggle />
      </div>
    </div>
  );
}
