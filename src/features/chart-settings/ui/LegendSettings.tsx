"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { useDefaultLegendPosition } from "@/entities/chart/model/chart-options";
import { useColumns } from "@/shared/api/queries";
import type { ChartSpec } from "@/shared/api/types";
import { drawsLegend, legendColumnOf } from "@/shared/config/chart-kinds";
import { LegendPositionPicker } from "@/shared/ui/LegendPositionPicker";
import { settingsStyles } from "@/shared/ui/settings-styles";
import type { CommonSettingsForm } from "../model/common-settings-form";

const s = settingsStyles();

/**
 * 전체 설정 · 범례 위치. 모든 item에 적용되고 item에 따로 정한 위치는 덮어쓴다.
 * 팝업의 폼 값만 바꾸고, 확인을 누르면 다음 draw에 쓸 설정이 된다.
 */
export function LegendSettings({
  draft,
  readOnly,
}: {
  /** 다음 draw에 쓸 설정. 이 구역은 store를 읽지 않고 여는 쪽(SettingsDialog)이 넘긴다. */
  draft: ChartSpec;
  readOnly: boolean;
}) {
  const columns = useColumns(draft.dataset);
  const { control, setValue } = useFormContext<CommonSettingsForm>();
  const legendPosition = useWatch({ control, name: "legendPosition" });
  const legend = legendColumnOf(draft);
  const fallback = useDefaultLegendPosition(draft.chartType);

  return (
    <div className={s.section()}>
      <h4 className={s.heading()}>
        위치
        {legend !== null && ` · ${columns.label(legend)}`}
      </h4>
      <LegendPositionPicker
        value={legendPosition ?? fallback}
        disabled={readOnly}
        onSelect={(next) =>
          setValue("legendPosition", next, { shouldDirty: true })
        }
      />
      {!drawsLegend(draft) && (
        <p className="text-xs text-fg-muted">
          legend를 고르면 이 위치에 그립니다. 지금은 legend가 없습니다.
        </p>
      )}
    </div>
  );
}
