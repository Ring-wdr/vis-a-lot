// line 하위 차트(ECDF·정규 CDF·정규 확률)의 좌표. y 컬럼 값의 분포를 legend 계열마다 따로 그린다.
// x는 정렬한 값, y는 그 값까지의 누적 비율(ECDF)·같은 평균과 표준편차의 정규 누적확률(NCDF)·
// 정규 분위수 z(정규 확률). 점 하나가 여전히 행 하나라 행 식별자(ids)와 legend 인덱스도 같은 순서로 옮긴다.

import { meanSd, normalCdf, normalQuantile } from "./stats";

export type DistributionKind = "ecdf" | "ncdf" | "probability";

export const DISTRIBUTION_Y_TITLES: Record<DistributionKind, string> = {
  ecdf: "누적 비율",
  ncdf: "정규 누적 확률",
  probability: "정규 분위수 (z)",
};

export type PointArrays = {
  xs: Float64Array;
  ys: Float64Array;
  ids: Float64Array;
  /** 행별 legend 인덱스. legend가 없으면 없다. */
  legend?: Uint8Array;
};

/**
 * [start, end) 구간(split item 하나)의 점을 분포 좌표로 바꿔 out에 같은 구간으로 쓴다.
 * 계열(legend 값) 순서대로, 계열 안에서는 값 순서대로 놓는다. 값이 같으면 원래 순서를 지킨다.
 */
export function distributionRange(
  kind: DistributionKind,
  src: PointArrays,
  out: PointArrays,
  start: number,
  end: number,
) {
  const series = new Map<number, number[]>();
  for (let i = start; i < end; i++) {
    const g = src.legend ? src.legend[i] : 0;
    let list = series.get(g);
    if (!list) {
      list = [];
      series.set(g, list);
    }
    list.push(i);
  }
  let at = start;
  for (const g of [...series.keys()].sort((a, b) => a - b)) {
    const rows = series.get(g) ?? [];
    rows.sort((a, b) => src.ys[a] - src.ys[b] || a - b);
    const n = rows.length;
    const values = rows.map((i) => src.ys[i]);
    const { mean, sd } = meanSd(values);
    rows.forEach((i, k) => {
      const v = src.ys[i];
      out.xs[at] = v;
      out.ys[at] =
        kind === "ecdf"
          ? (k + 1) / n
          : kind === "ncdf"
            ? sd > 0
              ? normalCdf((v - mean) / sd)
              : v < mean
                ? 0
                : v > mean
                  ? 1
                  : 0.5
            : // Hazen 위치 (k + 0.5) / n: 양 끝도 유한한 z가 나온다.
              normalQuantile((k + 0.5) / n);
      out.ids[at] = src.ids[i];
      if (out.legend && src.legend) out.legend[at] = src.legend[i];
      at++;
    });
  }
}

/** 모든 split 구간을 분포 좌표로 바꾼 새 배열 */
export function toDistribution(
  kind: DistributionKind,
  src: PointArrays,
  groups: readonly { start: number; end: number }[],
): PointArrays {
  const n = src.xs.length;
  const out: PointArrays = {
    xs: new Float64Array(n),
    ys: new Float64Array(n),
    ids: new Float64Array(n),
    legend: src.legend ? new Uint8Array(n) : undefined,
  };
  for (const g of groups) distributionRange(kind, src, out, g.start, g.end);
  return out;
}
