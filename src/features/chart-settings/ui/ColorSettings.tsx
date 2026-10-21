"use client";

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
 * 전체 설정 · 색상. legend가 없으면 한 가지 색, 있으면 legend 값별 기본 색을 바꾼다.
 * 바로 다시 그리는 규칙은 useChangeCommon을 따른다.
 */
export function ColorSettings() {
  const draft = useWorkspace((s) => s.draft);
  const readOnly = useWorkspace((s) => s.readOnly);
  const dataset = useDatasetStatus(draft.rows);
  const columns = useColumns(draft.rows);
  const legendValues = useLegendValues(
    draft.rows,
    draft.legend,
    dataset.data?.state === "ready",
  );
  const { change, pending, appliesToCurrent } = useChangeCommon();

  const legendColorOf = (value: string, index: number) =>
    draft.common.legendColors?.[value] ?? defaultLegendColor(index);

  return (
    <div className={settingsStyles.section}>
      {draft.legend === null ? (
        <>
          <h3 className={settingsStyles.heading}>공통 색상</h3>
          <ColorSwatches
            value={draft.common.color}
            disabled={readOnly || pending}
            onSelect={(color) => change({ ...draft.common, color })}
          />
          <p className={styles.muted}>{colorName(draft.common.color)}</p>
        </>
      ) : (
        <>
          <h3 className={settingsStyles.heading}>
            legend 색상 · {columns.label(draft.legend)}
          </h3>
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
      <p className={styles.muted}>
        {appliesToCurrent
          ? "바꾸면 전체를 다시 그리고, item별 개별 색상은 모두 공통 색으로 바뀝니다."
          : "다음 draw에 적용됩니다."}
      </p>
    </div>
  );
}
