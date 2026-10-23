"use client";

import { useFormContext, useWatch } from "react-hook-form";
import type {
  ChartOptions,
  ChartOptionsPatch,
  OptionSection,
} from "@/entities/chart/model/chart-options";
import { buildPatch } from "./option-fields";

/**
 * 차트 속성 폼 값. 화면에는 기본값·공통·item 값을 합친 전체 값(options)을 보이고,
 * 따르기로 되돌린 구역은 resetSections에 둔다. 저장할 부분 값은 buildPatch로 만든다.
 * 전체 설정과 item 속성 팝업의 폼이 이 모양을 함께 갖는다.
 */
export type OptionsFormValues = {
  options: ChartOptions;
  resetSections: OptionSection[];
};

/** 따르기 기준: 저장돼 있던 부분 값과 되돌렸을 때의 값 */
export type OptionsBase = {
  original: ChartOptionsPatch | undefined;
  base: ChartOptions;
};

/** 지금 폼 값으로 만든 부분 값. 메뉴 표시(•)와 되돌리기 버튼이 쓴다. */
export function useOptionsPatch({ original, base }: OptionsBase) {
  const { control, formState } = useFormContext<OptionsFormValues>();
  const [values, resets] = useWatch({
    control,
    name: ["options", "resetSections"],
  });
  return buildPatch({
    original,
    opened: formState.defaultValues?.options as ChartOptions,
    base,
    values,
    resets,
  });
}
