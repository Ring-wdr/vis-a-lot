# 임베드 SDK 스펙 (4단계)

> 다른 사이트가 `<script>` 하나로 vis-a-lot 차트를 자기 페이지의 iframe에 그리게 한다.
> vis-a-lot에 iframe 전용 화면(`/embed`)과 호스트 페이지용 SDK를 더한다.
> 기획: [feature-expansion-plan.md](feature-expansion-plan.md)의 C1 + A10(선택 필드 값 묶기) + A13(보조 축) + Q2(SDK 타입 문서).

앞 단계: 관리선([control-limit-spec.md](control-limit-spec.md))이 develop에 들어가 있어야 한다(관리선 전달). Analytics와는 겹치지 않는다.

---

## 1. 전제: 서버가 페이지 안에 있다

vis-a-lot의 서버는 브라우저 안에서 돈다. `/api/*` 요청은 그 페이지의 MSW Service Worker가 받아 페이지 안의 handler(`server/browser.ts`, `server/gateway.ts`)가 답하고, 데이터는 PGlite(IndexedDB), PNG는 Cache API에 있다. 임베드는 이 구조 위에서 설계한다.

| 항목 | 임베드에서 |
|---|---|
| API 호출 | 호스트 페이지는 API를 부를 수 없다. 모든 서버 일은 **iframe 안**에서 한다. 호스트와 iframe은 postMessage로만 말한다 |
| 토큰 | 호스트는 client 자격만 들고, iframe이 자기 안의 auth 서비스에서 토큰을 받는다 |
| 데이터 | 데이터는 그 브라우저의 PGlite에만 있다. 샘플 id를 가리키면 iframe이 그 자리에서 생성한다 |
| 저장소 | iframe의 IndexedDB(`idb://vis-a-lot`, `vis-a-lot-auth`)·Cache API(`vis-a-lot-png-v1`)·Service Worker. **끼워 넣은 사이트마다 따로다** (3장) |
| 툴팁 | iframe 안 `ItemTooltip`이 그대로 그리고, 호스트에는 콜백용 이벤트만 보낸다 (호스트가 그리는 방식은 10장에서 정한다) |
| 화면 단계 | 부팅(서버 띄우기) → 인증 → 데이터 준비 → draw |

지금 코드에서 확인된 것:

- 정적 export이고 `next.config.ts`·`vercel.json`에 응답 헤더 설정이 없다. `X-Frame-Options`·CSP `frame-ancestors`·COOP/COEP를 보내지 않으므로 다른 출처가 iframe에 넣는 것을 막는 설정은 없다.
- 페이지마다 DB Worker를 하나 띄워 같은 `idb://vis-a-lot`을 연다 (`server/runtime.ts`, `server/workers/db.worker.ts`). 페이지 사이 잠금(Web Locks·SharedWorker·BroadcastChannel)은 코드에 없다. **한 호스트 페이지에 iframe이 둘이면 PGlite 둘이 같은 IndexedDB를 쓴다.** 지금 탭을 둘 열 때와 같은 상태이고, 임베드에서는 흔한 쓰임이라 실험 대상이다.
- refresh token은 `localStorage`(`vis-a-lot:refresh-token`), 테마·언어도 `localStorage`다. 같은 출처 데모에서는 임베드 iframe과 본 앱이 이 값을 같이 쓰게 되므로, 임베드는 이 값을 읽지도 쓰지도 않는다.

---

## 2. 범위

| 들어가는 것 | 빠지는 것 |
|---|---|
| iframe 화면 `/embed` (draw·redraw·history 다시 보기) | 호스트가 직접 부르는 API (기본값은 iframe 안 서버가 합친다) |
| SDK: `draw`·`redraw`·`history`·`destroy`·`erase`, 오류 타입, 요청 큐 | Pivot 다운로드 (A11, 이번 순서에 없음) |
| postMessage 프로토콜 v1 (handshake, 진행, 완료, 오류) | SQL·외부 주소로 데이터 넘기기 (D1, 이번 순서에 없음) |
| 인증: 임베드 client 자격 → iframe 안에서 토큰 | 이벤트선·두 번째 데이터셋 (이번 순서에 없음. 관리선 스펙 2.1) |
| 데이터: 샘플 id(없으면 생성), 그 브라우저에 등록된 데이터셋 id | 허용 호스트 목록, 호스트별 권한 (실서버 과제로 문서에만) |
| 툴팁 hover·click 콜백, 선택 콜백 | 실시간·주기 적재 (D4) |
| UI 설정(패널·도구 줄 보이기, 툴팁 컬럼, 테마, 언어) | iframe 사이 DB 공유 구조 변경 (실험 결과로 필요해지면 별도 작업) |
| 관리선 전달 | |
| A10 선택 필드 값 묶기 (gallery에도 들어간다) | |
| A13 보조 축 (10장에서 PR을 나눌지 정한다) | |
| 데모 페이지, 샘플 HTML, 도움말 1편, SDK 타입 문서 | |

