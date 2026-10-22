"use client";

import {
  type ChartOptions,
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  mergeOptions,
  type OptionSection,
  supportsOption,
} from "@/entities/chart/model/chart-options";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import type { CommonProps } from "@/shared/api/types";
import styles from "@/shared/ui/workspace.module.css";
import { useChangeCommon } from "../model/use-change-common";
import { ColorSettings } from "./ColorSettings";
import { LegendSettings } from "./LegendSettings";
import { OptionsAccordion } from "./OptionsAccordion";
import { SplitSettings } from "./SplitSettings";
import { TooltipSettings } from "./TooltipSettings";

/**
 * 속성 모델(common.options) 밖에 저장하지만 원본에서 같은 구역에 있는 설정. 그 구역의 필드 표 위에 붙인다.
 * 저장 위치는 예전 history·공유 링크와 맞추려고 그대로 둔다.
 */
const SECTION_EXTRAS: Partial<Record<OptionSection, React.ReactNode>> = {
  // Title · Concat String: split 조합 이름을 잇는 문자 (spec.splitSeparator)
  title: <SplitSettings />,
  // Palette · Default Color, Name/Color (common.color, common.legendColors)
  palette: <ColorSettings />,
  // Legend · Position (common.legendPosition)
  legend: <LegendSettings />,
  // 화면 툴팁의 가까운 점 표시 (작업 화면 상태)
  tooltip: <TooltipSettings />,
};

/** 차트가 이 구역의 속성을 쓰지 않아도 보이는 구역. legend 위치는 legend를 그리는 모든 차트에 쓴다. */
const ALWAYS_SHOWN: readonly OptionSection[] = ["legend"];

/** 공통 속성 패널에 보일 구역인지 */
export function commonSectionShown(
  chartType: Parameters<typeof supportsOption>[0],
  section: OptionSection,
) {
  return supportsOption(chartType, section) || ALWAYS_SHOWN.includes(section);
}

/**
 * 공통 속성. common.options에 저장하고, 바로 다시 그리는 규칙은 useChangeCommon을 따른다
 * (item에 따로 정한 속성은 모두 덮어쓴다).
 */
export function CommonOptions({
  sections,
}: {
  sections: readonly OptionSection[];
}) {
  const readOnly = useWorkspace((s) => s.readOnly);
  const chartType = useWorkspace((s) => s.draft.chartType);
  const { common, change, pending, appliesToCurrent } = useChangeCommon();
  const patch = common.options as ChartOptionsPatch | undefined;

  return (
    <>
      <OptionsAccordion
        sections={sections}
        supported={(s) => supportsOption(chartType, s)}
        resolved={mergeOptions<ChartOptions>(DEFAULT_OPTIONS, patch)}
        patch={patch}
        disabled={readOnly}
        onChange={(options) =>
          change({ ...common, options: options as CommonProps["options"] })
        }
        resetLabel="기본값으로 되돌리기"
        extras={SECTION_EXTRAS}
      />
      <p className={styles.muted}>
        {!appliesToCurrent
          ? "다음 draw에 적용됩니다."
          : pending
            ? "바꾼 값을 모아 보내는 중입니다. 보고 있는 페이지부터 다시 그립니다."
            : "바꾸면 보고 있는 페이지부터 다시 그리고, 다른 페이지는 볼 때 그립니다. item별로 정한 속성은 모두 공통 속성으로 바뀝니다."}
      </p>
    </>
  );
}
