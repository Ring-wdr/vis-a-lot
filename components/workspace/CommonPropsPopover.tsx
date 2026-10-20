"use client";

import { useMutation } from "@tanstack/react-query";
import { useAlert } from "@/lib/alert-store";
import { api } from "@/lib/api";
import { colorName } from "@/lib/palette";
import { useWorkspace } from "@/lib/workspace-store";
import { ColorSwatches } from "./ColorSwatches";
import { Popover } from "./Popover";
import styles from "./Workspace.module.css";

/**
 * 공통 속성. 이미 그린 차트가 있으면 바꾸는 즉시 전체를 다시 그리고,
 * 개별 속성은 모두 덮어쓴다. 아직 그리지 않았으면 다음 draw에 쓰일 설정만 바꾼다.
 */
export function CommonPropsPopover() {
  const draft = useWorkspace((s) => s.draft);
  const current = useWorkspace((s) => s.current);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const replaceJob = useWorkspace((s) => s.replaceJob);
  const showAlert = useAlert((s) => s.show);

  const apply = useMutation({
    mutationFn: (color: string) => {
      if (!current) throw new Error("no chart");
      return api.updateCommon(current.chartId, { color });
    },
    onSuccess: ({ jobId }, color) => {
      if (current) {
        replaceJob(jobId, { ...current.spec, common: { color } });
      }
    },
    onError: (err) => showAlert(err.message),
  });

  return (
    <Popover
      triggerClassName={styles.secondaryButton}
      trigger={
        <>
          <span
            className={styles.colorDot}
            style={{ background: draft.common.color }}
          />
          공통 속성
        </>
      }
    >
      {(close) => (
        <div className={styles.popoverBody}>
          <strong>공통 색상</strong>
          <ColorSwatches
            value={draft.common.color}
            disabled={apply.isPending}
            onSelect={(color) => {
              updateDraft({ common: { ...draft.common, color } });
              if (current) apply.mutate(color);
              close();
            }}
          />
          <p className={styles.muted}>
            {colorName(draft.common.color)}
            {current
              ? " · 바꾸면 전체를 다시 그리고, item별 개별 색상은 모두 공통 색으로 바뀝니다."
              : " · 다음 draw에 적용됩니다."}
          </p>
        </div>
      )}
    </Popover>
  );
}
