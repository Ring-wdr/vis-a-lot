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
| 도움말 | `/help`: 서비스별 사용 방법. 본문은 `apps/help/content/help/<서비스>/*.mdx`(`@next/mdx`), 도움말 앱(`apps/help`)이 따로 빌드한다. 로그인 없이 열린다. 지금은 시각화 도움말만 있고 피드는 준비 중 |

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

pnpm workspace + [Turborepo](https://turborepo.com) 모노레포입니다. 루트에서 실행합니다. 루트 스크립트는 `turbo run …`이라 작업 순서(공유 패키지 카탈로그 → 앱)와 캐시를 turbo가 맡습니다.

```bash
pnpm install
pnpm dev        # 두 앱(web :3000, help :3001)과 Microfrontends proxy를 함께 띄운다 → http://localhost:3024
pnpm dev:web    # 시각화·피드·공유·dev (apps/web)만. proxy의 /help/**는 Production fallback으로 간다
pnpm dev:help   # 도움말 /help/** (apps/help)만. 나머지 경로는 Production fallback으로 간다
pnpm build      # 앱마다 out/ 정적 사이트 (apps/web/out, apps/help/out — help 자산은 out/help-assets/_next)
pnpm build:web  # 앱 하나만 빌드 (= turbo run build --filter=@vis-a-lot/web). build:help도 있다
pnpm gen:api    # 서비스 코드 → OAS(apps/web/public/openapi/*.json) → TS 타입 생성
pnpm gen:api:check  # 생성물이 서비스 코드와 맞는지 확인 (CI용)
pnpm test       # 모든 앱·패키지의 단위 테스트
pnpm lint       # FSD 구조, i18n, Biome, Stylelint (늘 저장소 전체. 바뀐 것이 없으면 캐시로 끝난다)
pnpm typecheck  # 모든 앱·패키지의 tsc (next typegen으로 라우트 타입을 먼저 만든다. build 없이 돈다)
pnpm check:affected  # 루트 검사 전체 + develop 대비 바뀐 패키지의 lint·test·typecheck·build (아래 --affected)
```

### Turborepo

태스크는 [`turbo.json`](turbo.json)에 있습니다 (`packages/shared/turbo.json`이 공유 패키지 몫을 덮어씁니다).

| 태스크 | 하는 일 | 먼저 도는 것 |
|---|---|---|
| `i18n:compile` | Lingui 카탈로그 컴파일(엄격하지 않게: 번역이 비어도 원문으로 채운다). 앱 → `src/**/config/locales/*.ts`, shared → `config/locales/*.ts`. 카탈로그를 쓰는 태스크는 이것 하나다 | `^i18n:compile` |
| `build` | 엄격한 i18n 검사: 추출 누락(`lingui check sync`), 번역 누락(`lingui check missing`), `vis-a-lot-i18n-check`. shared는 검사만 하고, 앱은 그 뒤 `next build` → `out/` (help는 자산을 `out/help-assets`로 옮긴다) | `^build`, `i18n:compile`, 같은 패키지의 `typecheck` |
| `lint` | 앱·패키지마다 i18n 검사(`vis-a-lot-i18n-check`, `.po`만 읽는다) | |
| `test`·`typecheck` | vitest / `next typegen && tsc --noEmit` | `^i18n:compile`, `i18n:compile` |
| `dev` | `next dev` (캐시하지 않는다) | `^i18n:compile`, `i18n:compile` |
| `//#lint:fsd`·`//#lint:biome`·`//#lint:css`·`//#lint:mfe` | 저장소 전체를 보는 루트 검사 (`lint:mfe`: microfrontends.json과 자식 앱 package.json의 앱 이름·asset prefix가 같은지). `pnpm lint`가 앱·패키지의 `lint`와 함께 돌린다 | |

- 번역 누락은 `build`에서만 멈춘다. 문구를 추출하고 번역을 채우기 전에도 `pnpm dev`·`pnpm test`·`pnpm typecheck`는 돈다 (빈 번역은 한국어 원문으로 보인다).
- `build`는 같은 패키지의 `typecheck`가 끝난 뒤 돈다. `next build`는 시작할 때 `.next`를 지우고 `.next/types`·`next-env.d.ts`를 다시 쓰는데, `typecheck`(`next typegen`)도 같은 파일을 쓰기 때문이다. 순서를 `dependsOn`으로 정해 두 태스크가 한 패키지에서 동시에 돌 수 없게 했다. `typecheck`의 출력(`.next/types/**`, `next-env.d.ts`, `tsconfig.tsbuildinfo`)도 캐시에 넣는다.

- 입력이 같으면 다시 돌지 않고 캐시(`.turbo/`, 커밋하지 않음)에서 결과와 로그를 되살립니다. 같은 명령을 두 번 돌리면 `FULL TURBO`가 보입니다. 캐시를 무시하려면 `--force`.
- 앱·패키지 디렉터리 안에서 `pnpm exec turbo run build`처럼 돌려도 그 패키지와 의존 패키지만 순서대로 돕니다. 앱 디렉터리에서 `pnpm run build`처럼 패키지 스크립트를 바로 부르면 카탈로그(`i18n:compile`)를 만들지 않아 "컴파일한 카탈로그가 없다"로 멈추니 turbo로 돌립니다.
- `NEXT_PUBLIC_*` 환경 변수와 앱 폴더의 `.env*`는 `build`·`test`·`dev`의 캐시 키에 들어갑니다. 빌드 결과에 영향을 주는 환경 변수를 새로 쓰면 `turbo.json`의 `env`에 더합니다. 선언하지 않은 변수는 태스크에 전달되지 않습니다(strict env mode). 빌드에서 `VERCEL_*` 시스템 변수나 `NEXT_PUBLIC_`이 아닌 변수를 읽게 되면 반드시 `env`(캐시에 영향이 없으면 `passThroughEnv`)에 더합니다 ([docs/deploy.md](docs/deploy.md)).
- 캐시: 로컬은 `.turbo/` 로컬 캐시만 씁니다 (`turbo login`·`turbo link`를 하지 않았습니다). Vercel 빌드의 turbo는 Vercel Remote Cache를 자동으로 써서, 한 프로젝트 빌드의 결과(예: shared 태스크)를 다른 프로젝트 빌드가 되살립니다.

#### 바뀐 것만 돌리기 (`--affected`)

`--affected`는 바뀐 **패키지**와 그 패키지에 의존하는 패키지의 태스크만 돌립니다. 루트 태스크(`//#lint:fsd`·`//#lint:biome`·`//#lint:css`·`//#lint:mfe`)는 루트 패키지 파일이 바뀔 때만 affected로 잡혀, 앱 파일의 FSD·Biome 위반을 놓칩니다. 그래서 **루트 검사는 `--affected` 없이 돌리고(입력이 그대로면 캐시로 끝난다), 패키지 태스크만 `--affected`로 돌립니다.** `pnpm check:affected`가 이 순서로 돕니다 (`pnpm run lint:root` → `turbo run lint test typecheck build --affected`).

기준은 `TURBO_SCM_BASE`와 현재 작업 트리(커밋하지 않은 변경 포함)의 차이입니다. 작업 브랜치의 PR은 develop으로 가므로 기준은 `origin/develop`이고(`check:affected`의 기본값), `release/<버전>` 브랜치의 PR은 main으로 가므로 `origin/main`입니다 ([docs/git-flow.md](docs/git-flow.md)). `TURBO_SCM_BASE`를 주지 않은 `--affected`는 로컬 `main`을 기준으로 삼는데, 로컬 main은 develop보다 크게 뒤처져 있어 거의 모든 패키지가 잡히니 쓰지 않습니다. 얕은 clone(CI 등)이면 기준 커밋까지 fetch합니다.

```bash
pnpm check:affected                                    # 작업 브랜치: 루트 검사 + develop 대비 바뀐 패키지
TURBO_SCM_BASE=origin/main pnpm check:affected         # release 브랜치
TURBO_SCM_BASE=origin/develop pnpm exec turbo run test --affected
TURBO_SCM_BASE=HEAD pnpm exec turbo run test --affected   # 커밋하지 않은 변경만
TURBO_SCM_BASE=origin/develop pnpm exec turbo run build --affected --dry   # 무엇이 돌지 보기만 한다
TURBO_SCM_BASE=origin/develop pnpm exec turbo query affected               # 바뀐 패키지 목록
```

`apps/help/content/help/**`만 바꾸면 help만, `packages/shared`를 바꾸면 shared·web·help가, 도구 패키지(`packages/tsconfig`, `packages/i18n-check`)를 바꾸면 그것을 선언한 모든 앱·패키지가 잡힙니다.

### 배포

두 앱은 Vercel 프로젝트 둘(`vis-a-lot-web`, `vis-a-lot-help`)로 따로 배포하고 Vercel Microfrontends로 한 도메인에 묶습니다 (`/help/**`는 help, 나머지는 web). 커밋마다 바뀐 앱만 빌드합니다. 프로젝트 설정, Build Command(`turbo run build`), pnpm 12(Corepack), 환경 변수, 무엇이 언제 배포되는지는 [`docs/deploy.md`](docs/deploy.md)에 있습니다. 로컬에서는 `pnpm dev`의 proxy(http://localhost:3024)가 같은 방식으로 두 앱을 한 포트에 묶어 앱 사이 링크(상단 바의 help, 도움말의 시각화·피드)도 이어집니다.

데모 계정은 `demo` / `demo1234`입니다.

세션 만료를 확인하려면 토큰 수명을 줄여 빌드합니다. refresh token은 쓸 때마다 새로 받으므로, 이 시간 동안 요청이 없으면 세션이 끝납니다.

```bash
NEXT_PUBLIC_ACCESS_TTL_SEC=20 NEXT_PUBLIC_REFRESH_TTL_SEC=30 pnpm build:web
```

`/dev` 페이지에서 DB Worker 부팅, 데이터 생성, Render Worker 병렬 렌더 경로를 따로 확인할 수 있습니다.

## 디렉터리

pnpm workspace + Turborepo 모노레포입니다. 규칙은 [`docs/architecture.md`](docs/architecture.md), 검사는 `scripts/check-fsd.mjs`입니다.

```
apps/web/               @vis-a-lot/web: 시각화(/), 피드(/feed), 공유(/share), dev 화면. Microfrontends 기본 앱
  microfrontends.json   Vercel Microfrontends 그룹 구성·경로 (docs/deploy.md)
  vercel.json           Vercel 프로젝트 설정 (Build Command turbo run build, out/). apps/help에도 있다
  app/                  Next.js 라우트만 둔다 (page, layout). 화면은 src/에서 불러온다
  src/                  FSD 레이어로 나눈 클라이언트 코드 (@/* = apps/web/src/*)
    application/        provider, mock 서버 부팅, ssr: false 진입점 (FSD의 app 레이어)
    views/              화면 단위 조립 (FSD의 pages 레이어. Next의 app/pages와 이름이 겹치지 않게)
    widgets/            설정 패널, item grid, history 목록 같은 큰 블록
    features/           draw, grid 변경, 공통 속성, item 조작, 툴팁, 공유, 데이터 등록 같은 사용자 동작
    entities/           작업 상태 store, 차트 좌표·레이아웃·공유 링크
    shared/             이 앱만 쓰는 API 클라이언트(생성 타입), 세션, React Query 훅, 공통 UI, 유틸
  server/               브라우저 안의 "서버" (@server/*). 화면은 import할 수 없다 (lint)
    gateway.ts          경로 prefix → 서비스 라우팅 (MSW handler)
    services/           auth / data / chart 서비스. 서비스마다 schemas(zod) · routes(계약) · app(handler)
    api/                서버 내부 도메인 타입 (OAS 스키마와 컴파일 타임에 맞춰진다)
    jobs/               렌더 job 실행기 (순차 대기열, long polling, 취소)
    data/               데이터 생성기, 데이터셋 적재, 차트 데이터 조회/집계 SQL
    render/             scatter, bar/boxplot, 도형 렌더러 (Canvas 2D만 의존)
    history/            history 기록과 PGlite 저장소
    workers/            DB Worker, Render Worker
  public/               MSW worker, 서비스별 OpenAPI 3.1 문서(openapi/, 생성물)
  scripts/              gen-api.mts(OAS·타입 생성기), bench-db/(DB 벤치마크)
apps/help/              @vis-a-lot/help: 도움말 /help/** (로그인 없이 열리는 정적 MDX 페이지). Microfrontends 자식 앱
  app/help/             도움말 라우트. basePath 없이 /help 아래에 둔다
  scripts/              prefix-assets.mjs: build 뒤 out/_next를 out/help-assets/_next로 옮긴다
  src/                  FSD 레이어 (application/HelpShell, views/help-*, widgets/help-sidebar, shared/config/help.ts 목차, shared/ui/mdx)
  content/help/         도움말 본문(MDX). 서비스마다 폴더, 쓰는 법은 apps/help/content/help/README.md
  mdx-components.tsx    @next/mdx 필수 파일. 요소 모양은 src/shared/ui/mdx
packages/shared/        @vis-a-lot/shared: 두 앱이 함께 쓰는 FSD shared 레이어 (config, lib, ui). package.json의 "vis-a-lot": { "fsd": true }가 FSD 패키지 표식
  ui/globals.css        디자인 토큰·reset (두 앱의 app/globals.css가 import한다)
packages/tsconfig/      @vis-a-lot/tsconfig: 공통 TypeScript 설정 (base.json). 도구 패키지라 FSD 검사 밖
packages/i18n-check/    @vis-a-lot/i18n-check: Lingui 카탈로그 검사 bin(vis-a-lot-i18n-check). 도구 패키지
scripts/check-fsd.mjs   FSD 레이어 위치·import 방향·앱 경계 검사 (pnpm lint, pre-commit)
turbo.json              Turborepo 태스크 (build·i18n:compile·lint·test·typecheck·dev, 루트 검사)
docs/                   기획서, 구조(architecture.md), 배포(deploy.md)
```

## 알려진 제약

- "서버" 상태(차트, job)는 브라우저 메모리에 있고, 영속되는 것은 데이터셋과 history입니다. 새로고침 후에는 history에서 복원합니다.
- PGlite를 `relaxedDurability`로 쓰기 때문에, 기록 직후 아주 빠르게 탭을 닫으면 마지막 기록이 남지 않을 수 있습니다.
- 도형 수정, redo, 색 외 개별 속성은 범위 밖입니다.
