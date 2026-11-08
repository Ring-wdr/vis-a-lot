# WASM(Rust) 연산 도입 검토

"화면에서 처리하는 데이터가 많으니 client·server에 WebAssembly(Rust)를 넣으면 빨라질 것"이라는 조언을 수치로 확인했다. 결론부터 적으면 **지금은 WASM을 도입하지 않고, 같은 알고리즘을 순수 JS(typed array)로 고치는 것을 권한다.** 효과의 대부분(정렬 약 8배)이 알고리즘 교체에서 나오고, WASM이 그 위에 더하는 몫은 렌더 한 번 기준으로 0.5~5%다. 반면 Rust 툴체인, wasm 산출물 관리, 정합성 유지 비용은 매번 든다.

재현:

```sh
rustup target add wasm32-unknown-unknown
pnpm wasm:build              # crates/vis-compute → server/compute/vis-compute.wasm
pnpm napi:build              # crates/vis-compute-napi → crates/target/vis-compute-napi.node (선택)
pnpm bench:compute           # Node: 커널별 JS 원본·JS 최적화·WASM·napi
pnpm bench:compute:browser   # Chromium: 커널, Worker 안 renderScatter 단계별 시간, 메인 스레드 멈춤, 번들 크기
pnpm test server/compute     # 정합성 테스트 (napi는 빌드했을 때만)
```

## 이 앱의 "client"와 "server"

조사를 시작하며 알게 된 구조가 판단의 전제가 된다.

- `next.config.ts`는 `output: "export"`이다. **Node 서버가 없다.** `server/`는 브라우저 안에서 MSW(service worker), DB Worker(PGlite), 렌더 Worker 풀(OffscreenCanvas)로 돈다 (`server/runtime.ts`). 그래서 "server 쪽 연산"도 결국 사용자 브라우저의 Worker에서 돈다.
- 무거운 데이터 가공(집계·binning·통계·샘플·정렬된 표)은 대부분 **이미 SQL로 PGlite(WASM Postgres)** 에서 처리한다 (`server/data/*-data.ts`, `sample-rows.ts`. 표 정렬도 `order by`). 결과는 typed array로 렌더 Worker에 넘어간다.
- `src/`(화면)에는 큰 배열을 다루는 연산이 없다. `@tanstack/react-table`(`entities/post/ui/PostTable.tsx`)은 정렬·필터 row model을 쓰지 않고 서버가 준 한 페이지만 그린다. d3-hierarchy·d3-sankey는 렌더 Worker(`server/render/treemap.ts`, `sankey.ts`)에서 노드 수십~수백 개를 다룬다. exceljs·fflate·papaparse는 다운로드·업로드 때 한 번 도는 라이브러리 호출이라 다시 구현할 대상이 아니다.

따라서 JS로 남은 핫스팟은 **렌더 Worker 안에서 점 하나하나를 도는 루프**다. 따로 둘 메인 스레드 연산이 없어 `src/shared/lib`에는 래퍼를 두지 않았다. 실험 코드는 호출자 옆인 `server/compute/`에 있고, 렌더러는 아직 이 코드를 쓰지 않는다 (기존 동작은 바뀌지 않는다).

## 고른 커널

| 커널 | 원본 위치 | 하는 일 | 고른 이유 |
| --- | --- | --- | --- |
| **argsort** | `server/render/line.ts` `seriesOrder` | 계열별 점 인덱스를 x 순으로 정렬 (`idx.sort((a, b) => xs[a] - xs[b] \|\| a - b)`) | line 차트와 예측선이 쓴다. 비교 함수 정렬이라 느리다. 입력·출력이 typed array 둘뿐이다 |
| **m4** | `server/render/line.ts` `m4` | x 순 점을 픽셀 열마다 첫·최소·최대·끝 4점으로 다운샘플 | 순수 연산, LTTB 계열 다운샘플 |
| **bin** | `server/render/scatter.ts` 집계 루프 | 점을 픽셀 좌표로 옮기고(d3 scale) 픽셀 칸마다 첫 점만 남김 | scatter·line 모두 점마다 돈다 |

