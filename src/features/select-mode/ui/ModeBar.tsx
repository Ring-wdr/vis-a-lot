"use client";

import {
  type LucideIcon,
  MousePointer2,
  PenLine,
  Slash,
  Square,
  Type,
  ZoomIn,
} from "lucide-react";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { MODES, type Mode } from "@/entities/workspace/model/workspace-store";
import styles from "@/shared/ui/workspace.module.css";

const MODE_UI: Record<Mode, { label: string; Icon: LucideIcon }> = {
  normal: { label: "일반", Icon: MousePointer2 },
  zoom: { label: "확대", Icon: ZoomIn },
  rect: { label: "사각형", Icon: Square },
  line: { label: "선", Icon: Slash },
  freehand: { label: "자유곡선", Icon: PenLine },
  text: { label: "텍스트", Icon: Type },
};

/** 다시 보기 전용 화면에서는 일반 모드(툴팁)만 고를 수 있다. */
export function ModeBar() {
  const mode = useWorkspace((s) => s.mode);
  const setMode = useWorkspace((s) => s.setMode);
  const readOnly = useWorkspace((s) => s.readOnly);

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
            disabled={readOnly && m !== "normal"}
            onClick={() => setMode(m)}
          >
            <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
