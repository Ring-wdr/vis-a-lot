"use client";

import {
  defaultLegendPosition,
  drawsLegend,
  legendColumnOf,
} from "@/entities/chart/model/chart-kinds";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useColumns } from "@/shared/api/queries";
import { LegendPositionPicker } from "@/shared/ui/LegendPositionPicker";
import { settingsStyles } from "@/shared/ui/settings-styles";
import { useChangeCommon } from "../model/use-change-common";

const s = settingsStyles();

/**
 * 전체 설정 · 범례 위치. 모든 item에 적용되고 item에 따로 정한 위치는 덮어쓴다.
 * 바로 다시 그리는 규칙은 useChangeCommon을 따른다.
 */
export function LegendSettings() {
  const draft = useWorkspace((s) => s.draft);
  const readOnly = useWorkspace((s) => s.readOnly);
  const columns = useColumns(draft.dataset);
  const { common, change, pending } = useChangeCommon();
  const legend = legendColumnOf(draft);

  return (
    <div className={s.section()}>
      <h4 className={s.heading()}>
        위치
        {legend !== null && ` · ${columns.label(legend)}`}
      </h4>
      <LegendPositionPicker
        value={common.legendPosition ?? defaultLegendPosition(draft.chartType)}
        disabled={readOnly || pending}
        onSelect={(legendPosition) => change({ ...common, legendPosition })}
      />
      {!drawsLegend(draft) && (
        <p className="text-xs text-fg-muted">
          legend를 고르면 이 위치에 그립니다. 지금은 legend가 없습니다.
        </p>
      )}
    </div>
  );
}