구현은 세 가지다.

- **JS 원본**: 지금 코드 그대로(`m4`, `seriesOrder`는 re-export). `bin`은 같은 모양의 루프다 (`binOriginal`, 선택·focus 처리만 뺐다).
- **JS 최적화** (`server/compute/kernels.ts`): argsort는 f64 비트를 순서 키로 바꾼 11비트 × 6회 LSD 기수 정렬(안정, 한 칸에 몰린 자리는 건너뜀). m4는 클로저, 4칸 `sort`, `push` 대신 비교 몇 번. bin은 d3 scale 호출을 같은 식(`r0·(1−t) + r1·t`)으로 풀어 쓰고 결과를 typed array에 쓴다.
- **Rust** (`crates/vis-compute`): JS 최적화와 **같은 알고리즘**이다. 처음에는 원본 알고리즘을 그대로 옮겼는데 m4가 1M행에서 최적화 JS보다 느렸다. 비교를 공정하게 하려고 맞췄다. wasm32는 C ABI 함수와 `alloc`/`dealloc`만 내보낸다 (아래 "wasm-bindgen을 안 쓴 이유"). napi 애드온(`crates/vis-compute-napi`)은 같은 crate를 napi-rs 3으로 감싸 typed array를 복사 없이 빌린다.

### 정합성

`server/compute/parity.test.ts`가 n = 0, 1, 2, 7, 1,000, 50,000과 까다로운 값(겹치는 x, `-0`/`0`, ±1e300, 범위 0인 축, 그림 밖의 점)에서 **JS 최적화·WASM·napi 결과가 원본과 비트 단위로 같은지** 확인한다. f32 좌표와 `Math.round`(반올림 방향이 +∞ 쪽인 점)까지 맞춘다. `bin`의 스케일 식이 d3 `scaleLinear`와 같은지도 따로 확인한다. Rust 단위 테스트(`cargo test`)는 기수 정렬과 비교 정렬 결과가 같은지 본다. 커밋한 `.wasm`으로 도는 테스트라 CI에 Rust가 없어도 된다.

## 측정 환경

| 항목 | 값 |
| --- | --- |
| 기기 | 클라우드 컨테이너 4 vCPU (x86_64, 공유). 절대값보다 구현끼리의 배수를 볼 것 |
| Node | 22.23 (V8 12.4) |
| 브라우저 | Headless Chromium 153 (Playwright). 렌더는 실제 렌더 Worker처럼 Worker 안 OffscreenCanvas 800×450, pixelRatio 1 |
| Rust | 1.97, `opt-level=3`, `lto`, `codegen-units=1`, `panic=abort` (SIMD 플래그 없음) |
| 데이터 | `server/compute/fixtures.ts`: 1년 범위 시각(epoch ms)을 섞은 x(10%는 앞 값과 같음, **정렬 안 됨**), 랜덤 워크 y. 시드 고정 |
| 방법 | 표본이 5ms보다 짧으면 표본 안에서 여러 번 돌려 나눈다. 워밍업 3회 뒤 Node 25회·브라우저 9회의 **중앙값**. 입력 준비(배열 복사)는 시간에 넣지 않는다 |
| WASM 복사 포함 | JS typed array → 선형 메모리 복사, 호출, 결과를 JS로 복사, 해제까지 전부 (지금 구조에 끼울 때의 비용) |
| WASM 복사 제외 | 데이터가 처음부터 선형 메모리에 있다고 보고 포인터로만 호출 |

## 결과: 커널

괄호는 같은 크기의 JS 원본 대비 배수다. 1.0×보다 크면 빠르다.

### Chromium (브라우저 = 실제 실행 환경)

**argsort**

| 구현 | 10,000 | 100,000 | 1,000,000 |
|---|---:|---:|---:|
| JS 원본 (비교 정렬) | 2.95 | 36.0 | 518.3 |
| JS 최적화 (기수 정렬) | 0.38 (7.9×) | 4.60 (7.8×) | 67.9 (7.6×) |
| WASM 복사 포함 | 0.28 (10.4×) | 3.05 (11.8×) | 34.1 (15.2×) |
| WASM 복사 제외 | 0.28 (10.6×) | 3.95 (9.1×) | 31.1 (16.7×) |

