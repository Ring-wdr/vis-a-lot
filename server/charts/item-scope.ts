// item 하나가 그린 행의 범위. 데이터 표와 데이터 다운로드가 DB에 넘긴다.

import type { ItemRowsScope } from "../data/item-rows";
import { markPoint } from "../render/category";
import { histogramMarkPoint } from "../render/histogram";
import { regionTester } from "../render/region";
import { CHART_FIELDS, isRowChart, POINT_CHARTS } from "./chart-fields";
import type { ChartItem, ChartRecord } from "./chart-store";

/** 차트에 쓴 컬럼: split by → x → y → legend → 툴팁 순서, 겹치면 한 번만. 쓰지 않는 y는 뺀다. */
export function chartColumns(chart: ChartRecord) {
  const { spec } = chart;
  return [
    ...new Set([
      ...spec.splitBy,
      spec.x,
      ...(CHART_FIELDS[spec.chartType].y ? [spec.y] : []),
      ...(spec.legend ? [spec.legend] : []),
      ...spec.tooltip,
    ]),
  ];
}

/**
 * bar/boxplot에서 선택 영역 안의 막대/상자 [범주, legend 값]. 렌더러와 같은 대표 좌표로 판정한다.
 * 그린 metadata가 없으면 빈 목록이다.
 */
function selectedMarks(chart: ChartRecord, item: ChartItem) {
  const meta = item.meta;
  if (!item.selection || !meta || !("categories" in meta)) return [];
  const inside = regionTester(item.selection);
  const legendValues = chart.spec.legend ? meta.legend?.values : undefined;
  const marks: [string, string | null][] = [];
  meta.categories.forEach((category, i) => {
    for (let g = 0; g < meta.groupCount; g++) {
      const value =
        meta.chartType === "bar"
          ? meta.bars?.[i]?.[g]
          : meta.boxes?.[i]?.[g]?.median;
      if (value === null || value === undefined) continue;
      if (inside(...markPoint(i, g, meta.groupCount, value)))
        marks.push([category, legendValues?.[g] ?? null]);
    }
  });
  return marks;
}

/** histogram에서 선택 영역 안의 막대 [구간 번호, legend 값]. 렌더러와 같은 대표 좌표로 판정한다. */
function selectedBins(chart: ChartRecord, item: ChartItem) {
  const meta = item.meta;
  // 그린 metadata가 없으면 선택된 구간도 없다 (빈 목록과 같다).
  if (!item.selection || meta?.chartType !== "histogram")
    return { bins: { lo: 0, step: 1, count: 1 }, marks: [] };
  const inside = regionTester(item.selection);
  const legendValues = chart.spec.legend ? meta.legend?.values : undefined;
  const marks: [number, string | null][] = [];
  meta.counts.forEach((row, i) => {
    row.forEach((count, g) => {
      if (count === 0) return;
      const point = histogramMarkPoint(meta.bins, i, g, meta.groupCount, count);
      if (inside(...point)) marks.push([i, legendValues?.[g] ?? null]);
    });
  });
  return { bins: meta.bins, marks };
}

/** 데이터 표·다운로드를 쓰지 않는 차트면 undefined */
export function itemRowsScope(
  chart: ChartRecord,
  item: ChartItem,
): ItemRowsScope | undefined {
  const { spec } = chart;
  if (!isRowChart(spec.chartType)) return undefined;
  const scatter = POINT_CHARTS.includes(spec.chartType);
  const histogram = spec.chartType === "histogram";
  return {
    chartType: spec.chartType,
    x: spec.x,
    y: CHART_FIELDS[spec.chartType].y ? spec.y : null,
    legend: spec.legend,
    splitBy: spec.splitBy,
    splitValues: item.values,
    columns: chartColumns(chart),
    filters: spec.filters,
    deletions: scatter ? item.deletions : [],
    selection: scatter ? item.selection : undefined,
    selectedMarks:
      !scatter && !histogram && item.selection
        ? selectedMarks(chart, item)
        : undefined,
    selectedBins:
      histogram && item.selection ? selectedBins(chart, item) : undefined,
    hiddenLegend: item.props?.hiddenLegend,
  };
}
