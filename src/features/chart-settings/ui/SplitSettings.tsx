"use client";

import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useColumns } from "@/shared/api/queries";
import styles from "@/shared/ui/workspace.module.css";
import settingsStyles from "./SettingsDialog.module.css";

/** 전체 설정 · split by: 조합 이름을 이을 구분 기호. 다음 draw에 적용된다. */
export function SplitSettings() {
  const draft = useWorkspace((s) => s.draft);
  const readOnly = useWorkspace((s) => s.readOnly);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const columns = useColumns(draft.rows);
  const names =
    draft.splitBy.length > 0
      ? draft.splitBy.map(columns.label)
      : ["공장", "라인", "설비"];

  return (
    <div className={settingsStyles.section}>
      <h3 className={settingsStyles.heading}>구분 기호</h3>
      <label className={settingsStyles.row}>
        <span>기호</span>
        <input
          className={settingsStyles.input}
          value={draft.splitSeparator}
          maxLength={5}
          disabled={readOnly}
          onChange={(e) => updateDraft({ splitSeparator: e.target.value })}
        />
      </label>
      <p className={styles.muted}>
        예: {names.join(draft.splitSeparator)}
        {draft.splitBy.length === 0 &&
          " (split by를 고르면 그 컬럼으로 보입니다)"}
      </p>
      <p className={styles.muted}>다음 draw에 적용됩니다.</p>
    </div>
  );
}
