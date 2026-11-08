"use client";

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
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
import { toolButton } from "@/shared/ui/button";
import "../config/messages";

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

const MODE_NAMES: Record<Mode, MessageDescriptor> = {
  normal: msg({ message: "기본", context: "chart interaction mode" }),
  pan: msg({ message: "이동", context: "chart interaction mode" }),
  zoom: msg({ message: "확대", context: "chart interaction mode" }),
  rectSelect: msg`사각형 선택`,
  lassoSelect: msg`자유형 선택`,
  rectDelete: msg`사각형 삭제`,
  lassoDelete: msg`자유형 삭제`,
  paint: msg({ message: "페인트", context: "chart interaction mode" }),
};

/**
 * 기본 외의 모드는 그린 차트가 있고 편집할 수 있을 때만 고를 수 있다.
 * 다시 보기 전용 화면이나 아직 그린 차트가 없으면 일반 모드(툴팁)만 된다.
 * 그린 차트 종류가 지원하지 않는 모드(CHART_SUPPORT)도 막는다.
 */
export function ModeBar() {
  const { t, i18n } = useLingui();
  const mode = useWorkspace((s) => s.mode);
  const setMode = useWorkspace((s) => s.setMode);
  const editable = useWorkspace((s) => !s.readOnly && s.current !== undefined);
  const chartType = useWorkspace((s) => s.current?.spec.chartType);
  const subType = useWorkspace((s) => s.current?.spec.subType);
  const spec = chartType && { chartType, subType };

  return (
    <div
      className="flex gap-1"
      role="toolbar"
      aria-label={t({
        message: "모드",
        context: "chart interaction mode toolbar",
      })}
    >
      {MODES.map((m) => {
        const name = i18n._(MODE_NAMES[m]);
        const Icon = MODE_ICONS[m];
        const supported = modeSupported(m, spec);
        const chartKind = spec ? chartKindLabel(spec) : "";
        const label =
          supported || !spec
            ? name
            : t({
                message: `${name} (${chartKind}에서는 쓸 수 없음)`,
                comment: "name: 모드 이름, chartKind: 차트 종류 이름",
              });
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
