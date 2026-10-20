"use client";

import { Settings2 } from "lucide-react";
import {
  useWorkspace,
  useWorkspaceStore,
} from "@/entities/workspace/model/workspace-scope";
import styles from "@/shared/ui/workspace.module.css";
import { openSettingsDialog } from "./SettingsDialog";

/** 왼쪽 패널 하단: 색상, split 구분 기호처럼 자주 바꾸지 않는 설정을 팝업으로 모은다. */
export function SettingsButton() {
  const store = useWorkspaceStore();
  const color = useWorkspace((s) => s.draft.common.color);
  return (
    <button
      type="button"
      className={styles.secondaryButton}
      onClick={() => openSettingsDialog(store)}
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
