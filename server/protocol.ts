// Worker별 RPC 메서드 정의.

import type { ColumnInfo, DatasetStatus } from "./api/types";
import type { ChartData, ChartDataParams } from "./data/chart-data";
import type { ColumnName, RowSize } from "./data/schema";
import type { RenderStage, ScatterInput, ScatterMeta } from "./render/scatter";

export type DbMethods = {
  ping: {
    params: undefined;
    result: { version: string; bootCount: number; bootMs: number };
  };
  query: {
    params: { sql: string; params?: unknown[] };
    result: { rows: Record<string, unknown>[] };
  };
  datasetStatuses: { params: undefined; result: DatasetStatus[] };
  /** 없으면 생성을 시작하고 바로 현재 상태를 돌려준다. 생성은 한 번에 하나씩 순서대로 한다. */
  ensureDataset: { params: { rows: RowSize }; result: DatasetStatus };
  datasetColumns: { params: { rows: RowSize }; result: ColumnInfo[] | null };
  /** split 조합 개수. exact가 false면 고유값 곱으로 낸 상한이다. */
  splitCount: {
    params: { rows: RowSize; cols: ColumnName[]; limit: number };
    result: { count: number; exact: boolean };
  };
  /** job 하나에 필요한 데이터를 한 번에 조회해 split 조합별로 나눈다. */
  chartData: { params: ChartDataParams; result: ChartData };
};

export type RenderMethods = {
  /** 1단계 검증용: 임의의 점을 그려 PNG를 만든다. */
  renderTest: {
    params: { width: number; height: number; label: string; points: number };
    result: { png: ArrayBuffer; worker: string; ms: number };
  };
  renderScatter: {
    params: ScatterInput;
    result: { png: ArrayBuffer; meta: ScatterMeta; worker: string; ms: number };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
};
