// crates/vis-compute를 wasm32로 빌드한 모듈(vis-compute.wasm)의 JS 래퍼. 실험용이며 렌더러는 쓰지 않는다.
// 브라우저(Worker)든 Node든 바이트나 컴파일한 Module만 넘기면 된다. import·glue 코드가 없다.
//
// 두 가지 호출 방식을 준다.
// - copy: JS typed array를 선형 메모리로 복사하고, 결과를 다시 JS로 복사한다 (지금 구조에 끼울 때의 비용).
// - resident: 데이터가 처음부터 선형 메모리에 있다고 보고 포인터로만 부른다 (복사 제외).

import type { BinPlot, BinResult, LinearAxis } from "./kernels";

type Exports = {
  memory: WebAssembly.Memory;
  alloc(bytes: number): number;
  dealloc(ptr: number, bytes: number): void;
  argsort(xs: number, nXs: number, idx: number, nIdx: number): void;
  m4_downsample(
    order: number,
    nOrder: number,
    from: number,
    to: number,
    sx: number,
    sy: number,
    nPoints: number,
    range0: number,
    range1: number,
    out: number,
  ): number;
  bin(
    xs: number,
    ys: number,
    n: number,
    params: number,
    width: number,
    height: number,
    sx: number,
    sy: number,
    cell: number,
    kept: number,
  ): number;
};

type TypedArrayCtor =
  | Float64ArrayConstructor
  | Float32ArrayConstructor
  | Int32ArrayConstructor;

/** 선형 메모리 안의 배열. memory가 자라면 view를 다시 만들어야 하므로 매번 view()로 꺼낸다. */
export type Resident<T extends Float64Array | Float32Array | Int32Array> = {
  ptr: number;
  length: number;
  view(): T;
  free(): void;
};

export type ComputeWasm = ReturnType<typeof bindExports>;

export async function loadComputeWasm(
  source: BufferSource | WebAssembly.Module,
): Promise<ComputeWasm> {
  const module =
    source instanceof WebAssembly.Module
      ? source
      : await WebAssembly.compile(source);
  const instance = await WebAssembly.instantiate(module, {});
  return bindExports(instance.exports as unknown as Exports);
}

function bindExports(e: Exports) {
  function allocate<T extends Float64Array | Float32Array | Int32Array>(
    Ctor: TypedArrayCtor,
    length: number,
  ): Resident<T> {
    const bytes = length * Ctor.BYTES_PER_ELEMENT;
    const ptr = e.alloc(bytes);
    return {
      ptr,
      length,
      view: () => new Ctor(e.memory.buffer, ptr, length) as T,
      free: () => e.dealloc(ptr, bytes),
    };
  }
  function copyIn<T extends Float64Array | Float32Array | Int32Array>(
    src: T,
  ): Resident<T> {
    const r = allocate<T>(src.constructor as TypedArrayCtor, src.length);
    r.view().set(src);
    return r;
  }

  const resident = {
    argsort(xs: Resident<Float64Array>, idx: Resident<Int32Array>) {
      e.argsort(xs.ptr, xs.length, idx.ptr, idx.length);
    },
    m4(
      order: Resident<Int32Array>,
      from: number,
      to: number,
      sx: Resident<Float32Array>,
      sy: Resident<Float32Array>,
      range: [number, number],
      out: Resident<Int32Array>,
    ): number {
      return e.m4_downsample(
        order.ptr,
        order.length,
        from,
        to,
        sx.ptr,
        sy.ptr,
        sx.length,
        range[0],
        range[1],
        out.ptr,
      );
    },
    bin(
      xs: Resident<Float64Array>,
      ys: Resident<Float64Array>,
      params: Resident<Float64Array>,
      plot: BinPlot,
      sx: Resident<Float32Array>,
      sy: Resident<Float32Array>,
      cell: Resident<Int32Array>,
      kept: Resident<Int32Array>,
    ): number {
      return e.bin(
        xs.ptr,
        ys.ptr,
        xs.length,
        params.ptr,
        plot.width,
        plot.height,
        sx.ptr,
        sy.ptr,
        cell.ptr,
        kept.ptr,
      );
    },
  };

  /** 복사 포함: JS 배열을 받아 JS 배열을 돌려준다. 호출마다 할당하고 해제한다. */
  const copy = {
    argsort(xs: Float64Array, idx: Int32Array) {
      const rx = copyIn(xs);
      const ri = copyIn(idx);
      resident.argsort(rx, ri);
      idx.set(ri.view());
      rx.free();
      ri.free();
    },
    m4(
      order: Int32Array,
      from: number,
      to: number,
      sx: Float32Array,
      sy: Float32Array,
      range: [number, number],
    ): Int32Array {
      const ro = copyIn(order);
      const rsx = copyIn(sx);
      const rsy = copyIn(sy);
      const out = allocate<Int32Array>(Int32Array, Math.max(0, to - from));
      const n = resident.m4(ro, from, to, rsx, rsy, range, out);
      const result = out.view().slice(0, n);
      for (const r of [ro, rsx, rsy, out]) r.free();
      return result;
    },
    bin(
      xs: Float64Array,
      ys: Float64Array,
      xAxis: LinearAxis,
      yAxis: LinearAxis,
      plot: BinPlot,
    ): BinResult {
      const n = xs.length;
      const rx = copyIn(xs);
      const ry = copyIn(ys);
      const params = copyIn(binParams(xAxis, yAxis, plot));
      const sx = allocate<Float32Array>(Float32Array, n);
      const sy = allocate<Float32Array>(Float32Array, n);
      const cell = allocate<Int32Array>(Int32Array, plot.width * plot.height);
      const kept = allocate<Int32Array>(Int32Array, n);
      const m = resident.bin(rx, ry, params, plot, sx, sy, cell, kept);
      const result = {
        sx: sx.view().slice(),
        sy: sy.view().slice(),
        kept: kept.view().slice(0, m),
      };
      for (const r of [rx, ry, params, sx, sy, cell, kept]) r.free();
      return result;
    },
  };

  return { exports: e, allocate, copyIn, resident, copy };
}

/** bin 커널의 축·그림 영역 인자 10개 */
export function binParams(
  x: LinearAxis,
  y: LinearAxis,
  plot: BinPlot,
): Float64Array {
  return Float64Array.of(
    x.d0,
    x.d1,
    x.r0,
    x.r1,
    y.d0,
    y.d1,
    y.r0,
    y.r1,
    plot.left,
    plot.top,
  );
}
