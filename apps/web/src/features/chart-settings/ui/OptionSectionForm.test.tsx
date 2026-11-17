// @vitest-environment jsdom

import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ChartOptions,
  OptionSection,
} from "@/entities/chart/model/chart-options";
import type { ChartType, ColumnName, DatasetId } from "@/shared/api/types";
import { renderWithI18n } from "@/shared/lib/render-with-i18n";
import type { OptionsFormValues } from "../model/options-form";
import type { OrderSource } from "../model/order-values";
import { OptionSectionForm } from "./OptionSectionForm";

// 값 목록은 서버에서 받으므로 고정한 값으로 바꾼다. 어떤 컬럼을 물었는지 기록한다.
const asked = vi.hoisted(() => [] as { kind: string; column: string | null }[]);
vi.mock("../model/order-values", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../model/order-values")>()),
  useOrderValues: ({
    kind,
    column,
  }: {
    kind: "legend" | "category";
    column: string | null;
  }) => {
    asked.push({ kind, column });
    return {
      values: kind === "legend" ? ["L1", "L10", "L2"] : ["A", "B"],
      tooMany: false,
      loading: false,
    };
  },
}));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        start: i * 28,
      })),
    getTotalSize: () => count * 28,
    scrollToIndex: () => {},
  }),
}));

const DEFAULTS: ChartOptions = CHART_DEFAULTS.options;
const SOURCE: OrderSource = {
  dataset: "iot" as DatasetId,
  legend: "line" as ColumnName,
  category: "lot" as ColumnName,
  ready: true,
};

let latest: OptionsFormValues | undefined;

function Watch() {
  const values = useWatch<OptionsFormValues>();
  latest = values as OptionsFormValues;
  return null;
}

function Harness({
  section,
  part,
  chartType,
  options = DEFAULTS,
}: {
  section: OptionSection;
  part?: string;
  chartType: ChartType;
  options?: ChartOptions;
}) {
  const form = useForm<OptionsFormValues>({
    defaultValues: { options, resetSections: [] },
  });
  return (
    <FormProvider {...form}>
      <OptionSectionForm
        section={section}
        part={part}
        chartType={chartType}
        orderSource={SOURCE}
        original={undefined}
        base={DEFAULTS}
        resetLabel="되돌리기"
        disabled={false}
      />
      <Watch />
    </FormProvider>
  );
}

afterEach(() => {
  cleanup();
  asked.length = 0;
  latest = undefined;
});

describe("OptionSectionForm 새 칸", () => {
  it("강조 방식을 바꾸면 그 방식의 칸만 보인다", () => {
    renderWithI18n(<Harness section="focus" chartType="scatter" />);
    expect(screen.getByLabelText("조건")).toBeTruthy();
    expect(screen.queryByLabelText("개수")).toBeNull();

    fireEvent.change(screen.getByLabelText("방식"), {
      target: { value: "rank" },
    });
    expect(screen.queryByLabelText("조건")).toBeNull();
    expect(screen.getByLabelText("방향")).toBeTruthy();
    expect(screen.getByLabelText("개수")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("방식"), {
      target: { value: "range" },
    });
    expect(screen.queryByLabelText("개수")).toBeNull();
    const min = screen.getByLabelText("최소 (포함)") as HTMLInputElement;
    expect(min.placeholder).toBe("끝 없음");
    fireEvent.change(min, { target: { value: "20" } });
    expect(latest?.options.focus).toMatchObject({
      type: "range",
      rangeMin: 20,
      rangeMax: null,
    });
    // 색·모양은 방식과 상관없이 보인다.
    expect(screen.getByLabelText("모양")).toBeTruthy();
  });

  it("legend 순서는 legend 컬럼 값을 늘어놓고, 끌어 옮긴 순서를 폼에 넣는다", () => {
    renderWithI18n(
      <Harness
        section="legend"
        chartType="bar"
        options={{
          ...DEFAULTS,
          legend: { ...DEFAULTS.legend, sort: "natural" },
        }}
      />,
    );
    expect(asked).toContainEqual({ kind: "legend", column: "line" });
    const rows = screen.getAllByRole("listitem");
    // 자연 정렬: L1, L2, L10
    expect(rows.map((li) => li.querySelector("span")?.textContent)).toEqual([
      "L1",
      "L2",
      "L10",
    ]);
    fireEvent.keyDown(within(rows[2]).getByRole("button"), {
      key: "ArrowUp",
      altKey: true,
    });
    expect(latest?.options.legend.order).toEqual(["L1", "L10"]);
  });

  it("범주 순서는 범주 x축 차트의 X축에만 있다", () => {
    const { unmount } = renderWithI18n(
      <Harness section="axes" part="x" chartType="bar" />,
    );
    expect(screen.getByLabelText("범주 정렬")).toBeTruthy();
    expect(asked).toContainEqual({ kind: "category", column: "lot" });
    unmount();
    renderWithI18n(<Harness section="axes" part="x" chartType="scatter" />);
    expect(screen.queryByLabelText("범주 정렬")).toBeNull();
  });

  it("이상치 처리는 이상치 가리기를 켜야 보인다", () => {
    renderWithI18n(<Harness section="value" chartType="scatter" />);
    expect(screen.queryByLabelText("이상치 처리")).toBeNull();
    fireEvent.click(screen.getByLabelText("이상치 가리기"));
    fireEvent.change(screen.getByLabelText("이상치 처리"), {
      target: { value: "only" },
    });
    expect(latest?.options.value).toMatchObject({
      outlier: true,
      outlierMode: "only",
    });
  });

  it("부제목 정렬을 비우면 null(제목 따라감)이다", () => {
    renderWithI18n(<Harness section="title" chartType="scatter" />);
    const align = screen.getByLabelText("부제목 정렬") as HTMLSelectElement;
    expect(align.value).toBe("");
    fireEvent.change(align, { target: { value: "right" } });
    expect(latest?.options.title.subtitleAlign).toBe("right");
    fireEvent.change(align, { target: { value: "" } });
    expect(latest?.options.title.subtitleAlign).toBeNull();
    const size = screen.getByLabelText("부제목 글자 크기") as HTMLInputElement;
    expect(size.placeholder).toBe("제목 따라감");
  });

  it("팔레트 색 목록: 더하고 빼고, 8개에서 더하기를 막는다", () => {
    renderWithI18n(<Harness section="palette" chartType="scatter" />);
    const add = () => screen.getByRole("button", { name: "색 더하기" });
    fireEvent.click(add());
    fireEvent.click(add());
    expect(latest?.options.palette.colors).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "1번째 색 빼기" }));
    expect(latest?.options.palette.colors).toHaveLength(1);
    for (let i = 0; i < 7; i++) fireEvent.click(add());
    expect(latest?.options.palette.colors).toHaveLength(8);
    expect(screen.queryByRole("button", { name: "색 더하기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "기본 팔레트로" }));
    expect(latest?.options.palette.colors).toEqual([]);
  });
});
