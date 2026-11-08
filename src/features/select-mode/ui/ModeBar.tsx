"use client";

import {
  Lasso,
  type LucideProps,
  MousePointer2,
  Move,
  Paintbrush,
  ScanSearch,
  SquareDashed,
  SquareDashedX,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import { chartKindLabel } from "@/entities/chart/lib/title";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import {
  MODES,
  type Mode,
  modeSupported,
} from "@/entities/workspace/model/workspace-store";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { toolButton } from "@/shared/ui/button";

/** 자유형 삭제: lucide에 없어 올가미 오른쪽 아래에 x를 겹친다. */
function LassoX(props: LucideProps) {
  return (
    <span className="relative inline-flex">
      <Lasso {...props} />
      <X
        className="absolute -right-1 -bottom-1 rounded-full bg-elevated"
        size={9}
        strokeWidth={3}
      />
    </span>
  );
}

const MODE_ICONS: Record<Mode, ComponentType<LucideProps>> = {
  normal: MousePointer2,
  pan: Move,
  zoom: ScanSearch,
  rectSelect: SquareDashed,
  lassoSelect: Lasso,
  rectDelete: SquareDashedX,
  lassoDelete: LassoX,
  paint: Paintbrush,
};

const messages = defineMessages({
  ko: {
    modes: {
      normal: "기본",
      pan: "이동",
      zoom: "확대",
      rectSelect: "사각형 선택",
      lassoSelect: "자유형 선택",
      rectDelete: "사각형 삭제",
      lassoDelete: "자유형 삭제",
      paint: "페인트",
    } as Record<Mode, string>,
    unsupported: (name: string, chartType: string) =>
      `${name} (${chartType}에서는 쓸 수 없음)`,
    toolbar: "모드",
  },
  en: {
    modes: {
      normal: "Default",
      pan: "Pan",
      zoom: "Zoom",
      rectSelect: "Box select",
      lassoSelect: "Lasso select",
      rectDelete: "Box delete",
      lassoDelete: "Lasso delete",
      paint: "Paint",
    },
    unsupported: (name: string, chartType: string) =>
      `${name} (not available for ${chartType})`,
    toolbar: "Mode",
  },
});

/**
 * 기본 외의 모드는 그린 차트가 있고 편집할 수 있을 때만 고를 수 있다.
 * 다시 보기 전용 화면이나 아직 그린 차트가 없으면 일반 모드(툴팁)만 된다.
 * 그린 차트 종류가 지원하지 않는 모드(CHART_SUPPORT)도 막는다.
 */
export function ModeBar() {
  const text = useT(messages);
  const mode = useWorkspace((s) => s.mode);
  const setMode = useWorkspace((s) => s.setMode);
  const editable = useWorkspace((s) => !s.readOnly && s.current !== undefined);
  const chartType = useWorkspace((s) => s.current?.spec.chartType);
  const subType = useWorkspace((s) => s.current?.spec.subType);
  const spec = chartType && { chartType, subType };

  return (
    <div className="flex gap-1" role="toolbar" aria-label={text.toolbar}>
      {MODES.map((m) => {
        const name = text.modes[m];
        const Icon = MODE_ICONS[m];
        const supported = modeSupported(m, spec);
        const label =
          supported || !spec
            ? name
            : text.unsupported(name, chartKindLabel(spec));
        return (
          <button
            key={m}
            type="button"
            className={toolButton()}
            title={label}
            aria-label={label}
            aria-pressed={mode === m}
            disabled={(!editable && m !== "normal") || !supported}
            onClick={() => setMode(m)}
          >
            <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
