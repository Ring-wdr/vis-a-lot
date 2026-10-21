"use client";

import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import styles from "@/shared/ui/workspace.module.css";
import settingsStyles from "./SettingsDialog.module.css";

/**
 * 전체 설정 · 툴팁. 화면 표시만 바꾸므로 다시 그리지 않고 바로 적용된다.
 * 다시 보기(history)에서도 바꿀 수 있다.
 */
export function TooltipSettings() {
  const showNearest = useWorkspace((s) => s.showNearest);
  const setShowNearest = useWorkspace((s) => s.setShowNearest);

  return (
    <div className={settingsStyles.section}>
      <h3 className={settingsStyles.heading}>scatter 툴팁</h3>
      <label className={settingsStyles.row}>
        <input
          type="checkbox"
          checked={showNearest}
          onChange={(e) => setShowNearest(e.target.checked)}
        />
        <span>가까운 점 표시</span>
      </label>
      <p className={styles.muted}>
        커서에서 가장 가까운 점의 x, y와 tooltip 컬럼을 보여줍니다. 점은 픽셀
        하나에 하나씩 줄인 점 중에서 찾습니다. 끄면 커서 위치의 x, y만 보여주고,
        tooltip 컬럼도 가까운 점의 값이라 함께 숨겨집니다.
      </p>
    </div>
  );
}
