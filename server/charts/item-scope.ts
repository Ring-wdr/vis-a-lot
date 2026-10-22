// item 하나가 그린 행의 범위. 데이터 표와 데이터 다운로드가 DB에 넘긴다.

import type { ItemRowsScope } from "../data/item-rows";
import { markPoint } from "../render/category";
import { regionTester } from "../render/region";
import type { ChartItem, ChartRecord } from "./chart-store";

/** 차트에 쓴 컬럼: split by → x → y → legend → 툴팁 순서, 겹치면 한 번만 */
export function chartColumns(chart: ChartRecord) {
  const { spec } = chart;
  return [
    ...new Set([
      ...spec.splitBy,
      spec.x,
      spec.y,
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
  if (!item.selection || !meta || meta.chartType === "scatter") return [];
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

export function itemRowsScope(
  chart: ChartRecord,
  item: ChartItem,
): ItemRowsScope {
  const { spec } = chart;
  const scatter = spec.chartType === "scatter";
  return {
    chartType: spec.chartType,
    x: spec.x,
    y: spec.y,
    legend: spec.legend,
    splitBy: spec.splitBy,
    splitValues: item.values,
    columns: chartColumns(chart),
    filters: spec.filters,
    deletions: scatter ? item.deletions : [],
    selection: scatter ? item.selection : undefined,
    selectedMarks:
      !scatter && item.selection ? selectedMarks(chart, item) : undefined,
    hiddenLegend: item.props?.hiddenLegend,
  };
}