---

## 3. 저장소 분할과 실험 (첫 작업 단위)

브라우저는 다른 사이트에 끼운 iframe의 저장소(IndexedDB, Cache API, Service Worker, localStorage)를 **최상위 사이트별로 나눈다.** 그래서 임베드 iframe은 본 앱(`vis-a-lot` 탭)의 데이터·history·공유를 보지 못하고, 호스트 사이트마다 샘플을 다시 만든다. 브라우저별로 다른 출처 iframe의 Service Worker를 어디까지 허용하는지는 코드로 확인할 수 없어 실험으로 정한다.

실험은 구현 전에 혼자 끝내고, 결과를 이 문서 부록에 적는다.

**환경:** 로컬에서 앱은 `http://localhost:3000`, 호스트 페이지는 `http://127.0.0.1:4000`(정적 HTML)으로 띄운다. 포트만 다르면 같은 사이트라 분할되지 않으므로 호스트 이름을 다르게 한다. 배포본은 Vercel preview와 다른 도메인의 정적 페이지로 한 번 더 본다. Chrome·Firefox·Safari 최신 버전.

| # | 확인할 것 | 통과 기준 |
|---|---|---|
| E1 | 다른 사이트 iframe에서 MSW Service Worker 등록·제어 | `/api/auth/health`가 200, `<img src="/api/chart/charts/…/png">`가 SW를 거쳐 그려진다 |
| E2 | PGlite `idb://`, Cache API, Render Worker(OffscreenCanvas) | `iot-100k` 생성 → scatter draw → PNG 표시. 새로고침 뒤 데이터가 남아 있다 |
| E3 | 한 호스트 페이지에 iframe 2개 (같은 분할 저장소) | 둘 다 그려진다. 한쪽이 샘플을 만든 뒤 다른 쪽을 새로고침해도 DB가 깨지지 않는다 |
| E4 | iframe 하나의 부팅 시간·메모리 | 데이터가 있을 때 `ready`까지 걸린 시간과 탭 메모리를 적는다 (기준 없음, 문서에 숫자로 남긴다) |
| E5 | 같은 출처 iframe(데모 페이지)과 본 앱 탭이 함께 열림 | 본 앱의 로그인·탭 상태가 바뀌지 않는다 |
| E6 | 다른 출처 iframe 안의 내려받기·클립보드 | PNG·CSV 내려받기가 된다. 클립보드는 `allow="clipboard-write"`로 되는지 |

**결과에 따른 범위:**

| 결과 | 범위 |
|---|---|
| E1·E2가 세 브라우저에서 통과 | 스펙대로. 데모는 다른 출처 샘플(`sample.html`)과 같은 출처 데모 페이지 둘 다 |
| 일부 브라우저만 통과 | 스펙대로 하고, 안 되는 브라우저에서는 iframe이 `boot.unsupported` 오류를 보낸다. 도움말에 지원 브라우저를 적는다 |
| E1 또는 E2가 Chrome에서도 실패 | **같은 출처 데모 페이지(`/embed/demo`)로 줄인다.** SDK·프로토콜·iframe 화면은 그대로 만들고, 다른 사이트에 끼우는 것은 실서버 과제로 적는다 |
| E3 실패 (DB가 깨지거나 한쪽이 멈춤) | 한 호스트 페이지에서 iframe을 **차례로** 부팅하고(SDK 큐), 쓰기는 먼저 뜬 iframe만 한다. 그래도 안 되면 SDK가 페이지당 iframe 하나로 막고 오류 `embed.single-frame`을 던진다. DB를 페이지 사이에 공유하는 구조(SharedWorker 등)는 이 PR에서 하지 않는다 |

---

## 4. 동작

### 4.1 흐름

