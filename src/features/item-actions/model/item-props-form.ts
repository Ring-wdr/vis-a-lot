import type { ItemSettingsChanges, LegendPosition } from "@/shared/api/types";

/**
 * item 속성 팝업 폼 중 item 고유 값. 차트 속성(options)과 함께 한 폼에 들고, 확인을 누르면 한 번에 보낸다.
 * undefined는 바꾸지 않음, null은 공통 속성 따르기다.
 */
export type ItemPropsForm = {
  color: string | null | undefined;
  /** 바꾼 legend 값별 색만. 값 이름이 임의의 글자라 필드 하나(객체)로 다룬다. */
  legendColors: Record<string, string>;
  legendPosition: LegendPosition | null | undefined;
};

export const ITEM_PROPS_UNCHANGED: ItemPropsForm = {
  color: undefined,
  legendColors: {},
  legendPosition: undefined,
};

/** 폼 값에서 서버로 보낼 변경. 바꾼 것만 담는다. */
export function itemPropsChanges(values: ItemPropsForm): ItemSettingsChanges {
  return {
    ...(values.color !== undefined && { color: values.color }),
    ...(Object.keys(values.legendColors).length > 0 && {
      legendColors: values.legendColors,
    }),
    ...(values.legendPosition !== undefined && {
      legendPosition: values.legendPosition,
    }),
  };
}
