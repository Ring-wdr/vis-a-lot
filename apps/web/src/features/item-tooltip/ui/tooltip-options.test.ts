import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { describe, expect, it } from "vitest";
import {
  formatTooltipText,
  resolveTooltipOptions,
  withTransparency,
} from "./tooltip-options";

// 화면은 서버 기본값을 받아 쓰므로 테스트도 서버 값을 그대로 쓴다.
const DEFAULT_OPTIONS = CHART_DEFAULTS.options;
const base = DEFAULT_OPTIONS.tooltip;

describe("tooltip options", () => {
  it("정하지 않았거나 쓰지 않는 차트면 지금 모양을 둔다", () => {
    expect(
      resolveTooltipOptions(DEFAULT_OPTIONS, "scatter", undefined, undefined),
    ).toBe(undefined);
    expect(
      resolveTooltipOptions(
        DEFAULT_OPTIONS,
        "boxplot",
        { tooltip: { fontSize: 20 } },
        undefined,
      ),
    ).toBe(undefined);
  });

  it("개별 속성이 공통 속성 위에 덮인다", () => {
    const o = resolveTooltipOptions(
      DEFAULT_OPTIONS,
      "bar",
      { tooltip: { fontSize: 20, prefix: "$" } },
      { tooltip: { fontSize: 14 } },
    );
    expect(o?.fontSize).toBe(14);
    expect(o?.prefix).toBe("$");
  });

  it("숫자 글자에 소수 자리와 앞뒤 글자를 입힌다", () => {
    const o = { ...base, decimals: 2, prefix: "<", suffix: ">" };
    expect(formatTooltipText("1,234.5", o)).toBe(
      `<${(1234.5).toLocaleString(undefined, { minimumFractionDigits: 2 })}>`,
    );
    expect(formatTooltipText("LOT-1", o)).toBe("<LOT-1>");
    expect(formatTooltipText("—", o)).toBe("—");
  });

  it("투명도를 rgba로", () => {
    expect(withTransparency("#ff8000", 0.25)).toBe("rgba(255, 128, 0, 0.75)");
  });
});