**m4**

| 구현 | 10,000 | 100,000 | 1,000,000 |
|---|---:|---:|---:|
| JS 원본 | 0.30 | 2.10 | 18.3 |
| JS 최적화 | 0.10 (2.9×) | 1.63 (1.3×) | 14.5 (1.3×) |
| WASM 복사 포함 | 0.06 (4.7×) | 0.61 (3.4×) | 10.2 (1.8×) |
| WASM 복사 제외 | 0.06 (5.1×) | 0.54 (3.9×) | 9.1 (2.0×) |

**bin**

| 구현 | 10,000 | 100,000 | 1,000,000 |
|---|---:|---:|---:|
| JS 원본 (d3 scale) | 2.20 | 11.9 | 77.3 |
| JS 최적화 | 0.48 (4.6×) | 4.80 (2.5×) | 45.7 (1.7×) |
| WASM 복사 포함 | 0.41 (5.4×) | 4.50 (2.6×) | 43.0 (1.8×) |
| WASM 복사 제외 | 0.27 (8.2×) | 3.75 (3.2×) | 34.2 (2.3×) |

브라우저의 `performance.now()`는 격리되지 않은 페이지에서 0.1ms 단위로 거칠어진다. 10,000행 칸은 반복 평균이라 쓸 수는 있지만 오차가 크다.

### Node (server 쪽 비교: Node wasm vs napi)

**argsort**

| 구현 | 10,000 | 100,000 | 1,000,000 |
|---|---:|---:|---:|
| JS 원본 | 2.57 | 31.5 | 448.8 |
| JS 최적화 | 0.38 (6.7×) | 3.88 (8.1×) | 69.9 (6.4×) |
| WASM 복사 포함 | 0.24 (10.7×) | 2.72 (11.6×) | 31.0 (14.5×) |
| WASM 복사 제외 | 0.22 (11.4×) | 2.50 (12.6×) | 29.0 (15.5×) |
| napi | 0.23 (11.1×) | 2.68 (11.8×) | 36.4 (12.3×) |

**m4**

| 구현 | 10,000 | 100,000 | 1,000,000 |
|---|---:|---:|---:|
| JS 원본 | 0.29 | 1.31 | 20.6 |
| JS 최적화 | 0.15 (1.9×) | 0.69 (1.9×) | 11.8 (1.7×) |
| WASM 복사 포함 | 0.06 (4.8×) | 0.63 (2.1×) | 12.2 (1.7×) |
| WASM 복사 제외 | 0.05 (6.2×) | 0.55 (2.4×) | 11.7 (1.8×) |
| napi | 0.07 (4.3×) | 0.59 (2.2×) | 12.0 (1.7×) |

**bin**

| 구현 | 10,000 | 100,000 | 1,000,000 |
|---|---:|---:|---:|
| JS 원본 | 1.08 | 14.8 | 86.7 |
| JS 최적화 | 0.35 (3.0×) | 3.91 (3.8×) | 38.0 (2.3×) |
| WASM 복사 포함 | 0.43 (2.5×) | 4.00 (3.7×) | 42.1 (2.1×) |
| WASM 복사 제외 | 0.38 (2.8×) | 3.74 (4.0×) | 37.9 (2.3×) |
| napi | 0.31 (3.4×) | 2.61 (5.7×) | 24.4 (3.5×) |

### 커널 결과 읽기

