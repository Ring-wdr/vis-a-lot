import { describe, expect, it } from "vitest";
import type { ChartItem, ChartRecord } from "./chart-store";
import { changedRestore, chartRestore } from "./item-restore";

const item = (key: string, patch: Partial<ChartItem> = {}) =>
  ({
    key,
    label: key,
    shapes: [],
    favorites: [],
    legendGroups: [],
    deletions: [],
    ...patch,
  }) as unknown as ChartItem;

describe("item 상태 꺼내기", () => {
  it("바뀌지 않은 item은 빼고, 바뀐 필드만 남긴다", () => {
    const chart = {
      items: [
        item("a"),
        item("b", {
          shapes: [{ type: "text", x: 1, y: 2, text: "점검" }],
          props: { hiddenLegend: ["A"], legendColors: {} },
        }),
      ],
    } as unknown as ChartRecord;
    expect(chartRestore(chart)).toEqual({
      b: {
        shapes: [{ type: "text", x: 1, y: 2, text: "점검" }],
        hiddenLegend: ["A"],
      },
    });
  });

  it("도형이 없어도 다른 값이 바뀌었으면 shapes: []를 붙인다 (ItemRestore 필수 필드)", () => {
    expect(changedRestore({ shapes: [], color: "#e34948" })).toEqual({
      shapes: [],
      color: "#e34948",
    });
    expect(changedRestore({ shapes: [] })).toBeUndefined();
  });

  it("차트 속성(options)과 legend 숨김도 담는다", () => {
    const chart = {
      items: [item("a", { props: { options: { title: { visible: false } } } })],
    } as unknown as ChartRecord;
    expect(chartRestore(chart).a).toMatchObject({
      options: { title: { visible: false } },
    });
  });
});
