// Worker별 RPC 메서드 정의.

export type DbMethods = {
  ping: {
    params: undefined;
    result: { version: string; bootCount: number; bootMs: number };
  };
  query: {
    params: { sql: string; params?: unknown[] };
    result: { rows: Record<string, unknown>[] };
  };
};

export type RenderMethods = {
  /** 1단계 검증용: 임의의 점을 그려 PNG를 만든다. */
  renderTest: {
    params: { width: number; height: number; label: string; points: number };
    result: { png: ArrayBuffer; worker: string; ms: number };
  };
};
