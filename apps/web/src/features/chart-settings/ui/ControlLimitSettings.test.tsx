// @vitest-environment jsdom

import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";
import type {
  ChartOptions,
  LimitLine,
} from "@/entities/chart/model/chart-options";
import type { ChartSpec, ColumnInfo } from "@/shared/api/types";
import { renderWithI18n } from "@/shared/lib/render-with-i18n";
import { limitSourceOf } from "../model/control-limit-form";
import type { OptionsFormValues } from "../model/options-form";
import { OptionSectionForm } from "./OptionSectionForm";

const DEFAULTS: ChartOptions = CHART_DEFAULTS.options;

const col = (name: string, type: ColumnInfo["type"]): ColumnInfo => ({
  name,
  label: `${name} 라벨`,
  type,
  nullable: true,
  distinct: null,
});
const COLUMNS = [
  col("ts", "datetime"),
  col("value", "numeric"),
  col("temp", "numeric"),
  col("factory", "categorical"),
];

let latest: OptionsFormValues | undefined;

function Watch() {
  latest = useWatch<OptionsFormValues>() as OptionsFormValues;
  return null;
}

const NO_LINES: LimitLine[] = [];

function Harness({
  spec,
  lines = NO_LINES,
}: {
  spec: Pick<ChartSpec, "chartType" | "subType" | "x" | "y">;
  lines?: LimitLine[];
}) {
  const options = {
    ...DEFAULTS,
    controlLimit: { ...DEFAULTS.controlLimit, lines },
  };
  const form = useForm<OptionsFormValues>({
    defaultValues: { options, resetSections: [] },
  });
  return (
    <FormProvider {...form}>
      <OptionSectionForm
        section="controlLimit"
        chartType={spec.chartType}
        limitSource={limitSourceOf(spec, COLUMNS)}
        original={undefined}
        base={DEFAULTS}
        resetLabel="되돌리기"
        disabled={false}
      />
      <Watch />
    </FormProvider>
  );
}

const scatter = { chartType: "scatter", x: "ts", y: "value" } as const;
const lines = () => latest?.options.controlLimit.lines ?? [];
const kindSelect = () =>
  screen.getByLabelText("더할 선 종류") as HTMLSelectElement;
const add = (kind: string) => {
  fireEvent.change(kindSelect(), { target: { value: kind } });
  fireEvent.click(screen.getByRole("button", { name: "선 더하기" }));
};
const cards = () => screen.getAllByRole("listitem");

afterEach(() => {
  cleanup();
  latest = undefined;
});

