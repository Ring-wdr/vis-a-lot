"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useColumns } from "@/shared/api/queries";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { settingsStyles } from "@/shared/ui/settings-styles";
import type { CommonSettingsForm } from "../model/common-settings-form";
import { settingsDialog } from "./settings-dialog-styles";

const sd = settingsDialog();
const s = settingsStyles();

const messages = defineMessages({
  ko: {
    sampleNames: ["공장", "라인", "설비"],
    heading: "연결 문자",
    symbol: "기호",
    example: (names: string) => `예: ${names}`,
    pickSplit: " (split by를 고르면 그 컬럼으로 보입니다)",
    nextDraw: "다음 draw에 적용됩니다.",
  },
  en: {
    sampleNames: ["Plant", "Line", "Machine"],
    heading: "Separator",
    symbol: "Symbol",
    example: (names: string) => `e.g. ${names}`,
    pickSplit: " (pick split by to see those columns)",
    nextDraw: "Applies on the next draw.",
  },
});

/** 전체 설정 · 제목의 연결 문자: split 조합 이름을 이을 기호. 확인을 누르면 다음 draw에 적용된다. */
export function SplitSettings({ readOnly }: { readOnly: boolean }) {
  const text = useT(messages);
  const draft = useWorkspace((s) => s.draft);
  const columns = useColumns(draft.dataset);
  const { control, register } = useFormContext<CommonSettingsForm>();
  const separator = useWatch({ control, name: "splitSeparator" });
  const names =
    draft.splitBy.length > 0
      ? draft.splitBy.map(columns.label)
      : text.sampleNames;

  return (
    <div className={s.section()}>
      <h4 className={s.heading()}>{text.heading}</h4>
      <label className={sd.row()}>
        <span>{text.symbol}</span>
        <input
          className={sd.input()}
          maxLength={5}
          disabled={readOnly}
          {...register("splitSeparator")}
        />
      </label>
      <p className="text-xs text-fg-muted">
        {text.example(names.join(separator))}
        {draft.splitBy.length === 0 && text.pickSplit}
      </p>
      <p className="text-xs text-fg-muted">{text.nextDraw}</p>
    </div>
  );
}