- **가장 큰 이득은 알고리즘 교체다.** argsort는 비교 함수 정렬을 기수 정렬로 바꾸기만 해도 JS에서 7~8배 빨라진다. WASM은 같은 기수 정렬을 1.5~2배 더 빠르게 돌린다 (1M행 68 → 31~34ms).
- **m4·bin은 메모리 대역폭에 묶인다.** 1M행에서는 최적화 JS와 WASM의 차이가 1.0~1.4배로 줄어든다. bin은 복사 포함이면 최적화 JS와 거의 같다 (45.7 vs 43.0ms). 넘겨야 할 배열(xs, ys 16MB)을 옮기는 비용이 계산에서 번 시간을 거의 다 먹는다.
- **복사 비용**은 argsort에서 거의 0이다 (정렬이 O(n)이 아닌 무거운 일이라). bin에서는 1M행에 8~9ms다. 데이터를 처음부터 선형 메모리에 두는 구조(아래)가 아니면 "복사 제외" 숫자는 얻을 수 없다.
- **napi는 Node에서만 의미가 있다.** bin(1M행 24ms, 최적화 JS의 1.6배)처럼 네이티브 코드 생성이 유리한 곳만 WASM보다 빠르고, argsort는 오히려 느리다. 이 앱은 Node 서버가 없어 배포 경로가 없다. Node에서 렌더를 돌리는 계획이 생기기 전에는 비교 대상일 뿐이다.

## 결과: 렌더 전체에서 차지하는 몫 (Amdahl)

커널이 몇 배 빨라져도 렌더 한 번에서 차지하는 몫이 작으면 의미가 없다. Chromium Worker에서 실제 `renderScatter`를 돌려 단계별로 쟀다 (ms, 중앙값 9회). 단계는 렌더러의 progress 알림으로 나눴다. "준비"는 옵션·축·틀, "aggregate"는 점 집계 루프(= bin 커널 + 결과 배열 쌓기), "그리기"는 캔버스에 점·선을 그리는 단계다. line 차트의 그리기 시간에는 `seriesOrder`(정렬)와 m4가 들어 있다.

| 차트 | n | 전체 | 준비 | aggregate | 그리기 | PNG 인코딩 | 같은 데이터 정렬(JS 원본) |
|---|---:|---:|---:|---:|---:|---:|---:|
| scatter | 10,000 | 58 | 1.4 | 2.5 | 6.5 | 50 | (예측 켤 때만) |
| scatter | 100,000 | 411 | 2.6 | 18.6 | 349 | 37 | (예측 켤 때만) |
| scatter | 1,000,000 | 1,803 | 18.7 | 93.1 | 1,637 | 28 | (예측 켤 때만) |
| line | 10,000 | 68 | 1.1 | 1.7 | 3.8 | 59 | 2.9 |
| line | 100,000 | 120 | 2.6 | 11.9 | 43.1 | 63 | 36.3 |
| line | 1,000,000 | 711 | 17.3 | 82.2 | 538 | 65 | 464 |

여기서 위 커널 수치를 빼 보면 다음과 같다.

| 경우 | JS 최적화로 줄어드는 시간 | WASM이 그 위에 더 줄이는 시간 | WASM 추가분 / 전체 |
| --- | --- | --- | --- |
| line 1M, **x가 정렬 안 됨** | 정렬 464 → 약 68: **약 −400ms (전체 711 → 약 315)** | 68 → 34: 약 −35ms | 약 5% (JS 최적화 뒤 기준 약 11%) |
| line 100k, x가 정렬 안 됨 | 36 → 4.6: −31ms (−26%) | −1.5ms | 1~2% |
| line, x가 이미 정렬됨 (시각 순 샘플 데이터) | 정렬은 이미 건너뜀 (0) | 0 | 0% |
| scatter 1M | bin 77 → 46: −31ms (−2%) | 46 → 43: −3ms (복사 포함) | 0.2% |
| scatter 100k | bin 12 → 4.8: −7ms | −0.3ms | 0.1% |
| m4 (line 1M) | 18 → 14.5: −4ms | −4ms | 0.6% |

- scatter는 **캔버스 그리기**(점마다 `arc`, `fill`)가 1M행에서 91%를 차지한다. 이것은 Canvas API 호출이라 WASM으로 옮길 수 없다. 줄이려면 그리는 점 수(`MAX_PER_CELL`)를 줄이거나, 점을 `ImageData`에 직접 찍는 래스터라이저로 바꿔야 한다. 후자는 WASM이 유리할 수 있는 다음 후보다. 다만 지금 점 모양·테두리·투명도 처리를 다시 만들어야 하는 큰 작업이다.
- 10k행에서는 PNG 인코딩(50~60ms)이 전체를 차지한다. 연산을 바꿔서는 줄지 않는다.
- line 1M에서 x가 정렬되지 않으면 정렬이 전체의 65%다. 이 몫은 **기수 정렬로 바꾸면 거의 다** 사라진다.