```
[호스트 페이지]                               [iframe: <앱 origin>/embed?frame=chart-1:1]
 sdk.js ── iframe 생성 ─────────────────────▶ 부팅 (MSW → DB Worker)
        ◀──────────────── ready ───────────── 
        ── init {client, ui} + draw {…} ────▶ 토큰 발급 → 데이터 준비(없으면 샘플 생성)
        ◀──────────────── progress ────────── → POST /charts → job long polling
        ◀──────────────── done {context} ──── 
        ◀──── hover | hover.end | click ───── (그린 뒤)
        ◀──── select {values} ─────────────── 
        ── redraw {context, …} ─────────────▶ 같은 iframe에서 다시 그린다 (재부팅 없음)
```

- iframe 경로는 `/embed` 하나다. 정적 export라 동적 경로를 쓰지 않고 `frame`(iframe 식별자)은 query, 나머지는 메시지로 받는다. history 다시 보기도 같은 경로에서 메시지로 받는다.
- `/embed`는 `(session)` 그룹 밖에 둔다. 로그인 화면을 띄우지 않고, 본 앱의 세션(`localStorage` refresh token)·테마·언어를 읽거나 쓰지 않는다.
- 부모 창이 없이 직접 열면(`window === window.parent`) 안내 화면만 보인다.

### 4.2 SDK 공개 API

전역 이름은 `VisALot`, 오류는 `VisALotEmbedError`. 인스턴스 하나로 컨테이너 여러 개를 다룬다.

| 메서드 | 인자 | 반환 | 동작 |
|---|---|---|---|
| `new VisALot(options?)` | `{ origin?, onError? }` | 인스턴스 | `origin`을 생략하면 `sdk.js`를 불러온 출처. `onError`는 promise로 돌려줄 수 없는 오류(그린 뒤의 툴팁·선택 오류)를 받는다 |
| `setOrigin(origin)` | 앱 출처 | — | iframe을 띄울 출처를 바꾼다. 이미 뜬 iframe에는 영향이 없다 |
| `setClient(client)` | `{ clientId, clientSecret }` | — | 자격을 들고 있다가 `init`으로 iframe에 넘긴다. 호스트는 토큰을 받지 않는다. 자격이 틀리면 draw가 `auth.token-failed`로 실패한다 |
| `draw(containerId, payload)` | 컨테이너 요소 id, 4.3 | `Promise<{ context }>` | 컨테이너에 iframe을 띄우고 그린다. 이미 iframe이 있으면 새 것으로 바꾼다 |
| `redraw(containerId, payload)` | `{ context, spec?, options?, controlLimit?, ui? }` | `Promise<{ context }>` | iframe이 있으면 그대로 쓰고, 없으면 새로 띄운다. 같은 history 건에 이어 기록한다 |
| `history(containerId, historyId, payload?)` | `{ ui?, callbacks? }` | `Promise<{ context }>` | 그 사이트 저장소에 있는 history만 열린다. 보기 전용, 다시 기록하지 않는다 |
| `erase(containerId)` | — | — | 그 컨테이너의 큐와 iframe을 지운다. 대기 중인 promise는 `embed.destroyed`로 reject |
| `destroy()` | — | — | 모든 컨테이너를 `erase`하고 메시지 리스너를 뗀다 |

규칙:

- iframe마다 식별자 `frame`은 `<containerId>:<순번>`이다. 컨테이너에 iframe을 새로 띄울 때마다 순번이 오르고, 순번이 맞지 않는 메시지는 버린다.
- 같은 컨테이너에 draw가 진행 중이면 새 `draw`·`redraw`는 `draw.busy`로 던진다. `history`는 앞 호출을 reject하고 새로 시작한다.
- iframe이 3분 안에 `ready`를 보내지 않으면 `boot.timeout`.
- 필수 값이 없으면 메시지를 보내기 전에 `param.missing`.
- 메시지를 받을 때 `event.origin === origin`과 `event.source === 그 iframe의 contentWindow`를 확인한다.

### 4.3 draw payload

```ts
type DrawPayload = {
  data: { dataset: string };          // 'iot-100k' | 'iot-500k' | 'iot-1m' | 그 브라우저에 등록된 'up-…'
  spec: EmbedSpec;                    // ChartSpec에서 dataset·common을 뺀 것. chartType·x·y만 필수
  options?: ChartOptionsPatch;        // 공통 차트 속성
  controlLimit?: ControlLimitOptions | null; // 관리선 스펙 4장의 속성 구역 타입 그대로. iframe이 options.controlLimit으로 넣는다
  callbacks?: { onHover?, onClick?, onSelect?, onProgress? };
  ui?: EmbedUiConfig;
};
```

