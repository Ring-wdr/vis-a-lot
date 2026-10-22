import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { funnelLayout, stageCenter } from "../render/funnel";
import { schemaOf } from "./dataset-schema";
import { queryFunnelData, rankStages } from "./funnel-data";

describe("rankStages", () => {
  it("값 큰 순으로 줄 세우고 같은 값은 이름 순", () => {
    expect(rankStages(["b", "a", "c"], [5, 5, 9]).top.map((t) => t.c)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("상한을 넘으면 앞의 max - 1개만 남기고 나머지는 기타로 묶을 범주", () => {
    const r = rankStages(["a", "b", "c", "d"], [4, 3, 2, 1], 3);
    expect(r.top.map((t) => t.c)).toEqual(["a", "b"]);
    expect(r.rest).toEqual(["c", "d"]);
  });
});

describe("funnelLayout", () => {
  const plot = { left: 100, top: 0, width: 200, height: 300 };

  it("가장 큰 값에 대한 비율로 가운데 맞춘 막대와 전환율", () => {
    const stages = funnelLayout(plot, ["방문", "가입", "구매"], [100, 50, 10]);
    expect(stages.map((s) => s.rect.width)).toEqual([200, 100, 20]);
    expect(stages[1].rect.x).toBe(150);
    expect(stages.map((s) => s.rate)).toEqual([null, 0.5, 0.2]);
    expect(stages.map((s) => s.share)).toEqual([1, 0.5, 0.1]);
    // 줄 높이 100 중 막대 44(상한), 가운데
    expect(stages[0].rect).toMatchObject({ y: 28, height: 44 });
    // 고정 좌표: 그림 영역 왼쪽·아래에서의 거리
    expect(stageCenter(plot, stages[0].rect)).toEqual([100, 250]);
  });

  it("끈 단계는 빼고 남은 단계끼리 줄과 비율을 다시 정한다", () => {
    const stages = funnelLayout(
      plot,
      ["방문", "가입", "구매"],
      [100, 50, 10],
      [true, false, false],
    );
    expect(stages.map((s) => [s.label, s.index])).toEqual([
      ["가입", 1],
      ["구매", 2],
    ]);
    expect(stages[0].rect.width).toBe(200);
    expect(stages[1].rate).toBe(0.2);
  });
});

const schema = schemaOf([
  { name: "line", type: "categorical", label: "라인", nullable: false },
  { name: "step", type: "categorical", label: "단계", nullable: false },
  { name: "value", type: "numeric", label: "값", nullable: true },
]);

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  // A: s0..s9 단계, 단계 k의 값은 10 - k (행 하나씩). B: s0, s1만
  await db.exec(`
    create table t (line text, step text, value float8);
    insert into t select 'A', 's' || k, 10 - k from generate_series(0, 9) as k;
    insert into t values ('A', 's9', 3), ('B', 's0', 2), ('B', 's1', 7);
  `);
}, 30_000);

describe("queryFunnelData", () => {
  it("split마다 값 큰 순, 넘치는 단계는 기타로 다시 집계한다", async () => {
    const data = await queryFunnelData(db, schema, {
      table: "t",
      x: "step",
      y: "value",
      agg: "avg",
      splitBy: ["line"],
    });
    const [a, b] = data.groups;
    expect(a.categories).toEqual([
      "s0",
      "s1",
      "s2",
      "s3",
      "s4",
      "s5",
      "s6",
      "기타",
    ]);
    // 기타 = s7(3), s8(2), s9(1, 3)의 평균. 범주별 평균을 더하거나 평균 내지 않는다.
    expect(a.bars?.[7]).toEqual([(3 + 2 + 1 + 3) / 4]);
    expect(b.categories).toEqual(["s1", "s0"]);
    expect(b.bars).toEqual([[7], [2]]);
  });
});
