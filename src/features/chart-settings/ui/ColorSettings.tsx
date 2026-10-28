"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import {
  useColumns,
  useDatasetStatus,
  useLegendValues,
} from "@/shared/api/queries";
import { legendColumnOf } from "@/shared/config/chart-kinds";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { colorName, defaultLegendColor } from "@/shared/lib/palette";
import { linkButton } from "@/shared/ui/button";
import { ColorPickerButton } from "@/shared/ui/ColorPickerButton";
import { ColorSwatches } from "@/shared/ui/ColorSwatches";
import { LegendListSkeleton } from "@/shared/ui/LegendListSkeleton";
import { settingsStyles } from "@/shared/ui/settings-styles";
import type { CommonSettingsForm } from "../model/common-settings-form";

const s = settingsStyles();

const messages = defineMessages({
  ko: {
    baseColor: "기본 색",
    legendColors: (column: string) => `범례 값별 색 · ${column}`,
    waiting: "데이터가 준비되면 legend 값이 표시됩니다.",
    changeColor: (value: string) => `${value} 색 바꾸기`,
    reset: "기본 색으로 되돌리기",
  },
  en: {
    baseColor: "Base color",
    legendColors: (column: string) => `Colors by legend value · ${column}`,
    waiting: "Legend values appear when the data is ready.",
    changeColor: (value: string) => `Change ${value} color`,
    reset: "Reset to default colors",
  },
});

/**
 * 전체 설정 · 팔레트의 기본 색. legend가 없으면 한 가지 색, 있으면 legend 값별 기본 색을 바꾼다.
 * 팝업의 폼 값만 바꾸고, 확인을 누르면 다음 draw에 쓸 설정이 된다.
 */
export function ColorSettings({ readOnly }: { readOnly: boolean }) {
  const text = useT(messages);
  const draft = useWorkspace((s) => s.draft);
  const { control, setValue } = useFormContext<CommonSettingsForm>();
  const [color, legendColors] = useWatch({
    control,
    name: ["color", "legendColors"],
  });
  const common = { color, legendColors };
  const change = (next: typeof common) => {
    setValue("color", next.color, { shouldDirty: true });
    setValue("legendColors", next.legendColors, { shouldDirty: true });
  };
  const dataset = useDatasetStatus(draft.dataset);
  const columns = useColumns(draft.dataset);
  // legend 컬럼을 쓰지 않는 차트(sankey)는 남아 있는 legend 값을 보이지 않는다.
  const legend = legendColumnOf(draft);
  const legendValues = useLegendValues(
    draft.dataset,
    legend,
    dataset.data?.state === "ready",
  );

  const legendColorOf = (value: string, index: number) =>
    common.legendColors?.[value] ?? defaultLegendColor(index);

  return (
    <div className={s.section()}>
      {legend === null ? (
        <>
          <h4 className={s.heading()}>{text.baseColor}</h4>
          <ColorSwatches
            value={common.color}
            disabled={readOnly}
            onSelect={(color) => change({ ...common, color })}
          />
          <p className="text-xs text-fg-muted">{colorName(common.color)}</p>
        </>
      ) : (
        <>
          <h4 className={s.heading()}>
            {text.legendColors(columns.label(legend))}
          </h4>
          {legendValues.isPending &&
            (dataset.data?.state === "ready" ? (
              <LegendListSkeleton />
            ) : (
              <p className="text-xs text-fg-muted">{text.waiting}</p>
            ))}
          <ul className={s.legendList()}>
            {legendValues.data?.values.map((value, i) => {
              const color = legendColorOf(value, i);
              return (
                <li key={value} className={s.legendItem()}>
                  <ColorPickerButton
                    className={s.legendSwatch()}
                    style={{ background: color }}
                    color={color}
                    label={text.changeColor(value)}
                    disabled={readOnly}
                    onCommit={(next) =>
                      change({
                        ...common,
                        legendColors: {
                          ...common.legendColors,
                          [value]: next,
                        },
                      })
                    }
                  />
                  <span>{value}</span>
                </li>
              );
            })}
          </ul>
          {common.legendColors && !readOnly && (
            <button
              type="button"
              className={linkButton()}
              onClick={() => change({ ...common, legendColors: undefined })}
            >
              {text.reset}
            </button>
          )}
        </>
      )}
    </div>
  );
}
