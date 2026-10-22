"use client";

import { legendColumnOf } from "@/entities/chart/model/chart-kinds";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import {
  useColumns,
  useDatasetStatus,
  useLegendValues,
} from "@/shared/api/queries";
import { colorName, defaultLegendColor } from "@/shared/lib/palette";
import { ColorPickerButton } from "@/shared/ui/ColorPickerButton";
import { ColorSwatches } from "@/shared/ui/ColorSwatches";
import { LegendListSkeleton } from "@/shared/ui/LegendListSkeleton";
import styles from "@/shared/ui/workspace.module.css";
import { useChangeCommon } from "../model/use-change-common";
import settingsStyles from "./SettingsDialog.module.css";

/**
 * 전체 설정 · 팔레트의 기본 색. legend가 없으면 한 가지 색, 있으면 legend 값별 기본 색을 바꾼다.
 * 바로 다시 그리는 규칙은 useChangeCommon을 따른다.
 */
export function ColorSettings() {
  const draft = useWorkspace((s) => s.draft);
  const readOnly = useWorkspace((s) => s.readOnly);
  const dataset = useDatasetStatus(draft.dataset);
  const columns = useColumns(draft.dataset);
  // legend 컬럼을 쓰지 않는 차트(sankey)는 남아 있는 legend 값을 보이지 않는다.
  const legend = legendColumnOf(draft);
  const legendValues = useLegendValues(
    draft.dataset,
    legend,
    dataset.data?.state === "ready",
  );
  const { change, pending } = useChangeCommon();

  const legendColorOf = (value: string, index: number) =>
    draft.common.legendColors?.[value] ?? defaultLegendColor(index);

  return (
    <div className={settingsStyles.section}>
      {legend === null ? (
        <>
          <h4 className={settingsStyles.heading}>기본 색</h4>
          <ColorSwatches
            value={draft.common.color}
            disabled={readOnly || pending}
            onSelect={(color) => change({ ...draft.common, color })}
          />
          <p className={styles.muted}>{colorName(draft.common.color)}</p>
        </>
      ) : (
        <>
          <h4 className={settingsStyles.heading}>
            범례 값별 색 · {columns.label(legend)}
          </h4>
          {legendValues.isPending &&
            (dataset.data?.state === "ready" ? (
              <LegendListSkeleton />
            ) : (
              <p className={styles.muted}>
                데이터가 준비되면 legend 값이 표시됩니다.
              </p>
            ))}
          <ul className={styles.legendList}>
            {legendValues.data?.values.map((value, i) => {
              const color = legendColorOf(value, i);
              return (
                <li key={value}>
                  <ColorPickerButton
                    className={styles.legendSwatch}
                    style={{ background: color }}
                    color={color}
                    label={`${value} 색 바꾸기`}
                    disabled={readOnly || pending}
                    onCommit={(next) =>
                      change({
                        ...draft.common,
                        legendColors: {
                          ...draft.common.legendColors,
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
          {draft.common.legendColors && !readOnly && (
            <button
              type="button"
              className={styles.linkButton}
              disabled={pending}
              onClick={() =>
                change({ ...draft.common, legendColors: undefined })
              }
            >
              기본 색으로 되돌리기
            </button>
          )}
        </>
      )}
    </div>
  );
}
