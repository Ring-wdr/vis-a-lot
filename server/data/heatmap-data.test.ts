import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { schemaOf } from "./dataset-schema";
import {
  chooseTimeBin,
  groupHeatmapRows,
  queryHeatmapData,
  timeBinIndex,
  timeBinLabel,
  timeBinStart,
} from "./heatmap-data";

const HOUR = 3_600_000;

describe("시간 구간", () => {
  it("구간 수가 상한 안에 들어오는 가장 짧은 보기 좋은 길이를 고른다", () => {
    expect(chooseTimeBin(0, 30 * 60_000, 48)).toBe(60_000);
    expect(chooseTimeBin(0, 24 * HOUR, 48)).toBe(HOUR);
    expect(chooseTimeBin(0, 0, 48)).toBe(1000);
  });

  it("하루 구간은 KST 자정에서 시작한다", () => {
    const day = 24 * HOUR;
    // 2026-01-01 10:00 KST
    const ms = Date.parse("2026-01-01T01:00:00Z");
    const start = timeBinStart(timeBinIndex(ms, day), day);
    expect(start).toBe(Date.parse("2025-12-31T15:00:00Z"));
    expect(timeBinLabel(start, day)).toBe("01/01");
    expect(timeBinLabel(ms, HOUR)).toBe("01/01 10시");
  });
});

describe("groupHeatmapRows", () => {
  it("split 조합마다 [x][y] 칸을 채우고 y는 전체 정렬 순서를 따른다", () => {
    const groups = groupHeatmapRows(
      [
        ["A", "x1", "b", 1],
        ["A", "x1", "a", 2],
        ["A", "x2", "b", 3],
        ["B", "x1", "c", 4],
      ],
      1,
      ["a", "b", "c"],
      undefined,
    );
    expect(groups).toEqual([
      {
        values: ["A"],
        xCategories: ["x1", "x2"],
        yCategories: ["a", "b"],
        cells: [
          [2, 1],
          [null, 3],
        ],
      },
      { values: ["B"], xCategories: ["x1"], yCategories: ["c"], cells: [[4]] },
    ]);
  });

  it("시계열은 비어 있는 구간도 칸으로 둔다", () => {
    const [group] = groupHeatmapRows(
      [
        [10, "a", 1],
        [12, "a", 2],
      ],
      0,
      ["a"],
      HOUR,
    );
    expect(group.xStarts).toEqual(
      [10, 11, 12].map((b) => timeBinStart(b, HOUR)),
    );
    expect(group.cells).toEqual([[1], [null], [2]]);
  });
});

describe("queryHeatmapData", () => {
  const schema = schemaOf([
    { name: "ts", type: "datetime", label: "시각", nullable: false },
    { name: "line", type: "categorical", label: "라인", nullable: false },
    { name: "kind", type: "categorical", label: "종류", nullable: false },
    { name: "value", type: "numeric", label: "값", nullable: true },
  ]);
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create table t (ts timestamptz, line text, kind text, value float8);
      insert into t values
        ('2026-01-01T00:00:00Z', 'A', 'x', 1),
        ('2026-01-01T00:10:00Z', 'A', 'x', 3),
        ('2026-01-01T00:20:00Z', 'B', 'y', 4),
        ('2026-01-01T00:30:00Z', 'A', 'y', null);
    `);
  });

  it("범주 x × y 칸마다 통계 함수로 집계한다 (z가 없는 행은 뺀다)", async () => {
    const data = await queryHeatmapData(db, schema, {
      table: "t",
      x: "line",
      y: "kind",
      z: "value",
      agg: "avg",
      splitBy: [],
    });
    expect(data.timeBin).toBeUndefined();
    expect(data.groups).toEqual([
      {
        values: [],
        xCategories: ["A", "B"],
        yCategories: ["x", "y"],
        cells: [
          [2, null],
          [null, 4],
        ],
      },
    ]);
  });

  it("시계열 x는 자동 구간으로 묶는다", async () => {
    const data = await queryHeatmapData(db, schema, {
      table: "t",
      x: "ts",
      y: "line",
      z: "value",
      agg: "count",
      splitBy: [],
    });
    // 0:00 ~ 0:20 → 30초 구간 41개 (48개 이하, 15초면 81개)
    expect(data.timeBin).toBe(30_000);
    const [group] = data.groups;
    expect(group.xCategories).toHaveLength(41);
    expect(group.xCategories[0]).toBe("09:00:00");
    expect(group.cells[0]).toEqual([1, null]);
    expect(group.cells[1]).toEqual([null, null]);
    expect(group.cells[40]).toEqual([null, 1]);
  });
});
