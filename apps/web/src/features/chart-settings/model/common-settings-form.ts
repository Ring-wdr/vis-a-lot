import type { ChartOptions } from "@/entities/chart/model/chart-options";
import type { CommonProps, LegendPosition } from "@/shared/api/types";
import { buildPatch } from "./option-fields";
import type { OptionsFormValues } from "./options-form";

/**
 * 전체 설정 팝업의 폼 값. 열 때 지금 값을 넣고, 확인을 누를 때 다음 draw에 쓸 설정(draft)으로 옮긴다.
 * 공통 속성은 draw를 눌러야 차트에 적용된다. 가까운 점 표시는 화면 표시라 확인하면 바로 바뀐다.
 */
export type CommonSettingsForm = OptionsFormValues & {
  color: string;
  /** legend 값별 기본 색. 값 이름이 임의의 글자라 필드 하나(객체)로 다룬다. 없으면 팔레트 순서 */
  legendColors: Record<string, string> | undefined;
  legendPosition: LegendPosition | undefined;
  splitSeparator: string;
  showNearest: boolean;
};

/** 열 때의 폼 값. 차트 속성은 기본값 위에 공통 속성을 덮은 값(opened)을 보인다. */
export function commonFormValues(
  common: CommonProps,
  opened: ChartOptions,
  extra: Pick<CommonSettingsForm, "splitSeparator" | "showNearest">,
): CommonSettingsForm {
  return {
    options: opened,
    resetSections: [],
    color: common.color,
    legendColors: common.legendColors,
    legendPosition: common.legendPosition,
    ...extra,
  };
}

/** 폼 값에서 저장할 공통 속성. 차트 속성은 기본값(base)을 따르고 바꾼 것만 남긴다. */
export function commonFromForm(
  values: CommonSettingsForm,
  {
    opened,
    original,
    base,
  }: {
    opened: ChartOptions;
    original: CommonProps;
    base: ChartOptions;
  },
): CommonProps {
  return {
    ...original,
    color: values.color,
    legendColors: values.legendColors,
    legendPosition: values.legendPosition,
    options: buildPatch({
      original: original.options,
      opened,
      base,
      values: values.options,
      resets: values.resetSections,
    }) as CommonProps["options"],
  };
}
