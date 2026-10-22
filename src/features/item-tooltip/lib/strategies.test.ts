import { describe, expect, it } from "vitest";
import type {
  CandleMeta,
  GanttMeta,
  PieMeta,
  RadarMeta,
  ScatterMeta,
} from "@/shared/api/types";
import { PointIndex } from "./point-index";
import {
  barStrategy,
  boxplotStrategy,
  candleAt,
  candleStrategy,
  formatDuration,
  ganttStrategy,
  hitSlice,
  invertAxis,
  nearestVertex,
  pieStrategy,
  radarStrategy,
  scatterStrategy,
  wedgePath,
} from "./strategies";

const meta: ScatterMeta = {
  chartType: "scatter",
  plot: { left: 40, top: 20, width: 200, height: 100 },
  x: { kind: "number", domain: [0, 100] },
  y: { kind: "number", domain: [0, 50] },
  points: {
    px: [40, 140, 240],
    py: [120, 70, 20],
    x: [0, 50, 100],
    y: [0, 25, 50],
    id: [11, 22, 33],
  },
  total: 3,
};

describe("invertAxis", () => {
  it("x는 왼쪽에서 오른쪽으로, y는 아래에서 위로 값을 늘린다", () => {
    expect(invertAxis(meta.x, 40, 200, 140, false)).toBe(50);
    expect(invertAxis(meta.y, 20, 100, 20, true)).toBe(50);
    expect(invertAxis(meta.y, 20, 100, 120, true)).toBe(0);
  });
});

describe("PointIndex", () => {
  const index = new PointIndex(meta.points.px, meta.points.py);

  it("반경 안의 가장 가까운 점을 찾는다", () => {
    expect(index.nearest(145, 72, 24)).toBe(1);
    expect(index.nearest(236, 25, 24)).toBe(2);
  });

  it("반경 밖이면 -1", () => {
    expect(index.nearest(90, 100, 10)).toBe(-1);
  });
});

describe("scatterStrategy", () => {
  const prepared = scatterStrategy.prepare(meta);

  it("그림 영역 밖이면 null", () => {
    expect(scatterStrategy.hitTest(meta, prepared, 10, 10)).toBeNull();
  });

  it("커서 좌표값과 가장 가까운 점, 행 식별자를 돌려준다", () => {
    const hit = scatterStrategy.hitTest(meta, prepared, 142, 68);
    expect(hit?.rows.map((r) => r.label)).toEqual([
      "커서 x",
      "커서 y",
      "가까운 점 x",
      "가까운 점 y",
    ]);
    expect(hit?.rows[2].value).toBe("50");
    expect(hit?.marker).toEqual({ px: 140, py: 70 });
    expect(hit?.rowId).toBe(22);
  });

  it("가까운 점 표시를 끄면 커서 좌표만 보여주고 점 표시와 서버 호출도 없다", () => {
    const hit = scatterStrategy.hitTest(meta, prepared, 142, 68, {
      nearest: false,
    });
    expect(hit?.rows.map((r) => r.label)).toEqual(["커서 x", "커서 y"]);
    expect(hit?.marker).toBeUndefined();
    expect(hit?.rowId).toBeUndefined();
  });

  it("가까운 점이 없으면 커서 좌표만 보여주고 서버 호출 대상도 없다", () => {
    const hit = scatterStrategy.hitTest(meta, prepared, 90, 100);
    expect(hit?.rows).toHaveLength(2);
    expect(hit?.rowId).toBeUndefined();
  });
});

describe("barStrategy / boxplotStrategy", () => {
  const base = {
    plot: { left: 0, top: 0, width: 300, height: 100 },
    x: { kind: "number" as const, domain: [-0.5, 2.5] as [number, number] },
    y: { kind: "number" as const, domain: [0, 10] as [number, number] },
    categories: ["A", "B", "C"],
    markWidth: 70,
    groupCount: 1,
    groupGap: 2,
  };

  it("막대 너비 안에서만 범주와 집계값을 보여준다", () => {
    const meta = {
      ...base,
      chartType: "bar" as const,
      agg: "avg" as const,
      bars: [[2], [5], [8]],
    };
    const hit = barStrategy.hitTest(meta, undefined, 150, 50);
    expect(hit?.rows).toEqual([
      { label: "범주", value: "B" },
      { label: "평균", value: "5", emphasis: true },
    ]);
    // 막대(가운데 150, 너비 70, 값 5 → 0)를 감싸되 그림 영역 아래로는 나가지 않는다
    expect(hit?.highlight).toEqual({ x: 112, y: 47, width: 76, height: 53 });
    // 막대 사이 빈 곳
    expect(barStrategy.hitTest(meta, undefined, 100, 50)).toBeNull();
  });

  it("boxplot은 사분위수와 이상치 개수를 보여준다", () => {
    const box = {
      n: 10,
      mean: 5,
      q1: 3,
      median: 5,
      q3: 7,
      lo: 1,
      hi: 9,
      outlierCount: 2,
    };
    const meta = {
      ...base,
      chartType: "boxplot" as const,
      boxes: [[box], [box], [box]],
    };
    const hit = boxplotStrategy.hitTest(meta, undefined, 50, 50);
    expect(hit?.rows.find((r) => r.label === "중앙값")?.value).toBe("5");
    expect(hit?.rows.find((r) => r.label === "이상치")?.value).toBe("2개");
  });
});

