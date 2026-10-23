"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useColumns } from "@/shared/api/queries";
import { settingsStyles } from "@/shared/ui/settings-styles";
import type { CommonSettingsForm } from "../model/common-settings-form";
import { settingsDialog } from "./settings-dialog-styles";

const sd = settingsDialog();
const s = settingsStyles();

/** 전체 설정 · 제목의 연결 문자: split 조합 이름을 이을 기호. 확인을 누르면 다음 draw에 적용된다. */
export function SplitSettings({ readOnly }: { readOnly: boolean }) {
  const draft = useWorkspace((s) => s.draft);
  const columns = useColumns(draft.dataset);
  const { control, register } = useFormContext<CommonSettingsForm>();
  const separator = useWatch({ control, name: "splitSeparator" });
  const names =
    draft.splitBy.length > 0
      ? draft.splitBy.map(columns.label)
      : ["공장", "라인", "설비"];

  return (
    <div className={s.section()}>
      <h4 className={s.heading()}>연결 문자</h4>
      <label className={sd.row()}>
        <span>기호</span>
        <input
          className={sd.input()}
          maxLength={5}
          disabled={readOnly}
          {...register("splitSeparator")}
        />
      </label>
      <p className="text-xs text-fg-muted">
        예: {names.join(separator)}
        {draft.splitBy.length === 0 &&
          " (split by를 고르면 그 컬럼으로 보입니다)"}
      </p>
      <p className="text-xs text-fg-muted">다음 draw에 적용됩니다.</p>
    </div>
  );
}
