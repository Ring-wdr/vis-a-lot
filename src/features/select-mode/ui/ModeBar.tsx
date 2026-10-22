"use client";

import {
  Lasso,
  type LucideIcon,
  MousePointer2,
  Move,
  Paintbrush,
  ScanSearch,
  SquareDashed,
} from "lucide-react";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { MODES, type Mode } from "@/entities/workspace/model/workspace-store";
import styles from "@/shared/ui/workspace.module.css";

const MODE_UI: Record<Mode, { label: string; Icon: LucideIcon }> = {
  normal: { label: "기본", Icon: MousePointer2 },
  pan: { label: "이동", Icon: Move },
  zoom: { label: "확대", Icon: ScanSearch },
  rectSelect: { label: "사각형 선택", Icon: SquareDashed },
  lassoSelect: { label: "자유형 선택", Icon: Lasso },
  paint: { label: "페인트", Icon: Paintbrush },
};

/**
 * 기본 외의 모드는 그린 차트가 있고 편집할 수 있을 때만 고를 수 있다.
 * 다시 보기 전용 화면이나 아직 그린 차트가 없으면 일반 모드(툴팁)만 된다.
 */
export function ModeBar() {
  const mode = useWorkspace((s) => s.mode);
  const setMode = useWorkspace((s) => s.setMode);
  const editable = useWorkspace((s) => !s.readOnly && s.current !== undefined);

  return (
    <div className={styles.modeBar} role="toolbar" aria-label="모드">
      {MODES.map((m) => {
        const { label, Icon } = MODE_UI[m];
        return (
          <button
            key={m}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={mode === m}
            disabled={!editable && m !== "normal"}
            onClick={() => setMode(m)}
          >
            <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
