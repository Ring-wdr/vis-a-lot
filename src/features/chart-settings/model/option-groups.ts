// 차트 속성 패널의 탭. 원본 구역은 그대로 두고 성격에 따라 두 탭으로만 묶는다.

import type { OptionSection } from "@/entities/chart/model/chart-options";

export type OptionTab = {
  id: "look" | "analysis";
  label: string;
  sections: readonly OptionSection[];
};

export const OPTION_TABS: readonly OptionTab[] = [
  {
    id: "look",
    label: "모양",
    sections: [
      "title",
      "axes",
      "legend",
      "panel",
      "palette",
      "shape",
      "size",
      "pointLabel",
      "tooltip",
    ],
  },
  {
    id: "analysis",
    label: "분석",
    sections: ["score", "prediction", "value", "focus", "expression"],
  },
];

/** 탭마다 보일 구역. 구역이 하나도 없는 탭은 뺀다. */
export function visibleTabs(shown: (section: OptionSection) => boolean) {
  return OPTION_TABS.map((tab) => ({
    ...tab,
    sections: tab.sections.filter(shown),
  })).filter((tab) => tab.sections.length > 0);
}
