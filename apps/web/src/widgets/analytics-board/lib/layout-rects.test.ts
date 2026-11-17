import { describe, expect, it } from "vitest";
import { leaf, split } from "@/entities/workspace/lib/layout-tree";
import { boardRects, boxStyle, dividerStyle } from "./layout-rects";

describe("boardRects", () => {
  it("칸 하나는 보드 전체다", () => {
    const { cells, dividers } = boardRects(leaf("a"));
    expect(cells.get("a")).toEqual({ left: 0, top: 0, width: 1, height: 1 });
    expect(dividers).toEqual([]);
  });

  it("비율대로 나누고 이웃 사이마다 경계를 둔다", () => {
    // 왼쪽 a(0.4) | 오른쪽 위 b, 아래 c (0.25 / 0.75)
    const layout = split(
      "horizontal",
      [leaf("a"), split("vertical", [leaf("b"), leaf("c")], [0.25, 0.75])],
      [0.4, 0.6],
    );
    const { cells, dividers } = boardRects(layout);
    expect(cells.get("a")).toEqual({ left: 0, top: 0, width: 0.4, height: 1 });
    expect(cells.get("b")).toMatchObject({ top: 0, height: 0.25 });
    expect(cells.get("b")?.left).toBeCloseTo(0.4);
    expect(cells.get("b")?.width).toBeCloseTo(0.6);
    expect(cells.get("c")?.top).toBeCloseTo(0.25);
    expect(cells.get("c")?.height).toBeCloseTo(0.75);

    expect(dividers).toHaveLength(2);
    const [inner, outer] = [...dividers].sort(
      (x, y) => y.path.length - x.path.length,
    );
    expect(outer).toMatchObject({
      key: "/0",
      path: [],
      index: 0,
      direction: "horizontal",
    });
    expect(outer.at).toBeCloseTo(0.4);
    expect(inner).toMatchObject({
      key: "1/0",
      path: [1],
      index: 0,
      direction: "vertical",
    });
    expect(inner.at).toBeCloseTo(0.25);
    expect(inner.box.left).toBeCloseTo(0.4);
  });

  it("경계 key는 비율이 바뀌어도 그대로다", () => {
    const keys = (r: number) =>
      boardRects(
        split(
          "vertical",
          [leaf("a"), leaf("b"), leaf("c")],
          [r, 0.5 - r / 2, 0.5 - r / 2],
        ),
      ).dividers.map((d) => d.key);
    expect(keys(0.2)).toEqual(keys(0.6));
  });

  it("인라인 스타일은 %로 적는다", () => {
    expect(boxStyle({ left: 0.5, top: 0, width: 0.25, height: 1 / 3 })).toEqual(
      {
        left: "50%",
        top: "0%",
        width: "25%",
        height: "33.3333%",
      },
    );
    const [d] = boardRects(
      split("horizontal", [leaf("a"), leaf("b")], [0.3, 0.7]),
    ).dividers;
    expect(dividerStyle(d)).toEqual({ left: "30%", top: "0%", height: "100%" });
  });
});
