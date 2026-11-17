// 관리선(controlLimit 구역)의 렌더 입력과 metadata 모양.
// 선 목록(options.controlLimit.lines)은 컬럼·함수만 적은 설정이라 렌더러가 그대로 그릴 수 없다.
// job-manager가 item마다 집계 값을 채운 ResolvedLimit[]로 바꿔 렌더 입력(ScatterInput.limits,
// CategoryInput.limits)에 싣고, 렌더러는 DB를 모른 채 이 값만 그린다. 영역·이탈 강조·글자·축 범위 같은
// 전체 설정은 렌더 입력의 options.controlLimit에서 읽는다.
// 렌더러는 Worker에서도 돌므로 이 파일은 options 밖의 것을 import하지 않는다.

import type { LimitAxis, LimitKind, LimitStyle, LimitType } from "./options";

/**
 * 구간 하나의 값: [x0, x1, v] 또는 띠면 [x0, x1, v, v2]. x0..x1은 x 데이터 값(시계열은 epoch ms)으로 적은 구간 경계이고,
 * 구간은 x 전체 범위를 LIMIT_BUCKETS개로 나눈 것 중 값이 있는 것만 x 순으로 담는다 (빈 구간은 빠진다).
 * v는 그 구간의 선 값, v2는 띠의 두 번째 컬럼 값이다. 띠는 두 값이 다 있는 구간만 담는다.
 */
export type LimitStep =
  | [x0: number, x1: number, v: number]
  | [x0: number, x1: number, v: number, v2: number];

/**
 * 값을 채운 관리선 하나. 렌더 입력과 metadata가 같은 값을 쓴다.
 *
 * - 값은 모두 그 축의 데이터 값이다. left는 y 값(bar stack100이면 %), bottom은 x 값(시계열은 epoch ms).
 *   식(expression)을 적용하지 않은 값이며, 로그 축에서 0 이하인 선은 렌더러가 그리지 않는다.
 * - 값을 구하지 못한 선(조회한 행이 없거나 전부 null, 구간별인데 값 있는 구간이 하나도 없음)은 job이 목록에서 뺀다.
 *   그래서 목록의 선은 모두 그릴 수 있다. 순서는 설정의 선 목록 순서다.
 * - 지원하지 않는 차트·하위 차트(controlLimitSupport가 null)면 job이 limits를 싣지 않는다.
 */
export type ResolvedLimit = {
  name: string;
  kind: LimitKind;
  axis: LimitAxis;
  /** 띠는 늘 "none" */
  type: LimitType;
  color: string;
  width: number;
  style: LimitStyle;
} & (
  | {
      /** 값 하나로 그리는 선: 기준선, 구간별이 아닌 컬럼 선·띠 */
      multi: false;
      value: number;
      /** 띠의 두 번째 컬럼 평균. 띠만 있다. */
      value2?: number;
    }
  | {
      /** 구간별 계단선·계단 띠 (left 축만). 이탈은 점이 든 구간의 값과 비교하고, 값이 없는 구간의 점은 판정하지 않는다. */
      multi: true;
      steps: LimitStep[];
    }
);

/** 화면 툴팁이 쓰는 선 하나. 값은 ResolvedLimit과 같다 (구간별이면 value 대신 steps). */
export type LimitMetaLine = {
  name: string;
  axis: LimitAxis;
  type: LimitType;
  value?: number;
  /** 띠의 두 번째 값 */
  value2?: number;
  steps?: LimitStep[];
};

/**
 * ScatterMeta·CategoryMeta의 limits. 그린 선이 하나라도 있을 때만 있다.
 * out은 usl·lsl을 벗어난 점(막대) 수로, 그린 것 기준이다 (끈 legend 값·지운 점은 세지 않는다).
 * 규격 선이 없으면 0이다. 화면은 이 선 값으로 점이 이탈인지 판정한다.
 */
export type LimitsMeta = {
  lines: LimitMetaLine[];
  out: number;
};
