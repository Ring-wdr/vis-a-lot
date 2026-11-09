import { describe, expect, it } from "vitest";
import { layoutSankey, linkMidpoint, nodeCenter, toData } from "./sankey";

const plot = { left: 100, top: 40, width: 300, height: 200 };
const input = {
  sources: ["A", "B"],
  targets: ["x", "y", "z"],
  links: [
    { source: 0, target: 0, value: 6 },
    { source: 0, target: 1, value: 2 },
    { source: 1, target: 1, value: 2 },
  ],
};

describe("layoutSankey", () => {
  it("출발은 왼쪽 열, 도착은 오른쪽 열에 흐름이 있는 노드만 놓는다", () => {
    const { nodes, links } = layoutSankey(input, [], plot);
    expect(nodes.map((n) => `${n.side}:${n.name}`)).toEqual([
      "source:A",
      "source:B",
      "target:x",
      "target:y",
    ]);
    for (const n of nodes) {
      if (n.side === "source") expect(n.x0).toBe(plot.left);
      else expect(n.x1).toBe(plot.left + plot.width);
      expect(n.y0).toBeGreaterThanOrEqual(plot.top);
      expect(n.y1).toBeLessThanOrEqual(plot.top + plot.height + 1e-6);
    }
    expect(nodes[0]).toMatchObject({ out: 8, in: 0, legend: 0 });
    expect(nodes[3]).toMatchObject({ in: 4, out: 0 });
    expect(nodes[3].legend).toBeUndefined();
    expect(links).toHaveLength(3);
    // 굵기는 값에 비례한다.
    expect(links[0].width / links[1].width).toBeCloseTo(3);
  });

  it("끈 출발 노드의 흐름과, 흐름이 없어진 노드는 빼고 배치한다", () => {
    const { nodes, links } = layoutSankey(input, [true, false], plot);
    expect(nodes.map((n) => n.name)).toEqual(["B", "y"]);
    expect(links).toEqual([expect.objectContaining({ source: 0, target: 1 })]);
    expect(layoutSankey(input, [true, true], plot)).toEqual({
      nodes: [],
      links: [],
    });
  });

  it("대표 좌표: 흐름은 곡선 가운데점, 노드는 사각형 가운데", () => {
    const layout = layoutSankey(input, [], plot);
    const link = layout.links[0];
    const [mx, my] = linkMidpoint(layout, link);
    const { x1 } = layout.nodes[link.source];
    const { x0 } = layout.nodes[link.target];
    expect(mx).toBeCloseTo((x1 + x0) / 2);
    expect(my).toBeCloseTo((link.y0 + link.y1) / 2);
    const n = layout.nodes[0];
    expect(nodeCenter(n)).toEqual([(n.x0 + n.x1) / 2, (n.y0 + n.y1) / 2]);
  });

  it("고정 좌표 공간: x는 그림 왼쪽부터, y는 그림 아래부터 픽셀과 1:1", () => {
    expect(toData(plot, 100, 240)).toEqual([0, 0]);
    expect(toData(plot, 400, 40)).toEqual([300, 200]);
  });
});
