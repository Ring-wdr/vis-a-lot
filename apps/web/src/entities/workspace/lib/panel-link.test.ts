import { describe, expect, it } from "vitest";
import type { AnalyticsPanelLink, ColumnInfo } from "@/shared/api/types";
import {
  canFollow,
  canHighlight,
  defaultLinkColumns,
  defaultLinkMode,
  effectiveLinkMode,
  fitLink,
} from "./panel-link";

const col = (name: string, type: ColumnInfo["type"]): ColumnInfo => ({
  name,
  label: name,
  type,
  nullable: false,
  distinct: null,
});

const IOT = [
  col("ts", "datetime"),
  col("factory", "categorical"),
  col("machine", "categorical"),
  col("value", "numeric"),
];

describe("칸 연결 규칙", () => {
  it("따를 칸이 될 수 있는 차트는 선택 필드를 지원하는 차트다", () => {
    for (const chartType of [
      "scatter",
      "line",
      "bar",
      "boxplot",
      "histogram",
      "waterfall",
    ] as const)
      expect(canFollow({ chartType, subType: null })).toBe(true);
    for (const chartType of ["pie", "heatmap", "sankey", "funnel"] as const)
      expect(canFollow({ chartType, subType: null })).toBe(false);
    expect(canFollow({ chartType: "line", subType: "ecdf" })).toBe(false);
  });

  it("강조는 scatter·line(분포 제외)만 쓰고, 기본 방식은 그에 따른다", () => {
    expect(canHighlight({ chartType: "scatter", subType: null })).toBe(true);
    expect(canHighlight({ chartType: "line", subType: "none" })).toBe(true);
    expect(canHighlight({ chartType: "line", subType: "ncdf" })).toBe(false);
    expect(canHighlight({ chartType: "bar", subType: null })).toBe(false);
    expect(defaultLinkMode({ chartType: "scatter", subType: null })).toBe(
      "highlight",
    );
    expect(defaultLinkMode({ chartType: "bar", subType: null })).toBe("filter");
    expect(
      effectiveLinkMode("highlight", { chartType: "pie", subType: null }),
    ).toBe("filter");
  });

  it("연결 컬럼 기본값은 이름·타입이 같은 범주 컬럼 중 따를 칸 스키마 순서의 첫 컬럼", () => {
    expect(defaultLinkColumns(IOT, IOT)).toEqual({
      source: "factory",
      target: "factory",
    });
    // 이름이 같아도 타입이 다르면 쓰지 않는다.
    expect(
      defaultLinkColumns(IOT, [
        col("factory", "numeric"),
        col("machine", "categorical"),
      ]),
    ).toEqual({ source: "machine", target: "machine" });
    expect(defaultLinkColumns(IOT, [col("value", "numeric")])).toBeUndefined();
  });

  describe("fitLink", () => {
    const link: AnalyticsPanelLink = { follow: "a", mode: "highlight" };
    const scatter = {
      dataset: "iot-1m",
      chartType: "scatter",
      subType: null,
    } as const;

    it("바뀐 것이 없으면 같은 참조", () => {
      const same = { follow: "a", mode: "filter" } as const;
      expect(
        fitLink(same, {
          sourceDataset: "iot-1m",
          target: scatter,
          sourceColumns: IOT,
          targetColumns: IOT,
        }),
      ).toBe(same);
    });

    it("강조를 쓸 수 없는 차트가 되면 거르기로 바꾼다", () => {
      expect(
        fitLink(link, {
          sourceDataset: "iot-1m",
          target: { ...scatter, chartType: "bar" },
          sourceColumns: IOT,
          targetColumns: IOT,
        }),
      ).toEqual({ follow: "a", mode: "filter" });
    });

    it("데이터셋이 다르면 기본 연결 컬럼을 정하고, 고른 컬럼은 둔다. 데이터셋이 바뀌면 기본값으로 되돌린다", () => {
      const ctx = {
        sourceDataset: "iot-100k",
        target: scatter,
        sourceColumns: IOT,
        targetColumns: IOT,
      };
      expect(fitLink(link, ctx).on).toEqual({
        source: "factory",
        target: "factory",
      });
      const chosen = {
        ...link,
        on: { source: "machine", target: "machine" },
      };
      expect(fitLink(chosen, ctx)).toBe(chosen);
      expect(fitLink(chosen, { ...ctx, reset: true }).on).toEqual({
        source: "factory",
        target: "factory",
      });
      // 스키마에 없는 컬럼이면 기본값으로
      expect(
        fitLink({ ...link, on: { source: "gone", target: "machine" } }, ctx).on,
      ).toEqual({ source: "factory", target: "factory" });
      // 스키마를 아직 모르면 그대로 둔다.
      expect(
        fitLink(link, { ...ctx, targetColumns: undefined }).on,
      ).toBeUndefined();
    });

    it("같은 데이터셋이면 연결 컬럼을 뺀다", () => {
      expect(
        fitLink(
          { ...link, on: { source: "machine", target: "machine" } },
          {
            sourceDataset: "iot-1m",
            target: scatter,
            sourceColumns: IOT,
            targetColumns: IOT,
          },
        ),
      ).toEqual({ follow: "a", mode: "highlight" });
    });
  });
});
