"use client";

import { useMutation } from "@tanstack/react-query";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import {
  useColumns,
  useDatasetStatus,
  useLegendValues,
} from "@/shared/api/queries";
import type { CommonProps } from "@/shared/api/types";
import { colorName, defaultLegendColor } from "@/shared/lib/palette";
import { ColorPickerButton } from "@/shared/ui/ColorPickerButton";
import { ColorSwatches } from "@/shared/ui/ColorSwatches";
import styles from "@/shared/ui/workspace.module.css";
import settingsStyles from "./SettingsDialog.module.css";

/**
 * 전체 설정 · 색상. legend가 없으면 한 가지 색, 있으면 legend 값별 기본 색을 바꾼다.
 * 이미 그린 차트가 있으면 바꾸는 즉시 전체를 다시 그리고 item 개별 색은 모두 덮어쓴다.
 * 아직 그리지 않았으면 다음 draw에 쓰일 설정만 바꾼다.
 */
export function ColorSettings() {
  const draft = useWorkspace((s) => s.draft);
  const current = useWorkspace((s) => s.current);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const replaceJob = useWorkspace((s) => s.replaceJob);
  const notify = useWorkspace((s) => s.notify);
  const readOnly = useWorkspace((s) => s.readOnly);
  const dataset = useDatasetStatus(draft.rows);
  const columns = useColumns(draft.rows);
  const legendValues = useLegendValues(
    draft.rows,
    draft.legend,
    dataset.data?.state === "ready",
  );
  // 그린 차트와 같은 legend를 고른 상태에서만 바로 다시 그린다.
  const appliesToCurrent =
    current !== undefined &&
    current.spec.legend === draft.legend &&
    current.spec.rows === draft.rows;

  const apply = useMutation({
    mutationFn: (common: CommonProps) => {
      if (!current) throw new Error("no chart");
      return api.updateCommon(current.chartId, common);
    },
    onSuccess: ({ jobId }, common) => {
      if (current) replaceJob(jobId, { ...current.spec, common });
    },
    onError: (err) => notify(err.message),
  });

  const change = (common: CommonProps) => {
    updateDraft({ common });
    if (appliesToCurrent) apply.mutate(common);
  };

  const legendColorOf = (value: string, index: number) =>
    draft.common.legendColors?.[value] ?? defaultLegendColor(index);

  return (
    <div className={settingsStyles.section}>
      {draft.legend === null ? (
        <>
          <h3 className={settingsStyles.heading}>공통 색상</h3>
          <ColorSwatches
            value={draft.common.color}
            disabled={readOnly || apply.isPending}
            onSelect={(color) => change({ ...draft.common, color })}
          />
          <p className={styles.muted}>{colorName(draft.common.color)}</p>
        </>
      ) : (
        <>
          <h3 className={settingsStyles.heading}>
            legend 색상 · {columns.label(draft.legend)}
          </h3>
          {legendValues.isPending && (
            <p className={styles.muted}>
              데이터가 준비되면 legend 값이 표시됩니다.
            </p>
          )}
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
                    disabled={readOnly || apply.isPending}
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
              disabled={apply.isPending}
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
