"use client";

import { useLingui } from "@lingui/react/macro";
import { intlLocale } from "@vis-a-lot/shared/lib/i18n";
import { cn } from "@vis-a-lot/shared/lib/tw";
import { CircleX, Cpu, LayoutDashboard, LoaderCircle } from "lucide-react";
import {
  ActivePanelScope,
  useBoard,
} from "@/entities/workspace/model/board-scope";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useHealth, useJobProgress } from "@/shared/api/queries";
import { JobStatusBar } from "@/widgets/chart-grid/ui/JobStatusBar";
import "../config/messages";
import { usePanelStatus } from "../model/panel-status";

const section =
  "flex h-full flex-none items-center gap-1.5 border-r border-line px-3";
const zero = "data-zero:text-fg-muted data-zero:opacity-60";

/** 활성 칸의 job 진행. 응답마다 바뀌는 진행률은 이 컴포넌트만 구독한다. */
function ActiveProgress() {
  const jobId = useWorkspace((s) => s.current?.jobId);
  const progress = useJobProgress(jobId);
  return progress.data ? <JobStatusBar job={progress.data} /> : null;
}

/**
 * 하단 줄: 칸 수, 그리는 중인 칸 수, 실패한 칸 수, Render Worker 수, 그리고 활성 칸의 job 진행.
 * 칸마다 job이 따로라 보드 전체는 개수로, 자세한 진행은 고른 칸 것만 보인다.
 */
export function BoardStatusBar() {
  const { t } = useLingui();
  const panels = useBoard((s) => s.panelIds.length);
  const drawing = useBoard((s) => Object.keys(s.busy).length);
  const failed = usePanelStatus((s) => Object.keys(s.failed).length);
  const workers = useHealth().data?.renderWorkers;
  const n = (value: number) => value.toLocaleString(intlLocale());

  return (
    <footer className="flex h-full min-w-0 items-center overflow-hidden border-t border-line bg-elevated text-xs whitespace-nowrap text-fg-secondary tabular-nums">
      <span className={section} title={t`칸 수`}>
        <LayoutDashboard size={13} aria-hidden="true" />
        {t({ message: `칸 ${n(panels)}개`, comment: "보드의 칸 수" })}
      </span>
      <span
        className={cn(section, zero, drawing > 0 && "text-accent")}
        data-zero={drawing === 0 || undefined}
        title={t`그리는 중인 칸 수`}
      >
        <LoaderCircle size={13} aria-hidden="true" />
        {t({
          message: `그리는 중 ${n(drawing)}`,
          comment: "그리는 중인 칸 수",
        })}
      </span>
      <span
        className={cn(section, zero, failed > 0 && "text-danger")}
        data-zero={failed === 0 || undefined}
        title={t`실패한 칸 수`}
      >
        <CircleX size={13} aria-hidden="true" />
        {t({ message: `실패 ${n(failed)}`, comment: "실패한 칸 수" })}
      </span>
      <span className={section} title={t`Render Worker 수`}>
        <Cpu size={13} aria-hidden="true" />
        Worker {workers ?? "–"}
      </span>
      {/* 활성 칸의 진행: 폭이 모자라면 JobStatusBar가 덜 중요한 구획부터 숨긴다. */}
      <div className="@container flex h-full min-w-0 flex-1 items-center overflow-hidden">
        <ActivePanelScope>
          <ActiveProgress />
        </ActivePanelScope>
      </div>
    </footer>
  );
}
