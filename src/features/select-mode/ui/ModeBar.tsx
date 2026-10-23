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
import { toolButton } from "@/shared/ui/button";

/** 자유형 삭제: lucide에 없어 올가미 오른쪽 아래에 x를 겹친다. */
function LassoX(props: LucideProps) {
  return (
    <span className="relative inline-flex">
      <Lasso {...props} />
      <X
        className="absolute -right-0.75 -bottom-0.75 rounded-full bg-elevated"
        size={9}
        strokeWidth={3}
      />
    </span>
  );
}

const MODE_UI: Record<
  Mode,
  { label: string; Icon: ComponentType<LucideProps> }
> = {
  normal: { label: "기본", Icon: MousePointer2 },
  pan: { label: "이동", Icon: Move },
  zoom: { label: "확대", Icon: ScanSearch },
  rectSelect: { label: "사각형 선택", Icon: SquareDashed },
  lassoSelect: { label: "자유형 선택", Icon: Lasso },
  rectDelete: { label: "사각형 삭제", Icon: SquareDashedX },
  lassoDelete: { label: "자유형 삭제", Icon: LassoX },
  paint: { label: "페인트", Icon: Paintbrush },
};

/**
 * 기본 외의 모드는 그린 차트가 있고 편집할 수 있을 때만 고를 수 있다.
 * 다시 보기 전용 화면이나 아직 그린 차트가 없으면 일반 모드(툴팁)만 된다.
 * 그린 차트 종류가 지원하지 않는 모드(CHART_SUPPORT)도 막는다.
 */
export function ModeBar() {
  const mode = useWorkspace((s) => s.mode);
  const setMode = useWorkspace((s) => s.setMode);
  const editable = useWorkspace((s) => !s.readOnly && s.current !== undefined);
  const chartType = useWorkspace((s) => s.current?.spec.chartType);
  const subType = useWorkspace((s) => s.current?.spec.subType);
  const spec = chartType && { chartType, subType };

  return (
    <div className="flex gap-1" role="toolbar" aria-label="모드">
      {MODES.map((m) => {
        const { label: name, Icon } = MODE_UI[m];
        const supported = modeSupported(m, spec);
        const label =
          supported || !spec
            ? name
            : `${name} (${chartKindLabel(spec)}에서는 쓸 수 없음)`;
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
