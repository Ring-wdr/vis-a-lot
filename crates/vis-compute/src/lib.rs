//! 렌더 Worker의 순수 연산 커널을 Rust로 옮긴 실험 구현.
//! JS 쪽 원본은 server/render/line.ts(seriesOrder, m4)와 server/render/scatter.ts(픽셀 칸 줄이기)다.
//! 결과는 server/compute/kernels.ts의 JS 구현과 같아야 한다 (server/compute/parity.test.ts).
//!
//! wasm32에서는 wasm-bindgen 없이 C ABI 함수와 alloc/dealloc만 내보낸다.
//! JS가 선형 메모리에 typed array를 직접 쓰고 읽으므로 "복사 포함/제외"를 따로 잴 수 있다.

/// f64 → 크기 순서를 지키는 u64 키. -0은 0과 같은 키로 둔다 (JS 비교 `a - b`에서 둘은 같다).
#[inline]
fn order_key(v: f64) -> u64 {
    let v = if v == 0.0 { 0.0 } else { v };
    let bits = v.to_bits();
    if bits >> 63 == 1 {
        !bits
    } else {
        bits | (1 << 63)
    }
}

/// `idx`를 xs 값 순으로 정렬한다. 값이 같으면 원래 인덱스 순서 (JS `xs[a] - xs[b] || a - b`).
/// NaN은 JS와 같게 다루지 않는다 (입력은 SQL에서 null을 걸러 유한한 값이다).
/// 11비트씩 6번 도는 LSD 기수 정렬이다 (안정). 모든 키가 같은 칸에 드는 자리는 건너뛴다.
pub fn argsort_by(xs: &[f64], idx: &mut [i32]) {
    // 이미 정렬돼 있으면 그대로 (시각 순으로 쌓인 데이터가 많다).
    if idx.windows(2).all(|w| xs[w[0] as usize] <= xs[w[1] as usize]) {
        return;
    }
    const BITS: u32 = 11;
    const RADIX: usize = 1 << BITS;
    let n = idx.len();
    let mut keys: Vec<u64> = idx.iter().map(|&i| order_key(xs[i as usize])).collect();
    let mut vals: Vec<i32> = idx.to_vec();
    let mut keys2 = vec![0u64; n];
    let mut vals2 = vec![0i32; n];
    let mut count = vec![0usize; RADIX];
    for pass in 0..6u32 {
        let shift = pass * BITS;
        count.fill(0);
        for &k in &keys {
            count[((k >> shift) as usize) & (RADIX - 1)] += 1;
        }
        if count.iter().any(|&c| c == n) {
            continue;
        }
        let mut sum = 0;
        for c in count.iter_mut() {
            let t = *c;
            *c = sum;
            sum += t;
        }
        for (&k, &v) in keys.iter().zip(&vals) {
            let b = ((k >> shift) as usize) & (RADIX - 1);
            let at = count[b];
            count[b] += 1;
            keys2[at] = k;
            vals2[at] = v;
        }
        std::mem::swap(&mut keys, &mut keys2);
        std::mem::swap(&mut vals, &mut vals2);
    }
    idx.copy_from_slice(&vals);
}

/// 비교 정렬 판 (기수 정렬과 비교용). 결과는 argsort_by와 같다.
pub fn argsort_pdq(xs: &[f64], idx: &mut [i32]) {
    let mut pairs: Vec<(u64, i32)> = idx.iter().map(|&i| (order_key(xs[i as usize]), i)).collect();
    pairs.sort_unstable();
    for (slot, (_, i)) in idx.iter_mut().zip(pairs) {
        *slot = i;
    }
}

/// JS Math.round: 가장 가까운 정수, 반은 +∞ 쪽으로.
#[inline]
fn js_round(x: f64) -> f64 {
    let f = x.floor();
    if x - f >= 0.5 {
        f + 1.0
    } else {
        f
    }
}