| 필드 | 뜻 |
|---|---|
| `data.dataset` | 데이터셋 id. 샘플 id면 없을 때 생성하고 `progress`를 보낸다(chart 서비스가 data 서비스에 적재를 요청하고 job이 `init`으로 기다리는 기존 흐름). 등록되지 않은 `up-…`이면 `data.not-found` |
| `spec` | `chartType` 14종, `subType`, `x`, `y`, `z`, `agg`, `legend`, `splitBy`, `tooltip`, `grid`, `filters`. 빠진 값은 새 탭 draft와 같은 기본값으로 채운다. `grid` 기본은 1×1 |
| `options` | `spec.common.options`로 들어간다. 합치는 순서는 gallery와 같다 (전체 → 테마 → 차트 종류 → 공통 → item) |
| `controlLimit` | `options.controlLimit`의 줄임. 둘 다 주면 `controlLimit`이 이긴다 |
| `callbacks` | 4.5. 함수라 메시지로 보내지 않고 SDK가 들고 있다 |
| `ui` | 4.4 |

`context` = `{ dataset, chartId, jobId, historyId }`. `redraw`는 `context`와 바꿀 `spec`·`options`·`controlLimit`·`ui`를 받고, 같은 `historyId`에 이어 기록한다.

iframe은 받은 payload를 chart 서비스의 zod 스키마로 검증한다(`POST /charts`가 400·409를 준다). SDK는 필수 값과 타입 모양만 본다.

### 4.4 UI 설정

```ts
type EmbedUiConfig = {
  panel?: boolean;        // 왼쪽 설정 패널. 기본 false
  filter?: boolean;       // 필터 패널. 기본 false
  toolbar?: boolean;      // 모드 바·차트 도구. 기본 true
  statusBar?: boolean;    // 하단 job 바. 기본 true
  tooltipColumns?: string[];   // ['*']면 모든 컬럼
  theme?: 'light' | 'dark' | 'system';
  locale?: 'ko' | 'en' | 'ja';
};
```

- 임베드에서는 상단 바, 탭 줄, 링크 복사, 피드에 올리기, datastore·upload 진입을 늘 숨긴다.
- 테마·언어는 메시지 값만 쓰고 `localStorage`에 쓰지 않는다.
- `panel: true`면 사용자가 iframe 안에서 설정을 바꿔 다시 draw할 수 있다. 그 draw도 `done`으로 알린다.

### 4.5 이벤트

| 콜백 | 언제 | payload |
|---|---|---|
| `onProgress(containerId, p)` | 데이터 준비·draw 진행 | `{ phase: 'boot' \| 'data' \| 'draw', done, total }` |
| `onHover(containerId, p)` | 툴팁이 뜰 때 | `{ itemKey, point: { x, y }, data: Record<컬럼, 값> }`. `data`에는 x·y와 `tooltipColumns` 값이 들어간다 |
| `onClick(containerId, p)` | 점·막대를 누를 때 | `onHover`와 같음 |
| `onSelect(containerId, p)` | 선택 영역이 바뀔 때 | `{ itemKey, count, values, truncated }` (5장). 선택을 풀면 `count: 0` |

### 4.6 postMessage 프로토콜 v1

모든 메시지는 `{ source: 'vis-a-lot-embed', v: 1, type, frame, payload }`다. `source`·`v`가 다르면 버린다.

| 방향 | type | payload |
|---|---|---|
| iframe → 호스트 | `ready` | — |
| 호스트 → iframe | `init` | `{ client, ui }` |
| 호스트 → iframe | `draw` | 4.3 (콜백 제외) |
| 호스트 → iframe | `redraw` | `{ context, … }` |
| 호스트 → iframe | `history` | `{ historyId, ui }` |
| 호스트 → iframe | `cancel` | — |
| iframe → 호스트 | `progress` | 4.5 |
| iframe → 호스트 | `done` | `{ context }` |
| iframe → 호스트 | `error` | `{ code, message, status? }` |
| iframe → 호스트 | `hover` · `hover.end` · `click` | 4.5 |
| iframe → 호스트 | `select` | 4.5 |

