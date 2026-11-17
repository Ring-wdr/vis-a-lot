// 관리선 metadata(limits)로 툴팁 줄을 만든다. 서버 호출 없이 선 값만으로 커서가 선 가까이에 있는지,
// 가까운 점(막대)이 규격(USL·LSL)을 벗어났는지 본다. 값은 모두 그 축의 데이터 값(시계열 x는 epoch ms)이다.

import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { AxisMeta, ItemMeta, ScatterMeta } from "@/shared/api/types";
import { formatValue } from "@/shared/lib/format";
import "../config/messages";

type LimitsMeta = NonNullable<ScatterMeta["limits"]>;
type LimitMetaLine = LimitsMeta["lines"][number];
type LimitStep = NonNullable<LimitMetaLine["steps"]>[number];

/** 커서가 선에서 이만큼(PNG px) 안이면 그 선의 이름·값을 툴팁에 더한다. */
export const LIMIT_HIT_PX = 4;

const TEXT = {
  out: msg({ message: "규격 이탈", context: "chart tooltip" }),
};

/** 데이터 값 → PNG 좌표 (한 축). 로그 축에서 0 이하면 NaN */
export function axisToPx(
  axis: AxisMeta,
  start: number,
  length: number,
  value: number,
  flipped: boolean,
) {
  const [lo, hi] = axis.domain;
  let ratio: number;
  if (axis.log && lo > 0 && hi > 0) {
    if (value <= 0) return Number.NaN;
    ratio =
      (Math.log10(value) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
  } else ratio = (value - lo) / (hi - lo);
  return start + (flipped ? 1 - ratio : ratio) * length;
}

/**
 * x가 든 구간. 렌더러(server/render/control-limit.ts stepAt)와 같은 규칙이다: 두 구간이 맞닿은 경계는 오른쪽 구간,
 * 옆이 빈 구간이면 끝값도 그 구간에 든다. 식으로 x를 뒤집어도(예: -x) 같은 점이 같은 구간에 든다. 없으면 undefined
 */
export function stepAt(steps: readonly LimitStep[], x: number) {
  let found: LimitStep | undefined;
  for (const s of steps) {
    if (s[0] > x) break;
    found = s;
  }
  return found && x <= found[1] ? found : undefined;
}

/** 선이 x(데이터 값)에서 갖는 값 [v, v2?]. 구간별이면 그 구간의 값이고, 값이 없는 구간이면 undefined */
export function lineValuesAt(
  line: LimitMetaLine,
  x: number,
): [number, number | undefined] | undefined {
  if (line.steps) {
    const step = stepAt(line.steps, x);
    return step && [step[2], step[3]];
  }
  return line.value === undefined ? undefined : [line.value, line.value2];
}

/** 축 종류에 맞는 값 글자 */
const valueText = (meta: ItemMeta, line: LimitMetaLine, v: number) =>
  formatValue(v, line.axis === "bottom" ? meta.x.kind : meta.y.kind);

/**
 * 커서(PNG 좌표)에서 LIMIT_HIT_PX 안에 있는 선마다 `이름: 값` 한 줄. 띠는 두 값을 `v ~ v2`로 적는다.
 * left 선은 커서 x의 값(구간별이면 그 구간)과 세로 거리를, bottom 선은 가로 거리를 본다.
 */
export function limitRows(meta: ItemMeta, px: number, py: number) {
  const limits = (meta as { limits?: LimitsMeta }).limits;
  if (!limits) return [];
  const { plot } = meta;
  const x = invertX(meta, px);
  return limits.lines.flatMap((line, i) => {
    const values = lineValuesAt(line, x);
    if (!values) return [];
    const [v, v2] = values;
    const near = (value: number | undefined) => {
      if (value === undefined) return false;
      const at =
        line.axis === "bottom"
          ? axisToPx(meta.x, plot.left, plot.width, value, false)
          : axisToPx(meta.y, plot.top, plot.height, value, true);
      return Math.abs((line.axis === "bottom" ? px : py) - at) <= LIMIT_HIT_PX;
    };
    if (!near(v) && !near(v2)) return [];
    const value =
      v2 === undefined
        ? valueText(meta, line, v)
        : `${valueText(meta, line, v)} ~ ${valueText(meta, line, v2)}`;
    return [{ id: `limit-${i}`, label: line.name, value }];
  });
}

function invertX(meta: ItemMeta, px: number) {
  const { plot } = meta;
  const [lo, hi] = meta.x.domain;
  const t = (px - plot.left) / plot.width;
  if (meta.x.log && lo > 0 && hi > 0)
    return 10 ** (Math.log10(lo) + t * (Math.log10(hi) - Math.log10(lo)));
  return lo + t * (hi - lo);
}

/**
 * 점(막대)이 규격을 벗어난 선. left 선은 y, bottom 선은 x를 USL보다 크거나 LSL보다 작은지 본다 (같으면 이탈이 아니다).
 * 구간별 선은 그 점의 x가 든 구간의 값과 비교하고, 값이 없는 구간이면 보지 않는다. 렌더러처럼 USL이 LSL보다 작은
 * 축(뒤집힌 규격)은 판정하지 않는다. 벗어나지 않았으면 undefined
 */
export function outOfSpec(
  limits: LimitsMeta | undefined,
  x: number,
  y: number,
): LimitMetaLine | undefined {
  if (!limits) return;
  for (const axis of ["left", "bottom"] as const) {
    const at = (type: "usl" | "lsl") => {
      const line = limits.lines.find((l) => l.axis === axis && l.type === type);
      const v = line && lineValuesAt(line, x)?.[0];
      return line && v !== undefined ? { line, v } : undefined;
    };
    const usl = at("usl");
    const lsl = at("lsl");
    if (usl && lsl && usl.v < lsl.v) continue;
    const target = axis === "bottom" ? x : y;
    if (usl && target > usl.v) return usl.line;
    if (lsl && target < lsl.v) return lsl.line;
  }
}

/** 규격을 벗어난 점(막대)에 붙이는 줄. 값은 벗어난 선의 이름이다. */
export function outRow(line: LimitMetaLine) {
  return {
    id: "limitOut",
    label: i18n._(TEXT.out),
    value: line.name,
    emphasis: true,
  };
}
