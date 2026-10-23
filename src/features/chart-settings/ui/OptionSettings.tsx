"use client";

import {
  Calculator,
  Crosshair,
  Grid3x3,
  Hash,
  ListChecks,
  type LucideIcon,
  Maximize2,
  MessageSquareText,
  Paintbrush,
  Shapes,
  Sigma,
  Square,
  Tag,
  TrendingUp,
  Type,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  mergeOptions,
  type OptionSection,
} from "@/entities/chart/model/chart-options";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import type { CommonProps } from "@/shared/api/types";
import { settingsStyles } from "@/shared/ui/settings-styles";
import { hasSection, removeSection } from "../model/option-fields";
import { useChangeCommon } from "../model/use-change-common";
import { OptionSectionForm } from "./OptionSectionForm";

const s = settingsStyles();

export const SECTION_ICONS: Record<OptionSection, LucideIcon> = {
  title: Type,
  axes: Grid3x3,
  legend: ListChecks,
  panel: Square,
  palette: Paintbrush,
  shape: Shapes,
  size: Maximize2,
  pointLabel: Tag,
  score: Sigma,
  prediction: TrendingUp,
  value: Hash,
  focus: Crosshair,
  tooltip: MessageSquareText,
  expression: Calculator,
};

/**
 * 전체 설정 · 차트 속성 구역 하나. 공통 속성의 options에 저장하고, 바로 다시 그리는 규칙은 useChangeCommon을 따른다
 * (item에 따로 정한 속성은 모두 덮어쓴다).
 */
export function CommonOptionSettings({
  section,
  part,
  supported,
  children,
}: {
  section: OptionSection;
  /** 하위 항목이 있는 구역(축)에서 보일 항목 */
  part?: string;
  /** false면 이 차트가 쓰지 않는 구역이라 children(같은 구역의 기존 설정)만 보인다. */
  supported: boolean;
  children?: ReactNode;
}) {
  const readOnly = useWorkspace((s) => s.readOnly);
  const { common, change, pending, appliesToCurrent } = useChangeCommon();
  const patch = common.options as ChartOptionsPatch | undefined;
  const save = (options: ChartOptionsPatch | undefined) =>
    change({ ...common, options: options as CommonProps["options"] });

  return (
    <div className={s.popoverBody()}>
      <OptionSectionForm
        section={section}
        part={part}
        resolved={mergeOptions<ChartOptions>(DEFAULT_OPTIONS, patch)}
        patch={patch}
        disabled={readOnly || pending}
        onChange={save}
        onReset={
          hasSection(patch, section)
            ? () => save(removeSection(patch, section))
            : undefined
        }
        resetLabel="기본값으로 되돌리기"
        showFields={supported}
      >
        {children}
      </OptionSectionForm>
      <p className="text-xs text-fg-muted">
        {appliesToCurrent
          ? "바꾸면 전체를 다시 그리고, item별로 정한 속성은 모두 공통 속성으로 바뀝니다."
          : "다음 draw에 적용됩니다."}
      </p>
    </div>
  );
}
