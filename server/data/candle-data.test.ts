import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/database";
import {
  bucketStart,
  candleInterval,
  MAX_CANDLES,
  queryCandleData,
} from "./candle-data";
import { schemaOf } from "./dataset-schema";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("candleInterval", () => {
  it("구간 수가 상한을 넘지 않는 가장 짧은 깔끔한 간격을 고른다", () => {
    expect(candleInterval(7 * DAY)).toBe(2 * HOUR);
    expect(candleInterval(DAY)).toBe(10 * MINUTE);
    expect(candleInterval(0)).toBe(1000);
    for (const span of [5 * MINUTE, 3 * HOUR, 30 * DAY, 400 * DAY]) {
      const count = span / candleInterval(span);
      expect(count).toBeLessThanOrEqual(MAX_CANDLES);
      expect(count).toBeGreaterThanOrEqual(40);
    }
  });

  it("구간 경계는 KST 자정에 맞춘다", () => {
    // 2026-01-01 15:00 UTC = 01-02 00:00 KST
    const kstMidnight = Date.parse("2026-01-01T15:00:00Z");
    expect(bucketStart(kstMidnight + 5 * HOUR, DAY)).toBe(kstMidnight);
  });
});

const schema = schemaOf([
  { name: "ts", type: "datetime", label: "측정 시각", nullable: false },
  { name: "line", type: "categorical", label: "라인", nullable: false },
  { name: "value", type: "numeric", label: "측정값", nullable: true },
]);

let db: Db;
beforeAll(async () => {
  const pglite = new PGlite();
  db = createDb(pglite);
  // 0초~99초에 걸친 데이터라 1초 간격이 된다. 같은 초 안의 시간순 첫 값/끝 값이 시가/종가다.
  await pglite.exec(`
    create table t (ts timestamptz, line text, value float8);
    insert into t values
      ('2026-01-01T00:00:00.100Z', 'A', 5),
      ('2026-01-01T00:00:00.900Z', 'A', 3),
      ('2026-01-01T00:00:00.500Z', 'A', 9),
      ('2026-01-01T00:00:01.200Z', 'A', 4),
      ('2026-01-01T00:00:01.300Z', 'A', null),
      ('2026-01-01T00:01:39.000Z', 'B', 7),
      ('2026-01-01T00:01:00.000Z', 'C', 10),
      ('2026-01-01T00:01:00.000Z', 'C', 2),
      ('2026-01-01T00:01:00.500Z', 'C', 8),
      ('2026-01-01T00:01:00.500Z', 'C', 6);
  `);
});

describe("queryCandleData", () => {
  it("split 조합 × 구간마다 시가·고가·저가·종가·개수를 만든다", async () => {
    const data = await queryCandleData(db, schema, {
      table: "t",
      x: "ts",
      y: "value",
      splitBy: ["line"],
    });
    expect(data.interval).toBe(1000);
    expect(data.groups.map((g) => g.values)).toEqual([["A"], ["B"], ["C"]]);
    const [a] = data.groups;
    const t0 = Date.parse("2026-01-01T00:00:00Z");
    expect(a.t).toEqual([t0, t0 + 1000]);
    expect(a.open).toEqual([5, 4]);
    expect(a.high).toEqual([9, 4]);
    expect(a.low).toEqual([3, 4]);
    expect(a.close).toEqual([3, 4]);
    expect(a.count).toEqual([3, 1]);
  });

  it("같은 시각의 행이 여럿이면 시각별 평균으로 시가·종가를 정한다", async () => {
    const data = await queryCandleData(db, schema, {
      table: "t",
      x: "ts",
      y: "value",
      splitBy: ["line"],
    });
    const c = data.groups[2];
    // 첫 시각 평균 (10+2)/2 = 6 → 끝 시각 평균 (8+6)/2 = 7: 행 순서와 상관없이 상승
    expect(c.open).toEqual([6]);
    expect(c.close).toEqual([7]);
    expect(c.high).toEqual([10]);
    expect(c.low).toEqual([2]);
    expect(c.count).toEqual([4]);
  });

  it("행이 없으면 split 없는 차트는 빈 item 하나를 둔다", async () => {
    const data = await queryCandleData(db, schema, {
      table: "t",
      x: "ts",
      y: "value",
      splitBy: [],
      filters: [{ kind: "exclude", column: "line", values: ["A", "B", "C"] }],
    });
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0].t).toEqual([]);
  });
});