- iframe은 첫 `init`을 보낸 창의 출처를 기억하고, 그 뒤로는 그 출처에만 보낸다(`'*'`로 보내지 않는다). `ready`만 출처를 모르는 채로 보낸다.
- iframe은 `event.source === window.parent`인 메시지만 받는다.
- iframe이 언마운트되면 진행 중인 job을 취소한다.

오류 코드 (`VisALotEmbedError.code`). `cause`에는 원인 오류나 서버 응답을 담는다.

| code | 어디서 | 뜻 |
|---|---|---|
| `auth.client-missing` | SDK | `setClient`를 부르지 않았다 |
| `auth.token-failed` | iframe | client 자격이 틀리거나 토큰을 받지 못했다 |
| `param.missing` | SDK | 필수 값 없음 |
| `container.not-found` | SDK | 컨테이너가 DOM에 없다 |
| `boot.timeout` | SDK | iframe이 3분 안에 뜨지 않았다 |
| `boot.unsupported` | iframe | Service Worker·IndexedDB를 쓸 수 없는 브라우저·설정 |
| `draw.busy` | SDK | 진행 중인 draw가 있다 |
| `draw.invalid-spec` | iframe | 스키마·컬럼 검증 실패. `message`에 서버가 준 사유 |
| `data.not-found` | iframe | 데이터셋이 없다 |
| `data.load-failed` | iframe | 샘플 생성이 실패·중단됐다 |
| `draw.failed` | iframe | job이 `failed`·`cancelled`로 끝났다 |
| `history.not-found` | iframe | 그 저장소에 없는 history |
| `embed.single-frame` | SDK | 페이지당 iframe 하나 제한에 걸렸다 (3장 E3 결과에 따라) |
| `embed.destroyed` | SDK | `destroy`·`erase`로 끊겼다 |
| `unknown` | 둘 다 | 그 밖 |

### 4.7 인증

- auth 서비스의 mock client 목록(`server/services/auth/accounts.ts`의 `SERVICE_CLIENTS`)에 임베드용 client를 더한다: `embed-demo` / `embed-demo-secret`, scope `chart:read`·`chart:write`·`data:read`·`data:write`. 이미 있는 `POST /api/auth/token`(client credentials)을 쓴다.
- iframe은 `init`을 받으면 그 자격으로 토큰을 받고 **메모리에만** 둔다. 만료 전에 같은 자격으로 다시 받는다. `shared/api/session.ts`는 refresh token(`localStorage`) 기준이므로, 임베드에서는 `localStorage`를 건드리지 않는 방식이 필요하다.
- 실서버라면 호스트 서버가 토큰을 받아 넘기고, client마다 허용 출처(`frame-ancestors`)를 둔다. 도움말에 한 줄로 적는다.

---

## 5. 선택 필드 값 묶기 (A10)

호스트 페이지가 "사용자가 차트에서 고른 것이 무엇인지"를 행 전체가 아니라 식별 값 목록으로 받게 한다(예: 고른 점들의 `설비-lot` 목록). gallery에서도 같은 값을 복사해 쓸 수 있다.

- 차트 속성에 `selection` 구역을 더한다: `fields`(컬럼 최대 3개, 순서 있음), `separator`(기본 `-`, 5자 이하). 0.11.0에서 쓰임이 없어 넣지 않았던 구역이다.
- 선택 영역이 있는 item에서 `fields`의 값을 행마다 `separator`로 이어, 겹치지 않는 값 목록을 돌려준다. null은 빈 문자열.
  - `POST /api/chart/charts/:chartId/items/:key/selection-values` `{ limit? }` → `{ values: string[], total, truncated }`. 대상 행은 데이터 테이블의 선택 필드 규칙과 같다(`server/charts/item-scope.ts`). 최대 1,000개.
  - 선택 필드를 쓰는 차트(scatter, line, bar, boxplot, histogram, waterfall)만 받고 나머지는 409.
- gallery: 선택 영역 우클릭 메뉴에 `선택 값 복사`. `fields`가 비어 있으면 숨긴다.
- 임베드: 선택이 바뀌면 iframe이 값을 받아 `select` 메시지로 보낸다. `fields`가 비어 있으면 `values: []`와 `count`만 보낸다.

---

## 6. 보조 축 (A13)

