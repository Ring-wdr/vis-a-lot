// crates/vis-compute-napi 애드온의 모양 (Node 전용 실험 비교 대상). `pnpm napi:build`가
// crates/target/vis-compute-napi.node를 만든다. 앱은 정적 export라 이 애드온을 쓸 곳이 없다.

import { existsSync } from "node:fs";
import { createRequire } from "node:module";

export type ComputeNapi = {
  argsort(xs: Float64Array, idx: Int32Array): void;
  m4Downsample(
    order: Int32Array,
    from: number,
    to: number,
    sx: Float32Array,
    sy: Float32Array,
    r0: number,
    r1: number,
    out: Int32Array,
  ): number;
  bin(
    xs: Float64Array,
    ys: Float64Array,
    params: Float64Array,
    width: number,
    height: number,
    sx: Float32Array,
    sy: Float32Array,
    cell: Int32Array,
    kept: Int32Array,
  ): number;
};

export const NAPI_PATH = new URL(
  "../../crates/target/vis-compute-napi.node",
  import.meta.url,
);

/** 애드온을 빌드해 뒀으면 읽고, 없으면 undefined */
export function loadComputeNapi(): ComputeNapi | undefined {
  if (!existsSync(NAPI_PATH)) return undefined;
  return createRequire(import.meta.url)(NAPI_PATH.pathname) as ComputeNapi;
}
