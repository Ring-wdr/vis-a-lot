# vis-a-lot

서버사이드에서 그린 PNG 차트를 브라우저에 띄우는 **B2B 시각화 솔루션 프로토타입**입니다.

원본 제품은 Spring 서버가 DB의 raw data로 차트를 PNG로 그려 내려보내는 구조였고, 서버는 MSA(차트 렌더링 · DB 적재 · auth 서비스)로 나뉘어 swagger 문서를 냈습니다. 이 프로토타입은 그 구조를 유지하면서 **서버 유지비를 0원**으로 만들기 위해, "서버"를 브라우저 안에서 돌립니다.

- 화면은 진짜 서버에 REST로 요청하는 것과 똑같이 동작합니다 (`fetch`, `<img src>`).
- 그 요청을 MSW가 받아 gateway → 서비스(Hono 앱 3개)로 넘기고, 서비스는 Web Worker의 PGlite(WASM Postgres)와 Render Worker(OffscreenCanvas)로 처리합니다.
- 서비스 코드(zod 스키마)가 OAS 문서를 만들고, 화면은 그 문서에서 생성한 타입으로만 API를 부릅니다.
- 실서버로 옮길 때 화면 코드는 바뀌지 않습니다.

> 기획 과정과 모든 결정 사항은 [`docs/prototype-spec.md`](docs/prototype-spec.md)에 있습니다. 피드 프로토타입은 [`docs/feed-prototype-spec.md`](docs/feed-prototype-spec.md)에 있습니다.

## 아키텍처

```
[화면 (React)] ──fetch / <img src>──▶ [MSW service worker] ──▶ [API gateway (Hono)]
   · 생성된 OAS 타입 + openapi-fetch                              │  경로 prefix로 서비스 선택
   · Bearer access token, 401 → refresh → 재시도          ┌────────┼─────────────────────┐
                                                          ▼        ▼                     ▼
                                              [auth /api/auth] [data /api/data]   [chart /api/chart]
                                               · 로그인, refresh  · 데이터 적재        · 렌더 job, long polling
                                                 (rotation)      · 메타 조회          · item 조작, 툴팁, history, 공유
                                               · 서비스 토큰       ▲                    │  ▲
                                               · JWKS(공개 키) ◀── JWT 검증 ─────────────┘  │
                                                                 └── 서비스 토큰으로 적재 요청 ┘
                        ┌───────────────────────────────────────────────┬─────────────────┐
                        ▼                                               ▼                 ▼
               [DB Worker: PGlite]  ──typed array transfer──▶ [Render Worker × N]  [Cache API: PNG]
                · 시드 기반 데이터 생성 + COPY 적재              · OffscreenCanvas → PNG
                · SQL 집계 (GROUP BY, percentile_cont)            · 툴팁용 metadata
                · history 저장 (IndexedDB)
```

## 주요 기능

| 영역 | 내용 |
|---|---|
| 데이터 | 제조/IoT 센서 데이터를 시드로 절차적 생성 (10만 / 50만 / 100만 행), 등록 후 IndexedDB 유지. 컬럼과 타입은 고정하지 않고 적재된 테이블의 스키마에서 읽는다 (categorical / numeric / datetime, 라벨은 컬럼 주석) |
| 차트 | scatter, bar(통계 함수 6종), boxplot(사분위수 · 1.5 IQR 수염 · 이상치). 집계는 서버(PGlite SQL)가 수행 |
| split by | 여러 컬럼을 클릭 순서대로 조합해 item grid로 분할 (최대 30,000개, 초과 시 팝업). 누른 채 끌어 순서대로 선택 |
| 화면 | gallery·history 탭(탭마다 작업 상태, 로그아웃하면 함께 정리, 그리는 중에는 cancel 전까지 탭 전환 잠금), 전체 설정 팝업, 오른쪽 페이지 스크롤바(throttle 조회), 자세한 job 하단 바 |
| 필터 | 컬럼별 아코디언(열 때 서버에서 범위·값 목록 조회). 숫자·시계열은 범위 + 반전 + null, 범주는 검색 + 가상 목록. draw할 때 적용 |
| 렌더 job | 모든 렌더를 job + long polling으로 처리. 단계별 진행률, 취소, `draw → pending → cancel` |
| 툴팁 | 처음 hover 때 metadata를 받아 이후 서버 호출 없이 좌표값·가장 가까운 점 표시, 추가 컬럼만 서버 조회. 차트별 strategy pattern |
| 확대 · 도형 | 영역 확대/축소/초기화, 사각형·선·자유곡선·텍스트를 데이터 좌표로 저장해 서버가 PNG에 그림 |
| legend | 범주 컬럼으로 색 나누기 (scatter 점 / bar·boxplot 나란히 배치). PNG 안 legend 상자의 ●를 눌러 item별 색 변경 |
| 속성 | 공통 속성(전체 다시 그리기, 개별 속성 덮어쓰기), item 개별 색상 |
| 화면 크기 | resize 300ms 뒤 현재 페이지만 다시 그림, grid 크기 즉시 반영 |
| history | draw마다 1건 + 이후 변경 덧붙임, 썸네일, 복원 |
| 공유 | `링크 복사`가 chart 서비스에 공유(설정 · item 상태 · 대표 PNG 스냅숏)를 만들고 `/share?id=…` 링크를 복사. 공유 페이지에서 스냅숏 보기, gallery에서 열기, 링크 복사, 피드에 올리기, 지우기(만든 사용자). `/share`는 내 공유 목록. 예전 hash 링크(`#s=`, lz-string)도 열린다 |
| 피드에 올리기 | 공유를 만들고 같은 출처의 피드 전체 폼(`/feed/new?share=…`)을 새 탭으로 열어 차트 게시물을 채운다 |
| 피드 프로토타입 | `/feed`: 차트·이미지·동영상·코드를 게시물로 올리고 이슈로 다루는 사내 데이터 공유 피드 1차 프로토타입. 피드 서비스 `/api/feed`, 사용자 전환, 시드·시계·발송 로그 장치. 자세한 내용은 [`docs/feed-prototype-spec.md`](docs/feed-prototype-spec.md) |
| MSA | auth · data · chart 서비스를 gateway 뒤에 분리. chart → data 호출은 서비스 토큰(client credentials) |
| auth | 로그인, ES256 JWT access token(5분) + refresh token rotation, JWKS로 서비스별 검증, scope 확인 |
| OAS | 서비스 코드(zod)가 OpenAPI 3.1 문서를 만들고(`public/openapi/*.json`), 화면과 서비스 간 client가 생성 타입으로 호출 |

