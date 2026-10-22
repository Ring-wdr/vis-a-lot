import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/database";
import { schemaOf } from "./dataset-schema";
import { queryGanttData } from "./gantt-data";

const schema = schemaOf([
  { name: "ts", type: "datetime", label: "측정 시각", nullable: false },
  { name: "line", type: "categorical", label: "라인", nullable: false },
  { name: "machine", type: "categorical", label: "설비", nullable: false },
  { name: "status", type: "categorical", label: "상태", nullable: false },
]);

const t0 = Date.parse("2026-01-01T00:00:00Z");
const at = (s: number) => new Date(t0 + s * 1000).toISOString();

let db: Db;
beforeAll(async () => {
  const pglite = new PGlite();
  db = createDb(pglite);
  // M1: 정상 0~2초, 경고 3~4초, 정상 5초 (일부러 순서를 섞어 넣는다). M2: 정상 1초
  await pglite.exec(`
    create table t (ts timestamptz, line text, machine text, status text);
    insert into t values
      ('${at(4)}', 'A', 'M1', '경고'),
      ('${at(0)}', 'A', 'M1', '정상'),
      ('${at(2)}', 'A', 'M1', '정상'),
      ('${at(1)}', 'A', 'M1', '정상'),
      ('${at(3)}', 'A', 'M1', '경고'),
      ('${at(5)}', 'A', 'M1', '정상'),
      ('${at(1)}', 'B', 'M2', '정상');
  `);
});

describe("queryGanttData", () => {
  it("행마다 같은 legend 값이 이어지는 구간을 막대 하나로 묶고, 끝을 다음 시작에 붙인다", async () => {
    const data = await queryGanttData(db, schema, {
      table: "t",
      x: "ts",
      y: "machine",
      splitBy: [],
      legend: "status",
    });
    expect(data.legendValues).toEqual(["경고", "정상"]);
    const [g] = data.groups;
    expect(g.rows).toEqual(["M1", "M2"]);
    expect(g.bars.r).toEqual([0, 0, 0, 1]);
    expect(g.bars.s).toEqual([t0, t0 + 3000, t0 + 5000, t0 + 1000]);
    expect(g.bars.e).toEqual([t0 + 3000, t0 + 5000, t0 + 5000, t0 + 1000]);
    expect(g.bars.g).toEqual([1, 0, 1, 1]);
    expect(g.bars.n).toEqual([3, 2, 1, 1]);
  });

  it("legend가 없으면 행마다 처음~마지막 시각 막대 하나, split 조합별로 나눈다", async () => {
    const data = await queryGanttData(db, schema, {
      table: "t",
      x: "ts",
      y: "machine",
      splitBy: ["line"],
      legend: null,
    });
    expect(data.groups.map((g) => g.values)).toEqual([["A"], ["B"]]);
    expect(data.groups[0].bars).toEqual({
      r: [0],
      s: [t0],
      e: [t0 + 5000],
      g: [0],
      n: [6],
    });
  });
});
