"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { useFormContext, useWatch } from "react-hook-form";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import {
  useColumns,
  useDatasetStatus,
  useLegendValues,
} from "@/shared/api/queries";
import { legendColumnOf } from "@/shared/config/chart-kinds";
import { colorName, defaultLegendColor } from "@/shared/lib/palette";
import { linkButton } from "@/shared/ui/button";
import { ColorPickerButton } from "@/shared/ui/ColorPickerButton";
import { ColorSwatches } from "@/shared/ui/ColorSwatches";
import { LegendListSkeleton } from "@/shared/ui/LegendListSkeleton";
import { settingsStyles } from "@/shared/ui/settings-styles";
import "../config/messages";
import type { CommonSettingsForm } from "../model/common-settings-form";

const s = settingsStyles();

/**
 * 전체 설정 · 팔레트의 기본 색. legend가 없으면 한 가지 색, 있으면 legend 값별 기본 색을 바꾼다.
 * 팝업의 폼 값만 바꾸고, 확인을 누르면 다음 draw에 쓸 설정이 된다.
 */
export function ColorSettings({ readOnly }: { readOnly: boolean }) {
  const { t } = useLingui();
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

  const column = legend === null ? "" : columns.label(legend);
  const legendColorOf = (value: string, index: number) =>
    common.legendColors?.[value] ?? defaultLegendColor(index);

  return (
    <div className={s.section()}>
      {legend === null ? (
        <>
          <h4 className={s.heading()}>
            <Trans>기본 색</Trans>
          </h4>
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
            <Trans>범례 값별 색 · {column}</Trans>
          </h4>
          {legendValues.isPending &&
            (dataset.data?.state === "ready" ? (
              <LegendListSkeleton />
            ) : (
              <p className="text-xs text-fg-muted">
                <Trans>데이터가 준비되면 legend 값이 표시됩니다.</Trans>
              </p>
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
                    label={t`${value} 색 바꾸기`}
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
              <Trans>기본 색으로 되돌리기</Trans>
            </button>
          )}
        </>
      )}
    </div>
  );
}