/// M4 다운샘플 (server/render/line.ts m4, kernels.ts m4Fast와 같은 규칙). out에 원래 행 번호를 쓰고 개수를 돌려준다.
/// out 길이는 to - from 이상이어야 한다.
pub fn m4(order: &[i32], from: usize, to: usize, sx: &[f32], sy: &[f32], range: (f64, f64), out: &mut [i32]) -> usize {
    let lo = range.0.floor() - 1.0;
    let hi = range.1.ceil() + 1.0;
    let mut n = 0usize;
    let mut column = f64::NAN;
    let (mut first, mut min, mut max, mut last) = (usize::MAX, 0usize, 0usize, 0usize);
    let (mut min_y, mut max_y) = (0f32, 0f32);
    let mut k = from;
    loop {
        let mut c = 0.0;
        let mut y = 0.0;
        if k < to {
            let i = order[k] as usize;
            c = (sx[i] as f64).floor();
            if c < lo {
                c = lo;
            } else if c > hi {
                c = hi;
            }
            y = sy[i];
            if c == column {
                if y < min_y {
                    min = k;
                    min_y = y;
                }
                if y > max_y {
                    max = k;
                    max_y = y;
                }
                last = k;
                k += 1;
                continue;
            }
        }
        if first != usize::MAX {
            let (a, b) = if min < max { (min, max) } else { (max, min) };
            out[n] = order[first];
            n += 1;
            if a != first {
                out[n] = order[a];
                n += 1;
            }
            if b != a {
                out[n] = order[b];
                n += 1;
            }
            if last != b {
                out[n] = order[last];
                n += 1;
            }
        }
        if k >= to {
            break;
        }
        column = c;
        first = k;
        min = k;
        max = k;
        last = k;
        min_y = y;
        max_y = y;
        k += 1;
    }
    n
}

/// d3 scaleLinear와 같은 식: t = (v - d0) / (d1 - d0), r0 * (1 - t) + r1 * t.
#[derive(Clone, Copy)]
pub struct Linear {
    pub d0: f64,
    pub d1: f64,
    pub r0: f64,
    pub r1: f64,
}

impl Linear {
    #[inline]
    fn at(&self, v: f64) -> f64 {
        let span = self.d1 - self.d0;
        let t = if span != 0.0 { (v - self.d0) / span } else { 0.5 };
        self.r0 * (1.0 - t) + self.r1 * t
    }
}

/// 그림 영역의 픽셀 범위
#[derive(Clone, Copy)]
pub struct Plot {
    pub left: f64,
    pub top: f64,
    pub width: usize,
    pub height: usize,
}

/// scatter 집계 단계: 점을 픽셀 좌표(sx, sy, f32)로 옮기고, 픽셀 칸마다 처음 든 점만 kept에 남긴다.
/// cell은 width * height 길이의 작업 공간이다. kept 개수를 돌려준다.
pub fn bin_points(
    xs: &[f64],
    ys: &[f64],
    x: Linear,
    y: Linear,
    plot: Plot,
    sx: &mut [f32],
    sy: &mut [f32],
    cell: &mut [i32],
    kept: &mut [i32],
) -> usize {
    cell.fill(-1);
    let mut n = 0;
    for i in 0..xs.len() {
        let cx = x.at(xs[i]);
        let cy = y.at(ys[i]);
        sx[i] = cx as f32;
        sy[i] = cy as f32;
        let ix = js_round(cx - plot.left);
        let iy = js_round(cy - plot.top);
        if ix >= 0.0 && iy >= 0.0 && ix < plot.width as f64 && iy < plot.height as f64 {
            let idx = iy as usize * plot.width + ix as usize;
            if cell[idx] == -1 {
                cell[idx] = i as i32;
                kept[n] = i as i32;
                n += 1;
            }
        }
    }
    n
}

#[cfg(target_arch = "wasm32")]
mod wasm {
    //! JS가 부르는 C ABI. 포인터는 선형 메모리 안의 바이트 오프셋이다.
    use super::*;
    use std::alloc::{alloc as raw_alloc, dealloc as raw_dealloc, Layout};
    use std::slice::{from_raw_parts, from_raw_parts_mut};

