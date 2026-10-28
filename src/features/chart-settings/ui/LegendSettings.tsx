"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { useDefaultLegendPosition } from "@/entities/chart/model/chart-options";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useColumns } from "@/shared/api/queries";
import { drawsLegend, legendColumnOf } from "@/shared/config/chart-kinds";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { LegendPositionPicker } from "@/shared/ui/LegendPositionPicker";
import { settingsStyles } from "@/shared/ui/settings-styles";
import type { CommonSettingsForm } from "../model/common-settings-form";

const s = settingsStyles();

const messages = defineMessages({
  ko: {
    position: "위치",
    noLegend: "legend를 고르면 이 위치에 그립니다. 지금은 legend가 없습니다.",
  },
  en: {
    position: "Position",
    noLegend: "Pick a legend to draw it here. There is no legend now.",
  },
});

/**
 * 전체 설정 · 범례 위치. 모든 item에 적용되고 item에 따로 정한 위치는 덮어쓴다.
 * 팝업의 폼 값만 바꾸고, 확인을 누르면 다음 draw에 쓸 설정이 된다.
 */
export function LegendSettings({ readOnly }: { readOnly: boolean }) {
  const text = useT(messages);
  const draft = useWorkspace((s) => s.draft);
  const columns = useColumns(draft.dataset);
  const { control, setValue } = useFormContext<CommonSettingsForm>();
  const legendPosition = useWatch({ control, name: "legendPosition" });
  const legend = legendColumnOf(draft);
  const fallback = useDefaultLegendPosition(draft.chartType);

  return (
    <div className={s.section()}>
      <h4 className={s.heading()}>
        {text.position}
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
        <p className="text-xs text-fg-muted">{text.noLegend}</p>
      )}
    </div>
  );
}