값의 크기가 서로 다른 legend 계열(예: 온도와 진동)을 한 item에서 함께 보려고, **고른 legend 계열을 오른쪽 보조 y축으로 옮긴다.** x·y를 바꾸는 기능이 아니다. 숨기기 체크박스와는 상태가 따로다.

vis-a-lot에는 보조 y축이 없다(A4는 이번 순서에 없음). 그래서 이 항목은 렌더러에 두 번째 y축을 넣는 일이다.

- 대상: scatter, line (legend 컬럼이 있을 때).
- item 개별 속성 `y2Legend: string[]`. 그 값의 점은 오른쪽 y축(따로 계산한 범위)으로 그린다. 비우면 지금 그림과 같다.
- 도구 줄에 `보조 축` 모드. 임베드와 gallery 모두에 둔다. 모드를 켜면 legend에 체크박스가 뜨고, 체크하면 그 item만 다시 그린다. history·공유로 복원된다.
- metadata에 보조 축 범위를 더한다. 툴팁 좌표값은 그 점이 속한 축 값으로 보인다.
- 선택·삭제 영역과 확대는 왼쪽 y축의 데이터 좌표다. 보조 축으로 옮긴 계열이 있는 item에서 이 조작을 어떻게 할지가 가장 큰 일이다: 1차는 `y2Legend`가 있는 동안 사각형·자유형 선택과 삭제를 막고, 확대는 x 범위만 적용한다.

임베드와 건드리는 파일이 겹치지 않아 따로 올리길 권한다 (10장).

---

## 7. 화면 위치

`apps/web` 기준. 기존 slice를 다시 쓰고 임베드에만 필요한 것을 더한다.

| 두는 것 | 위치 |
|---|---|
| 라우트 | `app/embed/page.tsx` (`(session)` 밖), 데모 `app/embed/demo/page.tsx` |
| 진입·부팅 | `src/application/embed-root.tsx`, `embed-client-app.tsx`, `EmbedGate.tsx` (handshake를 기다리고 토큰을 받은 뒤 children). `Providers`(MSW 부팅)는 그대로 쓴다 |
| 화면 | `src/views/embed` (grid + 설정에 따라 패널·도구 줄), `src/views/embed-demo` |
| 메시지 주고받기 | `src/features/embed-bridge` (`model`: 받은 요청 → draw·redraw·history, 진행·완료·오류 보내기 / `lib`: 출처 확인) |
| 임베드 세션 | `src/shared/api` (메모리 토큰 방식). `session.ts`를 쓰는 곳이 바뀌지 않게 한다 |
| 그리기·툴팁·선택 | 기존 `widgets/chart-grid`, `widgets/control-panel`, `widgets/filter-panel`, `widgets/tab-toolbar`, `features/draw-chart`, `features/open-chart`, `features/item-tooltip`, `entities/workspace`(탭 하나짜리 scope). 표현 컴포넌트는 props로 값을 받으므로 임베드 view가 컨테이너 역할을 한다 |
| 선택 값 | `features/item-actions`(우클릭 메뉴), `features/chart-settings`(구역 추가), 서버 `server/services/chart`, `server/charts/item-scope.ts`, `server/render/options.ts` |
| 임베드 client | `server/services/auth/accounts.ts` |
| SDK | 새 도구 패키지 `packages/embed-sdk` (`@vis-a-lot/embed-sdk`) |

### SDK 패키지

- FSD 밖의 도구 패키지다(`"vis-a-lot": { "fsd": true }` 없음). 앱을 import하지 않는다. 프로토콜 타입·상수(`type`, 오류 코드)는 이 패키지가 기준이고, `apps/web`이 `devDependencies`에 `"workspace:*"`로 선언해 타입을 import한다.
- 내용: `src/{index,client,queue,error,protocol,validate}.ts`, `src/types/*`. 외부 의존성 없음.
- 산출물: IIFE `dist/sdk.js`(전역 `VisALot`, `VisALotEmbedError`), ESM `dist/index.js`, 타입 `dist/index.d.ts`.
- 배포: SDK 파일은 앱과 같은 출처의 `/embed/sdk.js`로 나간다. 패키지가 다른 패키지 폴더에 쓰지 않는 규칙이 있으므로, `apps/web`이 자기 태스크에서 의존 패키지의 `dist/sdk.js`를 `public/embed/`로 가져온다(`turbo.json`에 `dependsOn: ["^build"]`, `outputs`에 `public/embed/**`, 산출물은 git에 넣지 않는다). 정적 Route Handler로 내보내는 길도 있으니 `node_modules/next/dist/docs/`에서 static export 제약을 읽고 고른다.
- 바꿀 문서·설정: `docs/architecture.md`(패키지 표), `turbo.json`(패키지 `build`·`test`·`typecheck`, web의 복사 태스크), `docs/deploy.md`(web 프로젝트 빌드가 SDK를 먼저 만든다. Vercel 프로젝트는 늘리지 않는다), `README.md`.