    #[no_mangle]
    pub extern "C" fn alloc(bytes: usize) -> *mut u8 {
        if bytes == 0 {
            return 8 as *mut u8;
        }
        unsafe { raw_alloc(Layout::from_size_align_unchecked(bytes, 8)) }
    }

    #[no_mangle]
    pub unsafe extern "C" fn dealloc(ptr: *mut u8, bytes: usize) {
        if bytes != 0 {
            raw_dealloc(ptr, Layout::from_size_align_unchecked(bytes, 8));
        }
    }

    #[no_mangle]
    pub unsafe extern "C" fn argsort(xs: *const f64, n_xs: usize, idx: *mut i32, n_idx: usize) {
        argsort_by(from_raw_parts(xs, n_xs), from_raw_parts_mut(idx, n_idx));
    }

    #[no_mangle]
    pub unsafe extern "C" fn m4_downsample(
        order: *const i32,
        n_order: usize,
        from: usize,
        to: usize,
        sx: *const f32,
        sy: *const f32,
        n_points: usize,
        range0: f64,
        range1: f64,
        out: *mut i32,
    ) -> usize {
        m4(
            from_raw_parts(order, n_order),
            from,
            to,
            from_raw_parts(sx, n_points),
            from_raw_parts(sy, n_points),
            (range0, range1),
            from_raw_parts_mut(out, to - from),
        )
    }

    #[no_mangle]
    pub unsafe extern "C" fn bin(
        xs: *const f64,
        ys: *const f64,
        n: usize,
        // x 축: d0, d1, r0, r1 / y 축: d0, d1, r0, r1 / plot: left, top
        params: *const f64,
        width: usize,
        height: usize,
        sx: *mut f32,
        sy: *mut f32,
        cell: *mut i32,
        kept: *mut i32,
    ) -> usize {
        let p = from_raw_parts(params, 10);
        bin_points(
            from_raw_parts(xs, n),
            from_raw_parts(ys, n),
            Linear { d0: p[0], d1: p[1], r0: p[2], r1: p[3] },
            Linear { d0: p[4], d1: p[5], r0: p[6], r1: p[7] },
            Plot { left: p[8], top: p[9], width, height },
            from_raw_parts_mut(sx, n),
            from_raw_parts_mut(sy, n),
            from_raw_parts_mut(cell, width * height),
            from_raw_parts_mut(kept, n),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn argsort_keeps_ties_in_index_order() {
        let xs = [3.0, 1.0, 3.0, -0.0, 0.0, -2.5];
        let mut idx = [0, 1, 2, 3, 4, 5];
        argsort_by(&xs, &mut idx);
        assert_eq!(idx, [5, 3, 4, 1, 0, 2]);
    }

    #[test]
    fn m4_keeps_extremes_per_column() {
        let order = [0, 1, 2, 3, 4];
        let sx = [0.1, 0.2, 0.3, 0.4, 1.5];
        let sy = [5.0, 1.0, 9.0, 4.0, 2.0];
        let mut out = [0; 5];
        let n = m4(&order, 0, 5, &sx, &sy, (0.0, 10.0), &mut out);
        assert_eq!(&out[..n], &[0, 1, 2, 3, 4]);
    }

    #[test]
    fn radix_and_pdq_agree() {
        let xs: Vec<f64> = (0..5000).map(|i| ((i * 7919) % 1013) as f64 - 500.0).collect();
        let mut a: Vec<i32> = (0..5000).collect();
        let mut b = a.clone();
        argsort_by(&xs, &mut a);
        argsort_pdq(&xs, &mut b);
        assert_eq!(a, b);
    }

    #[test]
    fn js_round_matches_math_round() {
        assert_eq!(js_round(-0.5), 0.0);
        assert_eq!(js_round(0.5), 1.0);
        assert_eq!(js_round(-1.5), -1.0);
        assert_eq!(js_round(2.4), 2.0);
    }
}
