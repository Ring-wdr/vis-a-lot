"use client";

import {
  drawsLegend,
  legendColumnOf,
} from "@/entities/chart/model/chart-kinds";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useColumns } from "@/shared/api/queries";
import { LegendPositionPicker } from "@/shared/ui/LegendPositionPicker";
import styles from "@/shared/ui/workspace.module.css";
import { useChangeCommon } from "../model/use-change-common";
import settingsStyles from "./SettingsDialog.module.css";

/**
 * 전체 설정 · legend 위치. 모든 item에 적용되고 item에 따로 정한 위치는 덮어쓴다.
 * 바로 다시 그리는 규칙은 useChangeCommon을 따른다.
 */
export function LegendSettings() {
  const draft = useWorkspace((s) => s.draft);
  const readOnly = useWorkspace((s) => s.readOnly);
  const columns = useColumns(draft.dataset);
  const { common, change, pending, appliesToCurrent } = useChangeCommon();
  const legend = legendColumnOf(draft);

  return (
    <div className={settingsStyles.section}>
      <h3 className={settingsStyles.heading}>
        legend 위치
        {legend !== null && ` · ${columns.label(legend)}`}
      </h3>
      <LegendPositionPicker
        value={common.legendPosition ?? "top"}
        disabled={readOnly || pending}
        onSelect={(legendPosition) => change({ ...common, legendPosition })}
      />
      <p className={styles.muted}>
        {!drawsLegend(draft)
          ? "legend를 고르면 이 위치에 그립니다. 지금은 legend가 없습니다."
          : appliesToCurrent
            ? "바꾸면 전체를 다시 그리고, item별로 정한 위치는 모두 공통 위치로 바뀝니다."
            : "다음 draw에 적용됩니다."}
      </p>
    </div>
  );
}
