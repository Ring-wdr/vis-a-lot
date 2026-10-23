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
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  type OptionSection,
} from "@/entities/chart/model/chart-options";
import { settingsStyles } from "@/shared/ui/settings-styles";
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
 * 전체 설정 · 차트 속성 구역 하나. 팝업의 폼 값(options)만 바꾸고, 확인을 누르면 다음 draw에 쓸
 * 공통 속성이 된다. 되돌리면 기본값을 따른다.
 */
export function CommonOptionSettings({
  section,
  part,
  supported,
  original,
  readOnly,
  children,
}: {
  section: OptionSection;
  /** 하위 항목이 있는 구역(축)에서 보일 항목 */
  part?: string;
  /** false면 이 차트가 쓰지 않는 구역이라 children(같은 구역의 기존 설정)만 보인다. */
  supported: boolean;
  /** 저장돼 있던 공통 속성의 차트 속성 */
  original: ChartOptionsPatch | undefined;
  readOnly: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={s.popoverBody()}>
      <OptionSectionForm
        section={section}
        part={part}
        original={original}
        base={DEFAULT_OPTIONS}
        disabled={readOnly}
        resetLabel="기본값으로 되돌리기"
        showFields={supported}
      >
        {children}
      </OptionSectionForm>
      <p className="text-xs text-fg-muted">
        확인을 누르면 다음 draw에 적용됩니다. 그리면 item별로 정한 속성은 모두
        공통 속성으로 바뀝니다.
      </p>
    </div>
  );
}