## 기술 스택

- **Next.js 16** (static export), **React 19**, TypeScript
- **MSW 3** – 브라우저 안의 REST "서버" (gateway)
- **Hono + @hono/zod-openapi + zod 4** – 서비스 앱, 요청 검증, OAS 생성 (Spring + springdoc 역할)
- **openapi-typescript + openapi-fetch** – OAS → TS 타입, 타입 안전한 client
- **jose** – JWT 서명(ES256)·검증, JWKS
- **PGlite** – WASM Postgres (IndexedDB 영속화)
- **d3-scale / d3-array / d3-time-format** – 축 계산 (차트는 Canvas 2D로 직접 그림)
- **TanStack Query** – long polling, **zustand** – 작업 화면 상태
- **Vitest**, **Biome**

## 실행

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # out/ 정적 사이트 (아무 정적 호스팅에 배포 가능)
pnpm gen:api    # 서비스 코드 → OAS(public/openapi/*.json) → TS 타입 생성
pnpm gen:api:check  # 생성물이 서비스 코드와 맞는지 확인 (CI용)
pnpm test       # 단위 테스트
pnpm lint       # Biome
```

데모 계정은 `demo` / `demo1234`입니다.

세션 만료를 확인하려면 토큰 수명을 줄여 빌드합니다. refresh token은 쓸 때마다 새로 받으므로, 이 시간 동안 요청이 없으면 세션이 끝납니다.

```bash
NEXT_PUBLIC_ACCESS_TTL_SEC=20 NEXT_PUBLIC_REFRESH_TTL_SEC=30 pnpm build
```

`/dev` 페이지에서 DB Worker 부팅, 데이터 생성, Render Worker 병렬 렌더 경로를 따로 확인할 수 있습니다.

## 디렉터리

```
app/                  Next.js 라우트만 둔다 (page, layout). 화면은 src/에서 불러온다
src/                  FSD 레이어로 나눈 클라이언트 코드 (@/* = src/*). 규칙은 docs/architecture.md, 검사는 scripts/check-fsd.mjs
  application/        provider, mock 서버 부팅, ssr: false 진입점 (FSD의 app 레이어)
  views/              화면 단위 조립 (FSD의 pages 레이어. Next의 app/pages와 이름이 겹치지 않게)
  widgets/            설정 패널, item grid, history 목록 같은 큰 블록
  features/           draw, grid 변경, 공통 속성, item 조작, 툴팁, 공유, 데이터 등록 같은 사용자 동작
  entities/           작업 상태 store, 차트 좌표·레이아웃·공유 링크
  shared/             API 클라이언트(생성 타입), 세션, React Query 훅, 공통 UI, 유틸
server/               브라우저 안의 "서버" (@server/*). 화면은 import할 수 없다 (lint)
  gateway.ts          경로 prefix → 서비스 라우팅 (MSW handler)
  services/           auth / data / chart 서비스. 서비스마다 schemas(zod) · routes(계약) · app(handler)
  api/                서버 내부 도메인 타입 (OAS 스키마와 컴파일 타임에 맞춰진다)
  jobs/               렌더 job 실행기 (순차 대기열, long polling, 취소)
  data/               데이터 생성기, 데이터셋 적재, 차트 데이터 조회/집계 SQL
  render/             scatter, bar/boxplot, 도형 렌더러 (Canvas 2D만 의존)
  history/            history 기록과 PGlite 저장소
  workers/            DB Worker, Render Worker
scripts/gen-api.mts   OAS·타입 생성기
scripts/check-fsd.mjs FSD 레이어 위치·import 방향 검사 (pnpm lint, pre-commit)
public/openapi/       서비스별 OpenAPI 3.1 문서 (생성물)
docs/                 기획서
```

## 알려진 제약

- "서버" 상태(차트, job)는 브라우저 메모리에 있고, 영속되는 것은 데이터셋과 history입니다. 새로고침 후에는 history에서 복원합니다.
- PGlite를 `relaxedDurability`로 쓰기 때문에, 기록 직후 아주 빠르게 탭을 닫으면 마지막 기록이 남지 않을 수 있습니다.
- 도형 수정, redo, 색 외 개별 속성은 범위 밖입니다.