### 타입 문서 (Q2)

- 공개 타입·메서드에 TSDoc을 단다(예제 포함).
- TypeDoc으로 HTML을 만들어 `/embed/api/`로 함께 내보낸다 (SDK 복사와 같은 태스크).
- 도움말 1편 `apps/help/content/help/vis/embed.mdx`(+ `.en`, `.ja`): 붙이는 법, 예제, 콜백, 오류 코드, 지원 브라우저, 사이트마다 데이터가 따로인 점. 목차에 더한다.

### 데모

- `/embed/demo`: 같은 출처 호스트 페이지. 컨테이너 둘, 예제 코드, draw·redraw·history 버튼, 콜백 로그.
- `public/embed/sample.html`: SDK만 쓰는 정적 HTML. 다른 출처에 그대로 올려 실험·시연에 쓴다.

---

## 8. 작업 단위

PR은 하나(`feat/embed-sdk`)를 기본으로 한다. 단위마다 에이전트 한 명이 맡고, 파일이 겹치지 않게 나눴다.

| 단위 | 내용 | 주로 건드리는 곳 | 의존 |
|---|---|---|---|
| U0 실험 | 3장의 E1~E6. 버릴 코드로 확인하고 결과를 이 문서 부록에 적는다. 범위(다른 출처 / 같은 출처)와 iframe 여러 개 규칙을 확정한다 | 이 문서 | 없음. **끝나야 나머지를 시작한다** |
| U1 SDK 패키지 | `packages/embed-sdk` 전체: 프로토콜 타입, 클라이언트, 큐, 오류, 검증, 빌드(IIFE·ESM·d.ts), TSDoc·TypeDoc, vitest | `packages/embed-sdk/**`, `turbo.json`, `pnpm-workspace` 영향 없음 | U0 |
| U2 선택 값 | 5장: `selection` 속성 구역, `selection-values` API, gallery 우클릭 메뉴, OAS 생성물, 서버·화면 테스트 | `server/services/chart`, `server/charts`, `server/render/options.ts`, `features/chart-settings`, `features/item-actions`, `shared/api/generated` | U0 (U1과 나란히) |
| U3 iframe 화면 | 4장: `/embed` 라우트, 부팅·`EmbedGate`, 임베드 세션, `features/embed-bridge`, `views/embed`, UI 설정, 툴팁·선택 이벤트, history 다시 보기, 관리선 전달, 임베드 client | `app/embed`, `src/application/embed-*`, `src/views/embed`, `src/features/embed-bridge`, `src/shared/api`, `server/services/auth/accounts.ts` | U1(프로토콜 타입), U2(선택 값 API) |
| U4 데모·문서 | `/embed/demo`, `sample.html`, SDK·TypeDoc 복사 태스크, 도움말 3개 언어, `docs/architecture.md`·`deploy.md`·`prototype-spec.md`·`README.md`·`CHANGELOG.md` | `app/embed/demo`, `src/views/embed-demo`, `apps/web/public/embed`(산출물), `apps/help`, `docs` | U1, U3 |
| U5 보조 축 | 6장 전체 | `server/render/scatter.ts`·`line.ts`·`frame.ts`·`legend.ts`, `server/charts/item-props.ts`, `features/select-mode`, `features/item-actions`, `features/item-tooltip` | U0와 무관. 10장의 결정에 따른다 |

U1과 U3는 프로토콜 표(4.6)를 계약으로 삼는다. 표를 바꿔야 하면 이 문서를 먼저 고친다. OAS 생성물(`pnpm gen:api`)은 U2가 만들고, U3는 U2가 들어온 뒤 그 위에서 시작한다.

---

## 9. 완료 기준

