import { describe, expect, it } from "vitest";
import type { ColumnInfo } from "@/shared/api/types";
import { liveTooltipColumns } from "./tooltip-columns";

const col = (name: string) =>
  ({ name, label: name, type: "numeric" }) as ColumnInfo;
const columns = [col("a"), col("b"), col("c"), col("d")];

describe("liveTooltipColumns", () => {
  it("고른 순서대로 그린 데이터셋에 있는 컬럼만 돌려준다", () => {
    expect(liveTooltipColumns(["c", "zz", "a"], columns, undefined)).toEqual([
      "c",
      "a",
    ]);
  });

  it("그린 차트의 x, y는 뺀다", () => {
    expect(
      liveTooltipColumns(["a", "b", "c"], columns, { x: "a", y: "b" }),
    ).toEqual(["c"]);
  });

  it("스키마를 받기 전에는 고르지 않는다", () => {
    expect(liveTooltipColumns(["a"], undefined, undefined)).toEqual([]);
  });
});
