import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import type {
  AnalyticsLayoutNode,
  ChartSpec,
  SaveAnalyticsBoardRequest,
} from "../api/types";
import { createDb, type Db } from "../db/database";
import { SaveAnalyticsBoardRequestSchema } from "../services/chart/schemas";
import {
  deleteBoard,
  getBoard,
  openBoards,
  resolvePanels,
  saveBoard,
} from "./board-store";

const spec = {
  dataset: "iot-100k",
  chartType: "scatter",
  x: "ts",
  y: "value",
  agg: "avg",
  legend: null,
  splitBy: [],
  splitSeparator: " · ",
  tooltip: [],
  grid: { rows: 1, cols: 1 },
  common: { color: "#2a78d6" },
} satisfies ChartSpec;

const leaf = (panelId: string): AnalyticsLayoutNode => ({
  type: "leaf",
  panelId,
});
const row = (...ids: string[]): AnalyticsLayoutNode => ({
  type: "split",
  direction: "horizontal",
  children: ids.map(leaf),
  ratios: ids.map(() => 1 / ids.length),
});
const panel = (id: string) => ({ id, draft: spec });

function body(ids: string[]): SaveAnalyticsBoardRequest {
  return {
    layout: ids.length === 1 ? leaf(ids[0]) : row(...ids),
    activePanelId: ids[0],
    panels: ids.map(panel),
  };
}

const issueOf = (value: unknown) => {
  const result = SaveAnalyticsBoardRequestSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
};

describe("보드 저장 요청 검증", () => {
  it("트리와 칸이 1:1이면 받는다. 고르기 전의 빈 x·y도 받는다", () => {
    expect(issueOf(body(["a", "b", "c"]))).toBeUndefined();
    expect(
      issueOf({
        ...body(["a"]),
        panels: [{ id: "a", draft: { ...spec, x: "" } }],
      }),
    ).toBeUndefined();
  });

  it("트리에 없는 칸, 칸에 없는 leaf, 겹친 id는 거절한다", () => {
    expect(issueOf({ ...body(["a", "b"]), panels: [panel("a")] })).toBe(
      "layout leaves must match panels",
    );
    expect(
      issueOf({ ...body(["a", "b"]), panels: [panel("a"), panel("c")] }),
    ).toBe("layout leaves must match panels");
    expect(
      issueOf({ ...body(["a", "b"]), panels: [panel("a"), panel("a")] }),
    ).toBe("duplicate panel id");
  });

  it("10칸은 거절한다", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    expect(issueOf(body(ids))).toBeDefined();
  });

  it("비율 합이 1이 아니거나 자식이 하나인 split은 거절한다", () => {
    const layout = { ...row("a", "b"), ratios: [0.5, 0.4] };
    expect(issueOf({ ...body(["a", "b"]), layout })).toBe(
      "ratios must sum to 1",
    );
    // 소수 오차는 받는다.
    const third = { ...row("a", "b", "c"), ratios: [0.3333, 0.3333, 0.3333] };
    expect(
      issueOf({ ...body(["a", "b", "c"]), layout: third }),
    ).toBeUndefined();
  });

  it("활성 칸·따를 칸은 있는 칸이어야 하고 자기 자신은 따를 수 없다", () => {
    expect(issueOf({ ...body(["a", "b"]), activePanelId: "z" })).toBe(
      "unknown active panel",
    );
    const link = (follow: string) => ({ follow, mode: "filter" as const });
    expect(
      issueOf({
        ...body(["a", "b"]),
        panels: [{ ...panel("a"), link: link("b") }, panel("b")],
      }),
    ).toBeUndefined();
    expect(
      issueOf({
        ...body(["a", "b"]),
        panels: [{ ...panel("a"), link: link("a") }, panel("b")],
      }),
    ).toBe("link must follow another panel");
  });

  it("칸은 split 없는 차트 한 장이다", () => {
    const split = { ...spec, splitBy: ["factory"] };
    expect(
      issueOf({ ...body(["a"]), panels: [{ id: "a", draft: split }] }),
    ).toBe("a panel draws one chart (grid 1x1, no split)");
    const grid = { ...spec, grid: { rows: 2, cols: 2 } };
    expect(
      issueOf({ ...body(["a"]), panels: [{ id: "a", draft: grid }] }),
    ).toBe("a panel draws one chart (grid 1x1, no split)");
  });
});

describe("그린 차트 고정", () => {
  const drawn = { spec, restore: { all: { shapes: [] } } };
  const previous = {
    layout: row("a", "b"),
    activePanelId: "a",
    panels: [{ ...panel("a"), drawn }, panel("b")],
    updatedAt: 1,
  };

  it("아는 차트는 지금 상태로, 모르는 차트는 이전 값으로, chartId가 없으면 그린 적 없는 칸이다", () => {
    const fresh = { spec: { ...spec, chartType: "bar" as const }, restore: {} };
    const panels = resolvePanels(
      [
        { ...panel("a"), chartId: "gone" },
        { ...panel("b"), chartId: "live" },
        panel("c"),
      ],
      previous,
      (id) => (id === "live" ? fresh : undefined),
    );
    expect(panels).toEqual([
      { ...panel("a"), drawn },
      { ...panel("b"), drawn: fresh },
      panel("c"),
    ]);
  });
});

describe("보드 저장소", () => {
  let db: Db;
  beforeAll(async () => {
    db = createDb(new PGlite());
    await openBoards(db);
    // 부팅마다 부른다.
    await openBoards(db);
  });

  it("없으면 null, 저장하면 같은 모양으로 돌려준다", async () => {
    expect(await getBoard(db, "demo")).toBeNull();
    const { layout, activePanelId, panels } = body(["a", "b"]);
    await saveBoard(db, "demo", { layout, activePanelId, panels }, 10);
    expect(await getBoard(db, "demo")).toEqual({
      layout,
      activePanelId,
      panels,
      updatedAt: 10,
    });
  });

  it("다시 저장하면 통째로 바꾸고, 사용자마다 따로 둔다", async () => {
    const next = body(["c"]);
    await saveBoard(db, "demo", next, 20);
    await saveBoard(db, "other", body(["x", "y"]), 30);
    expect(await getBoard(db, "demo")).toEqual({ ...next, updatedAt: 20 });
    expect((await getBoard(db, "other"))?.panels).toHaveLength(2);
  });

  it("지우면 다음에는 없다", async () => {
    expect(await deleteBoard(db, "demo")).toBe(true);
    expect(await deleteBoard(db, "demo")).toBe(false);
    expect(await getBoard(db, "demo")).toBeNull();
  });
});
