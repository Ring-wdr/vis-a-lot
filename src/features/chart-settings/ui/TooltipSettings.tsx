"use client";

import { useFormContext } from "react-hook-form";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { settingsStyles } from "@/shared/ui/settings-styles";
import type { CommonSettingsForm } from "../model/common-settings-form";
import { settingsDialog } from "./settings-dialog-styles";

const sd = settingsDialog();
const s = settingsStyles();

const messages = defineMessages({
  ko: {
    heading: "가까운 점",
    show: "가까운 점 표시",
    note: "커서에서 가장 가까운 점의 x, y와 tooltip 컬럼을 보여줍니다. 점은 픽셀 하나에 하나씩 줄인 점 중에서 찾습니다. 끄면 커서 위치의 x, y만 보여주고, tooltip 컬럼도 가까운 점의 값이라 함께 숨겨집니다.",
  },
  en: {
    heading: "Nearest point",
    show: "Show nearest point",
    note: "Shows x, y and tooltip columns of the point nearest the cursor, searched among points reduced to one per pixel. When off, only the cursor's x, y are shown; tooltip columns are hidden too since they come from the nearest point.",
  },
});

/**
 * 전체 설정 · 툴팁의 가까운 점 표시 (scatter, line). 화면 표시만 바꾸므로 확인을 누르면 다시 그리지 않고 적용된다.
 * 다시 보기(history)에서도 바꿀 수 있다.
 */
export function TooltipSettings() {
  const text = useT(messages);
  const { register } = useFormContext<CommonSettingsForm>();
  const chartType = useWorkspace((s) => s.draft.chartType);
  // 가까운 점은 점을 그리는 차트(scatter, line)의 툴팁에만 있다.
  if (chartType !== "scatter" && chartType !== "line") return null;

  return (
    <div className={s.section()}>
      <h4 className={s.heading()}>{text.heading}</h4>
      <label className={sd.row()}>
        <input type="checkbox" {...register("showNearest")} />
        <span>{text.show}</span>
      </label>
      <p className="text-xs text-fg-muted">{text.note}</p>
    </div>
  );
}
