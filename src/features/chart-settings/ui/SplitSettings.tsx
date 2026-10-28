"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { useFormContext, useWatch } from "react-hook-form";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useColumns } from "@/shared/api/queries";
import { settingsStyles } from "@/shared/ui/settings-styles";
import "../config/messages";
import type { CommonSettingsForm } from "../model/common-settings-form";
import { settingsDialog } from "./settings-dialog-styles";

const sd = settingsDialog();
const s = settingsStyles();

/** 전체 설정 · 제목의 연결 문자: split 조합 이름을 이을 기호. 확인을 누르면 다음 draw에 적용된다. */
export function SplitSettings({ readOnly }: { readOnly: boolean }) {
  const { t } = useLingui();
  const draft = useWorkspace((s) => s.draft);
  const columns = useColumns(draft.dataset);
  const { control, register } = useFormContext<CommonSettingsForm>();
  const separator = useWatch({ control, name: "splitSeparator" });
  const names =
    draft.splitBy.length > 0
      ? draft.splitBy.map(columns.label)
      : [
          t({ message: "공장", context: "split name example" }),
          t({ message: "라인", context: "split name example" }),
          t({ message: "설비", context: "split name example" }),
        ];
  const example = names.join(separator);

  return (
    <div className={s.section()}>
      <h4 className={s.heading()}>
        <Trans>연결 문자</Trans>
      </h4>
      <label className={sd.row()}>
        <span>
          <Trans context="split separator">기호</Trans>
        </span>
        <input
          className={sd.input()}
          maxLength={5}
          disabled={readOnly}
          {...register("splitSeparator")}
        />
      </label>
      <p className="text-xs text-fg-muted">
        {draft.splitBy.length === 0 ? (
          <Trans>예: {example} (split by를 고르면 그 컬럼으로 보입니다)</Trans>
        ) : (
          <Trans>예: {example}</Trans>
        )}
      </p>
      <p className="text-xs text-fg-muted">
        <Trans>다음 draw에 적용됩니다.</Trans>
      </p>
    </div>
  );
}