describe("legend가 있는 bar", () => {
  const meta = {
    chartType: "bar" as const,
    plot: { left: 0, top: 30, width: 300, height: 100 },
    x: { kind: "number" as const, domain: [-0.5, 2.5] as [number, number] },
    y: { kind: "number" as const, domain: [0, 10] as [number, number] },
    categories: ["A", "B", "C"],
    markWidth: 80,
    groupCount: 2,
    groupGap: 2,
    agg: "avg" as const,
    bars: [
      [1, 2],
      [3, null],
      [5, 6],
    ],
    legend: {
      title: "근무조",
      values: ["야간", "주간"],
      colors: ["#2a78d6", "#eb6834"],
      box: { x: 0, y: 4, width: 120, height: 20 },
      entries: [],
      hidden: 0,
    },
  };

  it("범주 안에서 legend 값별 막대를 구분한다", () => {
    // 범주 B 가운데(150) 기준 왼쪽 칸 = 야간
    const left = barStrategy.hitTest(meta, undefined, 130, 80);
    expect(left?.rows).toEqual([
      { label: "범주", value: "B" },
      { label: "근무조", value: "야간" },
      { label: "평균", value: "3", emphasis: true },
    ]);
    // 가리킨 막대(가운데 130, 너비 38)를 3px 여유로 감싼다
    expect(left?.highlight).toMatchObject({ x: 108, width: 44 });
    // 오른쪽 칸(주간)은 데이터가 없다
    expect(barStrategy.hitTest(meta, undefined, 170, 80)).toBeNull();
  });

  it("legend 상자 위에서는 툴팁을 띄우지 않는다", () => {
    expect(barStrategy.hitTest(meta, undefined, 50, 10)).toBeNull();
  });
});

describe("candle 툴팁", () => {
  const meta: CandleMeta = {
    chartType: "candle",
    plot: { left: 0, top: 0, width: 300, height: 100 },
    x: { kind: "time", domain: [0, 3000] },
    y: { kind: "number", domain: [0, 10] },
    interval: 1000,
    bodyWidth: 70,
    // 1000~2000 구간은 숨겨서 빠졌다.
    candles: {
      t: [0, 2000],
      open: [5, 6],
      high: [9, 8],
      low: [3, 6],
      close: [3, 7],
      count: [3, 2],
      g: [1, 0],
    },
    legend: {
      title: "캔들",
      values: ["상승", "하락"],
      colors: ["#e34948", "#2a78d6"],
      box: { x: 0, y: -30, width: 10, height: 10 },
      entries: [],
      hidden: 0,
    },
  };

  it("구간 시작 목록에서 시각이 든 캔들을 찾는다", () => {
    expect(candleAt(meta.candles.t, 1000, 2500)).toBe(1);
    expect(candleAt(meta.candles.t, 1000, 1500)).toBe(-1);
    expect(candleAt(meta.candles.t, 1000, -1)).toBe(-1);
  });

  it("가리킨 캔들의 OHLC와 심지 범위 하이라이트", () => {
    const hit = candleStrategy.hitTest(meta, undefined, 50, 50);
    expect(hit?.rows.find((r) => r.label === "캔들")?.value).toBe("하락");
    expect(hit?.rows.find((r) => r.label === "종가")?.value).toBe("3");
    expect(hit?.rows.find((r) => r.label === "개수")?.value).toBe("3");
    // 가운데 50, 몸통 70을 3px 여유로 감싸고, 세로는 고가 9 ~ 저가 3
    expect(hit?.highlight).toMatchObject({
      x: 12,
      width: 76,
      y: 7,
      height: 66,
    });
    expect(candleStrategy.hitTest(meta, undefined, 150, 50)).toBeNull();
  });
});