describe("관리선 설정", () => {
  it("낱개 칸(이탈 강조·영역·글자·축 범위)과 선 목록을 함께 그린다", () => {
    renderWithI18n(<Harness spec={scatter} />);
    expect(screen.getByLabelText("규격 이탈 강조")).toBeTruthy();
    expect(screen.getByLabelText("채울 쪽")).toBeTruthy();
    expect(screen.getByLabelText("선이 보이도록 축 범위 넓히기")).toBeTruthy();
    expect(screen.getByText("선 목록")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("영역 채우기"));
    expect(latest?.options.controlLimit.area.visible).toBe(true);
  });

  it("종류마다 그 종류의 칸만 보인다", () => {
    renderWithI18n(<Harness spec={scatter} />);
    add("reference");
    add("column");
    add("band");
    expect(lines().map((l) => [l.kind, l.name])).toEqual([
      ["reference", "기준선 1"],
      ["column", "컬럼 선 1"],
      ["band", "띠 1"],
    ]);
    const [reference, column, band] = cards().map((li) => within(li));
    expect(reference.getByLabelText("값")).toBeTruthy();
    expect(reference.getByLabelText("규격")).toBeTruthy();
    expect(reference.queryByLabelText("컬럼")).toBeNull();
    expect(reference.queryByLabelText("구간별 값 (계단선)")).toBeNull();

    expect(column.getByLabelText("컬럼")).toBeTruthy();
    expect(column.getByLabelText("함수")).toBeTruthy();
    expect(column.getByLabelText("규격")).toBeTruthy();
    expect(column.queryByLabelText("값")).toBeNull();
    expect(column.getByLabelText("구간별 값 (계단선)")).toBeTruthy();

    expect(band.getByLabelText("컬럼 1")).toBeTruthy();
    expect(band.getByLabelText("컬럼 2")).toBeTruthy();
    expect(band.queryByLabelText("규격")).toBeNull();
    expect(band.queryByLabelText("함수")).toBeNull();
  });

  it("컬럼 select에는 숫자 컬럼만 보인다", () => {
    renderWithI18n(<Harness spec={scatter} />);
    add("column");
    const select = within(cards()[0]).getByLabelText(
      "컬럼",
    ) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(["value", "temp"]);
    fireEvent.change(select, { target: { value: "temp" } });
    expect(lines()[0]).toMatchObject({ column: "temp" });
  });

  it("칸을 고치면 폼의 선이 바뀌고, 순서를 옮기고 지울 수 있다", () => {
    renderWithI18n(<Harness spec={scatter} />);
    add("reference");
    add("reference");
    const first = within(cards()[0]);
    fireEvent.change(first.getByLabelText("값"), { target: { value: "80" } });
    fireEvent.change(first.getByLabelText("규격"), {
      target: { value: "usl" },
    });
    fireEvent.change(first.getByLabelText("선 이름"), {
      target: { value: "상한" },
    });
    expect(lines()[0]).toMatchObject({ name: "상한", value: 80, type: "usl" });
    fireEvent.click(screen.getByRole("button", { name: "상한 선을 아래로" }));
    expect(lines().map((l) => l.name)).toEqual(["기준선 2", "상한"]);
    fireEvent.click(screen.getByRole("button", { name: "기준선 2 선 지우기" }));
    expect(lines().map((l) => l.name)).toEqual(["상한"]);
  });

  it("시계열 x의 Bottom 기준선은 시각(KST)으로 받는다", () => {
    renderWithI18n(<Harness spec={scatter} />);
    add("reference");
    const card = within(cards()[0]);
    fireEvent.change(card.getByLabelText("축"), {
      target: { value: "bottom" },
    });
    expect(card.queryByLabelText("값")).toBeNull();
    // 값을 적기 전에는 사유를 보인다.
    expect(card.getByText("시각을 적어 주세요.")).toBeTruthy();
    fireEvent.change(card.getByLabelText("시각 (KST)"), {
      target: { value: "2026-11-01T09:00" },
    });
    expect(lines()[0]).toMatchObject({
      axis: "bottom",
      value: "2026-11-01T09:00:00+09:00",
    });
    expect(card.queryByText("시각을 적어 주세요.")).toBeNull();
  });

  it("bar Stack은 기준선만, Side는 기준선·컬럼 선을 Left 축에 더하고 구간별은 없다", () => {
    const { unmount } = renderWithI18n(
      <Harness
        spec={{ chartType: "bar", subType: "stack", x: "factory", y: "value" }}
      />,
    );
    expect([...kindSelect().options].map((o) => o.value)).toEqual([
      "reference",
    ]);
    unmount();
    renderWithI18n(
      <Harness spec={{ chartType: "bar", x: "factory", y: "value" }} />,
    );
    expect([...kindSelect().options].map((o) => o.value)).toEqual([
      "reference",
      "column",
    ]);
    add("column");
    const card = within(cards()[0]);
    const axis = card.getByLabelText("축") as HTMLSelectElement;
    expect([...axis.options].map((o) => o.value)).toEqual(["left"]);
    expect(card.queryByLabelText("구간별 값 (계단선)")).toBeNull();
  });

  it("차트에 맞지 않게 된 선과 겹치는 이름에 사유를 적는다", () => {
    const base = {
      axis: "left",
      color: "#000000",
      width: 1,
      style: "solid",
    } as const;
    renderWithI18n(
      <Harness
        spec={{ chartType: "bar", subType: "stack", x: "factory", y: "value" }}
        lines={[
          {
            ...base,
            name: "평균",
            kind: "column",
            column: "value",
            fn: "avg",
            type: "none",
            multi: false,
          },
          { ...base, name: "A", kind: "reference", value: 1, type: "usl" },
          { ...base, name: "A", kind: "reference", value: 2, type: "none" },
        ]}
      />,
    );
    const [column, , dup] = cards().map((li) => within(li));
    expect(
      column.getByText("이 차트의 Left 축에는 이 종류의 선을 쓸 수 없습니다."),
    ).toBeTruthy();
    expect(dup.getByText("같은 이름의 선이 이미 있습니다.")).toBeTruthy();
  });

  it("10개가 되면 더하기를 막는다", () => {
    renderWithI18n(<Harness spec={scatter} />);
    for (let i = 0; i < 10; i++) add("reference");
    expect(lines()).toHaveLength(10);
    expect(
      (screen.getByRole("button", { name: "선 더하기" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("구역을 되돌리면 선 목록도 기본값으로 돌아간다", () => {
    renderWithI18n(<Harness spec={scatter} />);
    add("band");
    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    expect(lines()).toEqual([]);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(latest?.resetSections).toEqual(["controlLimit"]);
  });
});