데이터는 `queryChartData`가 테이블 저장 순서로 받는다 (`order by` 없음). 샘플 데이터셋은 시각 순으로 생성돼 시각 x는 대개 정렬돼 있다. 숫자 컬럼을 x로 쓰거나 업로드한 CSV가 시간 순이 아니면 정렬 비용이 그대로 든다.

## 결과: 초기화 비용, 번들 크기, 메인 스레드

| 항목 | 값 |
| --- | --- |
| `vis-compute.wasm` | 20,301 B (gzip 8,968 B, brotli 7,737 B) |
| JS 래퍼 (`server/compute/wasm.ts`, minify) | 1,363 B (gzip 680 B) |
| 첫 fetch + `compileStreaming` (Chromium, 로컬 서버) | 3.5ms |
| `compile` / `instantiate` (반복 중앙값, Chromium·Node) | 약 0.2ms / 0.05ms 미만 |
| napi `require` 첫 1회 (Node) | 0.48ms (애드온 384KB, 플랫폼별 빌드 필요) |

초기화와 번들은 문제가 되지 않는다. 비교하자면 이미 싣고 있는 PGlite wasm이 10.5MB다.

**Web Worker로 메인 스레드 비우기** (1M행 정렬, Chromium)

| 방식 | 걸린 시간 | 메인 스레드 최대 멈춤 |
| --- | ---: | ---: |
| 메인 스레드에서 JS 원본 | 477ms | 477ms |
| 메인 스레드에서 JS 최적화 | 82ms | 82ms |
| Worker, xs 복사(structured clone) | 78ms (왕복) | 4.8ms |
| Worker, xs transfer | 70ms (왕복) | 0.5ms |

메인 스레드를 비우는 효과는 WASM과 상관없이 Worker로 넘기면 생긴다. **이 앱은 이미 차트 연산을 전부 Worker에서 한다.** 메인 스레드로 옮겨 올 연산이 없다는 뜻이다. 남은 원칙은 큰 typed array를 transfer로 넘기는 것이다 (복사보다 멈춤이 10배 짧다).

## 빌드·배포 복잡도

| 항목 | 내용 |
| --- | --- |
| Next 빌드 (Turbopack, Next 16.4) | 렌더 Worker에 `fetch(new URL("../compute/vis-compute.wasm", import.meta.url))`을 넣고 `pnpm build`를 돌려 봤다 (실험 뒤 되돌림). **설정 없이** `out/_next/static/media/vis-compute.<hash>.wasm`로 나오고 정적 export에서도 동작했다. PGlite wasm이 같은 방식으로 이미 실린다. Next 문서(`node_modules/next/dist/docs`)에는 Turbopack에서 `.wasm`을 다루는 방법이 따로 나와 있지 않다 (webpack의 `asyncWebAssembly` 같은 설정이 없다). `import`로 직접 가져오는 방식은 쓰지 말고 `new URL` + `compileStreaming`을 쓴다 |
| CSP | CSP를 걸게 되면 `script-src`에 `'wasm-unsafe-eval'`이 필요하다 (Next CSP 문서). PGlite 때문에 이미 필요하다 |
| MIME | `compileStreaming`은 `application/wasm`이 필요하다. 정적 호스팅 쪽 설정을 확인해야 한다 (안 되면 `arrayBuffer()` + `compile`로 받는다. 20KB라 차이는 무시할 만하다) |
| Rust 툴체인 | 개발자와 CI에 `rustup` + `wasm32-unknown-unknown` 타깃 (빌드 몇 초). 이 실험은 산출물 `.wasm`을 커밋해 CI에 Rust를 넣지 않았다. 실제로 도입하면 "커밋한 `.wasm`이 소스와 같은지" 확인하는 CI 단계(`cargo build` 후 diff)가 필요해 결국 Rust를 CI에 넣게 된다 |
| 정합성 유지 | 렌더러 규칙(M4 순서, 반올림, f32 좌표, 끝값 처리)이 바뀔 때마다 JS와 Rust 둘을 함께 고치고 정합성 테스트를 유지해야 한다. 지금 렌더러는 옵션(선택·focus·끈 legend·log/time 축)이 많아 커널을 작게 떼어내기 어렵다. 이번 bin 커널도 선형 축만 지원한다 |
| 메모리 | 선형 메모리는 줄지 않는다. 1M행을 한 번 넘기면 수십 MB가 Worker가 끝날 때까지 남는다 (렌더 Worker는 오래 산다) |
| napi | 플랫폼별 바이너리(.node) 빌드·배포가 필요하다. 정적 export 앱에서는 쓸 곳이 없다 |

