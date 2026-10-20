"use client";

import { MODES, type Mode, useWorkspace } from "@/lib/workspace-store";
import styles from "./Workspace.module.css";

const LABELS: Record<Mode, string> = {
  normal: "일반",
  zoom: "확대",
  rect: "사각형",
  line: "선",
  freehand: "자유곡선",
  text: "텍스트",
};

/** 아직 구현되지 않은 모드는 비활성화해 둔다. */
const ENABLED = new Set<Mode>(["normal"]);

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
          disabled={!ENABLED.has(m)}
          onClick={() => setMode(m)}
        >
          {LABELS[m]}
        </button>
      ))}
    </div>
  );
}