| 항목 | 기준 |
|---|---|
| 흐름 | 다른 출처(또는 U0 결과에 따른 같은 출처) 호스트 페이지에서 `draw` → PNG 표시 → `redraw`(재부팅 없음) → `history`가 된다. 컨테이너 둘이 U0에서 정한 규칙대로 동작한다 |
| 오류 | 4.6의 코드마다 재현 경로가 있다: 자격 틀림, 컨테이너 없음, 진행 중 중복 draw, 잘못된 컬럼, 없는 데이터셋, 없는 history, `destroy` 뒤 대기 promise |
| 콜백 | `onProgress`(샘플 생성 포함), `onHover`·`onClick`(추가 컬럼 값 포함), `onSelect`(값 목록) |
| 격리 | 같은 출처 데모를 쓰는 동안 본 앱 탭의 로그인·테마·언어·탭 상태가 바뀌지 않는다 |
| SDK 테스트 (vitest) | 시나리오별로 채운다. **인증**: 자격 없이 draw, 틀린 자격. **부팅**: `frame` 만들기·읽기, `ready` 전 요청 대기, 3분 타임아웃. **동시 요청**: 컨테이너 여러 개, 같은 컨테이너 중복 draw, `history` 선행 호출 reject, 순번이 다른 메시지 버리기. **오류**: 필수 값 검증, 출처·source가 다른 메시지 무시, iframe이 보낸 `error` 전달. **수명 주기**: `redraw`가 iframe을 다시 쓰는지, `erase`·`destroy` 뒤 정리 |
| 화면·서버 테스트 | `embed-bridge` 메시지 처리(가짜 부모 창), `selection-values` 행 규칙, `option-fields.test.ts`(새 구역이 설정 창에 있는지), 임베드 client 토큰 scope |
| 브라우저 확인 | U0의 E1~E6을 구현본으로 다시 돌린 결과를 PR 본문에 적는다. Playwright는 3단계에서 들어와 있으면 `@embed` smoke(SDK 로드, draw, 툴팁 콜백)를 더하고, 없으면 손으로 확인한 목록을 적는다 |
| 명령 | 루트에서 `pnpm lint`·`pnpm typecheck`·`pnpm test`·`pnpm build` 통과. `pnpm gen:api:check` 통과 |
| i18n | 새 문구 ko·en·ja (`build`의 `lingui check missing` 통과). SDK 오류 메시지는 영어 한 가지 |
| 문서 | 도움말 1편(3개 언어), `prototype-spec.md`에 임베드 절, `architecture.md`·`deploy.md`·`README.md`, `CHANGELOG.md` |

브랜치: `feat/embed-sdk` (develop 기준). 보조 축을 따로 하면 `feat/y2-axis`.

---

## 10. 정해야 할 것

1. **보조 축(A13)을 이 PR에 넣을지.** legend 계열을 두 번째 y축으로 옮기는 기능이라 렌더러·선택·확대까지 건드린다. 임베드와 파일이 겹치지 않으므로 별도 PR(`feat/y2-axis`)을 권한다. 미뤄 둔 A4(보조 y축)와 묶어 뒤로 보내는 길도 있다.
2. **U0가 실패했을 때.** 다른 출처 iframe이 안 되면 같은 출처 데모로 줄여 끝낼지, 임베드 자체를 미룰지.
3. **iframe 여러 개.** U0의 E3이 실패하면 "페이지당 iframe 하나"로 막을지, DB를 페이지 사이에 공유하는 구조 변경을 따로 잡을지. 후자는 지금 탭 여러 개 문제도 함께 푼다.
4. **툴팁을 호스트가 그릴지.** iframe 안에 그리면 작은 iframe에서 가장자리에 붙고 iframe 밖으로 넘치지 못한다. 기본은 iframe 안이다. 호스트 페이지가 `hover` 이벤트로 직접 그리는 `ui.tooltip: 'host'`를 더할지.
5. **CSV 주소로 데이터 넘기기.** `data: { csvUrl, options }`로 iframe이 받아 적재하는 길(대상 서버의 CORS 필요)을 넣을지. 기본은 뺀다(샘플 데이터 현상 유지).
6. **이름.** 전역 `VisALot`과 `/embed/sdk.js`로 둘지.
7. **TypeDoc HTML을 배포에 넣을지**, 저장소 안 문서로만 둘지.

---

## 부록: 실험 결과

U0를 마친 뒤 채운다 (브라우저·버전, E1~E6 통과 여부, 숫자, 정한 범위).
