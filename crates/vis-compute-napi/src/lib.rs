//! 같은 커널(vis-compute)을 Node 네이티브 애드온으로. typed array는 복사 없이 빌려 쓴다.
//! 실험용 비교 대상이다. 앱은 정적 export라 브라우저에서 이 애드온을 쓸 수 없다.

use napi::bindgen_prelude::{Float32Array, Float64Array, Int32Array};
use napi_derive::napi;
use vis_compute::{argsort_by, bin_points, m4, Linear, Plot};

#[napi]
pub fn argsort(xs: Float64Array, mut idx: Int32Array) {
    // SAFETY: 호출하는 동안 JS가 같은 버퍼를 건드리지 않는다 (동기 호출).
    argsort_by(&xs, unsafe { idx.as_mut() });
}

#[napi]
#[allow(clippy::too_many_arguments)]
pub fn m4_downsample(
    order: Int32Array,
    from: u32,
    to: u32,
    sx: Float32Array,
    sy: Float32Array,
    range0: f64,
    range1: f64,
    mut out: Int32Array,
) -> u32 {
    m4(&order, from as usize, to as usize, &sx, &sy, (range0, range1), unsafe { out.as_mut() }) as u32
}

/// params: x d0, d1, r0, r1 / y d0, d1, r0, r1 / plot left, top
#[napi]
#[allow(clippy::too_many_arguments)]
pub fn bin(
    xs: Float64Array,
    ys: Float64Array,
    params: Float64Array,
    width: u32,
    height: u32,
    mut sx: Float32Array,
    mut sy: Float32Array,
    mut cell: Int32Array,
    mut kept: Int32Array,
) -> u32 {
    let p = &params;
    bin_points(
        &xs,
        &ys,
        Linear { d0: p[0], d1: p[1], r0: p[2], r1: p[3] },
        Linear { d0: p[4], d1: p[5], r0: p[6], r1: p[7] },
        Plot { left: p[8], top: p[9], width: width as usize, height: height as usize },
        unsafe { sx.as_mut() },
        unsafe { sy.as_mut() },
        unsafe { cell.as_mut() },
        unsafe { kept.as_mut() },
    ) as u32
}
