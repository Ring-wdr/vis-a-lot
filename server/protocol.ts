// Worker별 RPC 메서드 정의.

import type { ColumnInfo, DatasetStatus } from "./api/types";
import type { RowSize } from "./data/schema";

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
};

export type RenderMethods = {
  /** 1단계 검증용: 임의의 점을 그려 PNG를 만든다. */
  renderTest: {
    params: { width: number; height: number; label: string; points: number };
    result: { png: ArrayBuffer; worker: string; ms: number };
  };
};
