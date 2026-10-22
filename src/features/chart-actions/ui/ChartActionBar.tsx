"use client";

import { SquareCheck } from "lucide-react";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import styles from "@/shared/ui/workspace.module.css";

/**
 * 모드 바 옆의 차트 도구: legend 체크박스 표시.
 * 모드처럼 하나만 고르는 게 아니라 누를 때마다 바로 동작하는 버튼들이다.
 */
export function ChartActionBar() {
  const drawn = useWorkspace((s) => s.current !== undefined);
  const checkboxes = useWorkspace((s) => s.showLegendCheckboxes);
  const toggleCheckboxes = useWorkspace((s) => s.toggleLegendCheckboxes);

  return (
    <div className={styles.modeBar} role="toolbar" aria-label="차트 도구">
      <button
        type="button"
        title="체크박스 표시"
        aria-label="체크박스 표시"
        aria-pressed={checkboxes}
        disabled={!drawn}
        onClick={toggleCheckboxes}
      >
        <SquareCheck size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  );
}
