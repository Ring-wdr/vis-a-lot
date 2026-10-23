"use client";

import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useColumns } from "@/shared/api/queries";
import { settingsDialog } from "./settings-dialog-styles";

const sd = settingsDialog();

/** 전체 설정 · 제목의 연결 문자: split 조합 이름을 이을 기호. 다음 draw에 적용된다. */
export function SplitSettings() {
  const draft = useWorkspace((s) => s.draft);
  const readOnly = useWorkspace((s) => s.readOnly);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const columns = useColumns(draft.dataset);
  const names =
    draft.splitBy.length > 0
      ? draft.splitBy.map(columns.label)
      : ["공장", "라인", "설비"];

  return (
    <div className={sd.section()}>
      <h4 className={sd.heading()}>연결 문자</h4>
      <label className={sd.row()}>
        <span>기호</span>
        <input
          className={sd.input()}
          value={draft.splitSeparator}
          maxLength={5}
          disabled={readOnly}
          onChange={(e) => updateDraft({ splitSeparator: e.target.value })}
        />
      </label>
      <p className="text-fg-muted text-xs">
        예: {names.join(draft.splitSeparator)}
        {draft.splitBy.length === 0 &&
          " (split by를 고르면 그 컬럼으로 보입니다)"}
      </p>
      <p className="text-fg-muted text-xs">다음 draw에 적용됩니다.</p>
    </div>
  );
}
