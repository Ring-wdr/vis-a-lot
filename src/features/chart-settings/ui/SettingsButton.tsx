"use client";

import { Settings2 } from "lucide-react";
import { useTabs } from "@/entities/workspace/model/tabs-scope";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import styles from "@/shared/ui/workspace.module.css";

/** 왼쪽 패널 하단: 오른쪽 차트 속성 패널을 공통 속성 범위로 열고 닫는다. */
export function SettingsButton() {
  const color = useWorkspace((s) => s.draft.common.color);
  const setOptionsScope = useWorkspace((s) => s.setOptionsScope);
  const open = useTabs((s) => s.rightPanel === "options");
  const toggle = useTabs((s) => s.toggleRightPanel);
  return (
    <button
      type="button"
      className={styles.secondaryButton}
      aria-pressed={open}
      onClick={() => {
        setOptionsScope("common");
        toggle("options");
      }}
    >
      <Settings2 size={14} aria-hidden="true" />
      전체 설정
      <span
        className={styles.colorDot}
        style={{ background: color }}
        aria-hidden="true"
      />
    </button>
  );
}