describe("gantt 툴팁", () => {
  // 행 2개(높이 100 → 행마다 50px), 시간 0~1000을 200px에
  const meta: GanttMeta = {
    chartType: "gantt",
    plot: { left: 0, top: 0, width: 200, height: 100 },
    x: { kind: "time", domain: [0, 1000] },
    y: { kind: "number", domain: [-0.5, 1.5] },
    rowTitle: "설비",
    rows: ["M1", "M2"],
    barHeight: 35,
    bars: {
      r: [0, 0, 1],
      s: [0, 500, 200],
      e: [500, 1000, 400],
      g: [1, 0, 1],
      n: [3, 2, 1],
      m: [1, 4, 1],
    },
    truncated: false,
    legend: {
      title: "상태",
      values: ["경고", "정상"],
      colors: ["#eb6834", "#2a78d6"],
      box: { x: 0, y: -30, width: 10, height: 10 },
      entries: [],
      hidden: 0,
    },
  };
  const prepared = ganttStrategy.prepare(meta);

  it("첫 행은 위, 커서 시각이 든 막대를 찾는다", () => {
    const hit = ganttStrategy.hitTest(meta, prepared, 150, 25);
    expect(hit?.rows).toEqual([
      { label: "설비", value: "M1" },
      { label: "상태", value: "경고" },
      { label: "시작", value: expect.any(String) },
      { label: "끝", value: expect.any(String) },
      { label: "길이", value: "500ms", emphasis: true },
      { label: "개수", value: "2" },
      { label: "합친 구간", value: "4개" },
    ]);
    expect(hit?.highlight).toMatchObject({ x: 97, width: 106 });
    // 아래 행(M2)은 40~80px에만 막대가 있다.
    expect(ganttStrategy.hitTest(meta, prepared, 60, 75)?.rows[0].value).toBe(
      "M2",
    );
    expect(ganttStrategy.hitTest(meta, prepared, 120, 75)).toBeNull();
    // 행 사이(막대 높이 밖)
    expect(ganttStrategy.hitTest(meta, prepared, 60, 49)).toBeNull();
  });

  it("기간을 큰 단위 둘로 읽는다", () => {
    expect(formatDuration(2 * 3_600_000 + 5 * 60_000 + 3000)).toBe("2시간 5분");
    expect(formatDuration(35_000)).toBe("35초");
    expect(formatDuration(86_400_000)).toBe("1일");
  });
});

describe("pie", () => {
  const pie: PieMeta = {
    chartType: "pie",
    plot: { left: 0, top: 0, width: 200, height: 200 },
    x: { kind: "number", domain: [0, 200] },
    y: { kind: "number", domain: [0, 200] },
    center: { x: 100, y: 100 },
    radius: 80,
    slices: [
      {
        category: "a",
        value: 3,
        ratio: 0.75,
        start: -Math.PI / 2,
        end: Math.PI,
        color: "#2a78d6",
        index: 0,
      },
      {
        category: "b",
        value: 1,
        ratio: 0.25,
        start: Math.PI,
        end: (Math.PI * 3) / 2,
        color: "#eb6834",
        index: 1,
      },
    ],
    total: 4,
    agg: "sum",
  };

  it("커서 각도로 조각을 찾고, 원 밖이면 없다", () => {
    expect(hitSlice(pie, 150, 100)?.category).toBe("a"); // 3시
    expect(hitSlice(pie, 60, 60)?.category).toBe("b"); // 10시 반
    expect(hitSlice(pie, 101, 30)?.category).toBe("a"); // 12시 바로 오른쪽
    expect(hitSlice(pie, 195, 100)).toBeUndefined();
  });

  it("조각 범주·값·비율과 윤곽을 준다", () => {
    const hit = pieStrategy.hitTest(pie, undefined, 60, 60);
    expect(hit?.rows.map((r) => r.value)).toEqual(["b", "1", "25.0%"]);
    expect(hit?.outline).toMatch(/^M 100 100 L /);
  });

  it("한 바퀴 전체 조각의 윤곽은 반원 두 개", () => {
    expect(wedgePath(0, 0, 10, 0, Math.PI * 2).match(/A /g)).toHaveLength(2);
  });
});

describe("radar", () => {
  const radar: RadarMeta = {
    chartType: "radar",
    plot: { left: 0, top: 0, width: 200, height: 200 },
    x: { kind: "number", domain: [0, 200] },
    y: { kind: "number", domain: [0, 200] },
    center: { x: 100, y: 100 },
    radius: 80,
    axisTitle: "라인",
    axes: ["L1", "L2", "L3"],
    domain: [0, 10],
    series: [
      {
        name: "주간",
        color: "#2a78d6",
        index: 0,
        values: [10, 5, null],
        points: [[100, 20], [135, 120], null],
      },
      {
        name: "야간",
        color: "#eb6834",
        index: 1,
        values: [2, 2, 2],
        points: [
          [100, 84],
          [114, 108],
          [86, 108],
        ],
      },
    ],
    agg: "avg",
  };

  it("가장 가까운 꼭짓점을 찾고, 멀면 없다", () => {
    expect(nearestVertex(radar, 102, 24)).toEqual([0, 0]);
    expect(nearestVertex(radar, 88, 110)).toEqual([1, 2]);
    expect(nearestVertex(radar, 190, 190)).toBeUndefined();
  });

  it("축·계열·값을 보여주고 꼭짓점에 표시한다", () => {
    const hit = radarStrategy.hitTest(radar, undefined, 133, 118);
    expect(hit?.marker).toEqual({ px: 135, py: 120 });
    expect(hit?.rows.map((r) => r.value)).toEqual(["L2", "주간", "5"]);
  });
});

describe("invertAxis 로그 축", () => {
  it("log10 공간에서 보간한다", () => {
    const axis = {
      kind: "number" as const,
      domain: [1, 1000] as [number, number],
      log: true,
    };
    expect(invertAxis(axis, 0, 300, 100, false)).toBeCloseTo(10);
    expect(invertAxis({ ...axis, log: false }, 0, 300, 150, false)).toBeCloseTo(
      500.5,
    );
  });
});
