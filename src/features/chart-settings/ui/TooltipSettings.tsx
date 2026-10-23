"use client";

import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { settingsDialog } from "./settings-dialog-styles";

const sd = settingsDialog();

/**
 * 전체 설정 · 툴팁의 가까운 점 표시 (scatter, line). 화면 표시만 바꾸므로 다시 그리지 않고 바로 적용된다.
 * 다시 보기(history)에서도 바꿀 수 있다.
 */
export function TooltipSettings() {
  const showNearest = useWorkspace((s) => s.showNearest);
  const setShowNearest = useWorkspace((s) => s.setShowNearest);
  const chartType = useWorkspace((s) => s.draft.chartType);
  // 가까운 점은 점을 그리는 차트(scatter, line)의 툴팁에만 있다.
  if (chartType !== "scatter" && chartType !== "line") return null;

  return (
    <div className={sd.section()}>
      <h4 className={sd.heading()}>가까운 점</h4>
      <label className={sd.row()}>
        <input
          type="checkbox"
          checked={showNearest}
          onChange={(e) => setShowNearest(e.target.checked)}
        />
        <span>가까운 점 표시</span>
      </label>
      <p className="text-xs text-fg-muted">
        커서에서 가장 가까운 점의 x, y와 tooltip 컬럼을 보여줍니다. 점은 픽셀
        하나에 하나씩 줄인 점 중에서 찾습니다. 끄면 커서 위치의 x, y만 보여주고,
        tooltip 컬럼도 가까운 점의 값이라 함께 숨겨집니다.
      </p>
    </div>
  );
}
