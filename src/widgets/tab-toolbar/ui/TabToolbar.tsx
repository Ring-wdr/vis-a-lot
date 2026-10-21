"use client";

import { ModeBar } from "@/features/select-mode/ui/ModeBar";
import { ShareButton } from "@/features/share-chart/ui/ShareButton";
import styles from "@/shared/ui/workspace.module.css";

/** 탭 안 도구 줄: 이 탭 차트의 모드와 공유. 탭마다 작업 상태가 따로라 탭 바 아래, 탭 내용 쪽에 둔다. */
export function TabToolbar() {
  return (
    <div className={styles.tabToolbar}>
      <ModeBar />
      <div className={styles.headerActions}>
        <ShareButton />
      </div>
    </div>
  );
}
