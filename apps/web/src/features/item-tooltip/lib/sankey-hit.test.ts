import { describe, expect, it } from "vitest";
import type { SankeyMeta } from "@/shared/api/types";
import { hitSankey, linkCenterY, linkOutline } from "./sankey-hit";
import { sankeyStrategy } from "./strategies";

const meta: SankeyMeta = {
  chartType: "sankey",
  plot: { left: 0, top: 0, width: 200, height: 100 },
  x: { kind: "number", domain: [0, 200] },
  y: { kind: "number", domain: [0, 100] },
  agg: "sum",
  nodes: [
    {
      name: "A",
      side: "source",
      x0: 0,
      x1: 10,
      y0: 0,
      y1: 40,
      in: 0,
      out: 40,
      legend: 0,
    },
    {
      name: "x",
      side: "target",
      x0: 190,
      x1: 200,
      y0: 60,
      y1: 100,
      in: 40,
      out: 0,
    },
  ],
  links: [{ source: 0, target: 1, value: 40, y0: 20, y1: 80, width: 40 }],
};

describe("linkCenterY", () => {
  it("양 끝은 시작·끝 y, 가운데는 두 y의 가운데", () => {
    expect(linkCenterY(10, 190, 20, 80, 10)).toBeCloseTo(20);
    expect(linkCenterY(10, 190, 20, 80, 190)).toBeCloseTo(80);
    expect(linkCenterY(10, 190, 20, 80, 100)).toBeCloseTo(50);
    expect(linkCenterY(10, 190, 20, 80, 5)).toBeNull();
  });
});

describe("hitSankey", () => {
  it("노드를 먼저 보고, 아니면 굵기 안의 흐름을 찾는다", () => {
    expect(hitSankey(meta, 5, 20)).toEqual({ kind: "node", index: 0 });
    expect(hitSankey(meta, 100, 55)).toEqual({ kind: "link", index: 0 });
    expect(hitSankey(meta, 100, 5)).toBeNull();
  });

  it("흐름 띠 윤곽은 닫힌 path", () => {
    expect(linkOutline(meta, meta.links[0])).toMatch(/^M10,0 C.* Z$/);
  });
});

describe("sankeyStrategy", () => {
  it("흐름은 출발 → 도착과 값, 노드는 들어오고 나가는 합", () => {
    const link = sankeyStrategy.hitTest(meta, undefined, 100, 50);
    expect(link?.outline).toBeDefined();
    expect(link?.rows.map((r) => r.value)).toEqual(["A", "x", "40"]);
    const node = sankeyStrategy.hitTest(meta, undefined, 195, 80);
    expect(node?.highlight).toBeDefined();
    expect(node?.rows.map((r) => r.label)).toEqual([
      "도착 노드",
      "들어오는 합",
      "나가는 합",
    ]);
  });
});