### wasm-bindgen을 안 쓴 이유

`wasm-bindgen`·`wasm-pack`은 JS glue와 CLI(버전을 crate와 맞춰야 함)를 더한다. 커널이 typed array를 받는 함수 몇 개뿐이라 `#[no_mangle] extern "C"` + `alloc`/`dealloc`이면 충분했다. 이렇게 하면 "복사 포함/제외"를 정확히 나눠 잴 수 있고, wasm은 import가 없는 20KB 하나로 끝나며, CI에는 `rustup target add`만 있으면 된다. 문자열·객체를 넘기는 API가 필요해지면 그때 wasm-bindgen이 낫다.

## 권장안

1. **WASM·napi는 지금 도입하지 않는다.** 실제 렌더 시간에서 WASM이 더 줄이는 몫은 0.1~5%이고, 그 대가로 Rust 툴체인, 산출물 동기화, 이중 구현 정합성을 계속 떠안는다. 메인 스레드 반응성은 이미 Worker 구조로 확보돼 있다.
2. **대신 순수 JS 최적화를 렌더러에 넣는다** (별도 PR, 정합성 테스트를 회귀 테스트로 그대로 쓴다).
   - `seriesOrder`의 비교 함수 정렬 → `argsortRadix`. x가 정렬 안 된 1M행 line 렌더가 약 711 → 315ms가 된다 (추정: 같은 Worker에서 잰 정렬 시간을 뺀 값). 가장 효과가 크다.
   - scatter 집계 루프에서 선형 축이면 d3 scale 호출 대신 풀어 쓴 식 (`binFast`): 1M행 −31ms.
   - `m4` → `m4Fast`: 작지만 공짜다.
3. **다시 검토할 조건.** 아래 중 하나가 생기면 이 문서의 커널·벤치를 그대로 출발점으로 쓴다.
   - 점 그리기를 Canvas 호출 대신 `ImageData` 래스터라이저로 바꿀 때. scatter 1M행에서 91%를 차지하는 단계라, 여기서는 WASM(+SIMD)이 의미 있는 차이를 낼 수 있다.
   - PGlite 결과를 WASM 선형 메모리로 바로 받아 렌더까지 복사 없이 가는 구조가 될 때 ("복사 제외" 수치가 현실이 된다).
   - 렌더를 Node 서버에서 돌리게 될 때 (그때는 napi가 bin에서 1.6배 낫다).

## 남긴 코드

| 위치 | 내용 |
| --- | --- |
| `crates/vis-compute` | Rust 커널 (wasm32 C ABI + rlib), `cargo test` |
| `crates/vis-compute-napi` | 같은 커널의 napi-rs 애드온 (Node 실험용) |
| `server/compute/kernels.ts` | JS 원본·최적화 커널. 렌더러는 아직 쓰지 않는다 |
| `server/compute/wasm.ts`, `vis-compute.wasm` | WASM 로더 (복사 포함/제외 API), 커밋한 빌드 산출물 |
| `server/compute/napi.ts` | napi 애드온 로더 (없으면 undefined) |
| `server/compute/parity.test.ts` | 정합성 테스트 |
| `scripts/bench-compute/` | Node·Chromium 벤치 (`pnpm bench:compute`, `pnpm bench:compute:browser`) |
