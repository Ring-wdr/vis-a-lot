"use client";

import {
  MODES,
  type Mode,
  useWorkspace,
} from "@/entities/workspace/model/workspace-store";
import styles from "@/shared/ui/workspace.module.css";

const LABELS: Record<Mode, string> = {
  normal: "일반",
  zoom: "확대",
  rect: "사각형",
  line: "선",
  freehand: "자유곡선",
  text: "텍스트",
};

export function ModeBar() {
  const mode = useWorkspace((s) => s.mode);
  const setMode = useWorkspace((s) => s.setMode);

  return (
    <div className={styles.modeBar} role="toolbar" aria-label="모드">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
        >
          {LABELS[m]}
        </button>
      ))}
    </div>
  );
}
