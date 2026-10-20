# vis-a-lot 프로토타입 기획서

> 서버사이드에서 그린 PNG 차트를 브라우저에 띄우는 B2B 시각화 솔루션의 포트폴리오/기술검증용 프로토타입.
> 원본(Spring 서버 + 사내 렌더링 툴)의 동작을 재현하되, 서버 유지비 없이 브라우저 안에서 "서버"를 돌린다.

---

## 1. 목표와 전제

| 항목 | 내용 |
|---|---|
| 목적 | 포트폴리오 / 기술 검증. 서버사이드 렌더링, 대용량 데이터 처리 구조, B2B 제품 흐름을 고르게 보여준다 |
| 비용 | 유지비 0원. 정적 호스팅만 사용 |
| 규모 | 실제 행만 정직하게 보여준다. 행 수(10만 / 50만 / 100만)를 바꿔 규모별 성능 차이를 보여준다 |
| 원칙 | 화면은 "진짜 서버와 REST로 통신한다"고 믿게 만든다. 나중에 실서버로 바꿔도 화면 코드는 바뀌지 않는다 |

원본 화면의 이미지 표시 방식은 그대로 유지한다.

```tsx
data?.url && <img src={data.url} width={data.width} height={data.height} />
```

---

## 2. 아키텍처

```
[화면 (React / Next.js)] ──fetch──▶ [MSW service worker] ──▶ [MSW handler (메인 스레드)]
                                                                   │
                                                         [Job Manager]
                                                          · 순차 대기열 (우선순위 조정 없음)
                                                          · long polling 응답 대기
                        ┌──────────────────────────────────────────┼─────────────────┐
                        ▼                                          ▼                 ▼
               [DB Worker: PGlite]  ──열 단위 숫자 배열 전달──▶ [Render Worker 1..N]
                · 데이터 생성 + COPY 적재                         · OffscreenCanvas
                · IndexedDB에 저장                                · convertToBlob → PNG
                                                                   │
                                                       [Cache API: PNG 보관]
                                                        `<img>` 요청은 MSW가 Cache에서 응답
```

| 영역 | 결정 | 이유 |
|---|---|---|
| mocking server | MSW 2, REST | 화면에서는 실서버에 `fetch`하는 것과 똑같다 |
| DB | PGlite 1개를 전용 DB Worker에서 실행, `idb://`로 IndexedDB에 저장 | PGlite는 연결을 하나만 받는다. 쿼리는 DB Worker에서 순차 처리하고, 무거운 렌더만 병렬로 돌린다 |
| 렌더 | Render Worker N개 (`hardwareConcurrency - 1`, 최대 4) | 렌더가 쿼리보다 무겁다 |
| 차트 그리기 | 차트 라이브러리 없이 `d3-scale` + Canvas 2D로 직접 그리기 | metadata, 도형 좌표 변환, 픽셀 기준 점 줄이기가 같은 축 계산을 공유해야 한다 |
| 데이터 전달 | 쿼리 결과를 `Float64Array` 같은 열 단위 숫자 배열로 transfer | 수십만 개 점을 복사 없이 넘긴다 |
| 앱 | Next.js 정적 사이트 내보내기(static export), 화면은 전부 클라이언트에서 동작 | 무료 정적 호스팅. 나중에 실서버로 옮길 때 Route Handler로 이전할 수 있다 |
| PNG 제공 | Cache API에 `/charts/:chartId/items/:key/png?v=` 주소로 저장하고, MSW가 이 주소의 요청에 응답 | 화면 코드를 원본과 똑같이 유지한다. `<img>` 요청이 MSW까지 오지 않으면 `blob:` URL로 대체 (구현 초기에 검증) |

---

## 3. 데이터

### 3.1 생성 규칙
- 제조/IoT 센서 데이터를 고정 시드로 절차적 생성한다. 시드는 사용자에게 노출하지 않는다.
- 기간은 30일 고정이다. 측정 간격은 행 수에 맞춰 자동으로 정한다 (센서 480개 기준: 100만 행이면 약 20분, 10만 행이면 약 3시간).
- 신호는 아래 패턴을 합쳐서 만든다.
  - 하루 주기 변동
  - 설비별 장기 drift
  - 정규분포 노이즈
  - 이상 구간: 갑자기 튀는 값(spike), 수준 상승 유지, 측정 누락
- 생성은 DB Worker 안에서 하고 `COPY`로 한꺼번에 적재한다. 생성하는 동안 진행률을 표시한다.

### 3.2 컬럼

| 컬럼 | 타입 | 고유값 수 | 용도 |
|---|---|---|---|
| `ts` | 시계열 | — | scatter의 x (시계열) |
| `factory` | 문자 | 3 | split, x |
| `line` | 문자 | 공장당 4 | split |
| `machine` | 문자 | 약 120 | split |
| `sensor_type` | 문자 | 4 (온도/진동/압력/전류) | split, x |
| `shift` | 문자 | 3 (주간/야간/심야) | split, x |
| `lot_id` | 문자 | 약 5,000 | 고유값이 많은 split. 30,000개 초과 경고 확인용 |
| `status` | 문자 | 3 (정상/경고/이상) | split, 색상 |
| `value` | 숫자 | — | y, scatter의 x |
| `temperature_env` | 숫자 | — | 주변 온도. `value`와 상관관계가 있다 |
| `load_pct` | 숫자 | — | 설비 부하율 |

### 3.3 행 수 전환
- 행 수(10만 / 50만 / 100만)는 고를 때 그 규모의 데이터를 생성한다. 한 번 만든 데이터는 IndexedDB에 남는다.
- history에는 몇 건짜리 데이터였는지 함께 저장한다. 불러올 때 그 데이터가 없으면 생성한다.
- 데이터가 아직 없어도 draw 버튼은 누를 수 있다. 이때 job은 `init` 상태(spinner만 표시)로 기다리고, 데이터 생성이 끝난 뒤부터 `progress`로 넘어간다.

---

## 4. 화면

### 4.1 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ [일반] [확대] [사각형] [선] [자유곡선] [텍스트]   ← 모드 바       │
├──────────────────┬───────────────────────────────────────────┤
│ 차트 종류 (아이콘)  │  ┌────────┐ ┌────────┐ ┌────────┐         │
│ grid 1x1 ~ 10x10 │  │toolbar │ │toolbar │ │toolbar │         │
│ x        [▼]     │  │  PNG   │ │  PNG   │ │  PNG   │         │
│ y        [▼]     │  └────────┘ └────────┘ └────────┘         │
│ 통계 함수 [▼]      │                                           │
│   (bar일 때만)     │              ‹ 1 / 3 ›  (스크롤 = 페이지)   │
│ split by [▼ 다중] │                                           │
│ tooltip  [▼ 다중] │  ───────────── 전체 진행률 ─────────────     │
│ [공통 속성 ⧉]      │                                           │
│ [draw]           │                                           │
└──────────────────┴───────────────────────────────────────────┘
```

- **모드 바:** 일반 / 확대 / 사각형 / 선 / 자유곡선 / 텍스트
- **왼쪽 패널:** 차트 종류, grid 크기, x, y, 통계 함수(bar일 때만), split by, tooltip, 공통 속성(popover), draw 버튼
- **item 툴바:** 축소, 확대 초기화, 도형 undo, 도형 전체 삭제, 개별 색상

### 4.2 차트 종류

| 차트 | x | y |
|---|---|---|
| scatter | 숫자 또는 시계열 컬럼 | 숫자 컬럼 |
| bar | categorical 컬럼 | 숫자 컬럼을 집계한 값 (통계 함수 선택) |
| boxplot | categorical 컬럼 (그룹) | 숫자 컬럼의 분포 |

PNG로 그리기 때문에 scatter의 점이 많아도 이미지 크기는 같다. 밀도 차트로 바꾸는 처리는 하지 않는다.

### 4.3 Split by와 grid
- 여러 컬럼을 고를 수 있는 selectbox이고, 클릭한 순서를 보장한다. 예: `a`(숫자) → `b` → `c` 순서로 고르면 item 이름은 `a-b-c`가 된다. 구분 기호는 설정에서 바꿀 수 있다.
- 어떤 컬럼이든 고유값을 그대로 category로 쓴다.
- item 수는 고른 컬럼 고유값의 조합 수이고, 최대 30,000개다. 넘으면 draw 전에 경고하고 그리지 않는다 (`split-count` API로 미리 확인).
- grid는 1×1부터 10×10까지 고를 수 있고, pagination으로 보여준다. 예: 3×3 grid에 item이 20개면 3페이지가 된다. 스크롤하면 페이지가 넘어간다.
- 고해상도(레티나) 화면 대응은 하지 않는다.

### 4.4 툴팁
- tooltip 컬럼을 여러 개 고를 수 있는 selectbox가 있다.
- item에 처음 커서를 올리면 metadata를 받아오고, 그다음부터는 저장해 둔 것을 쓴다 (첫 커서에만 딜레이 허용).
- metadata 구성:
  - 그림 영역의 픽셀 범위
  - 축 범위와 축 종류 (선형/시계열/범주)
  - 픽셀 기준으로 줄인 점 (같은 픽셀 칸에 겹친 점은 대표 점 하나만 남김) + 각 점의 x, y, 행 id
  - bar / boxplot의 통계값
- x, y 값과 가장 가까운 점은 metadata만으로 서버 호출 없이 바로 보여준다. tooltip에서 다른 컬럼을 고른 경우에만 서버를 호출한다.
- 차트 종류별 툴팁 렌더링은 strategy pattern으로 만든다.
  - scatter: 커서 위치의 좌표값 + 가장 가까운 점
  - bar: 막대의 집계값
  - boxplot: 사분위수 등 통계값

### 4.5 확대/축소
- item마다 따로 동작한다 (item마다 category가 달라서 축을 공유할 수 없다).
- 확대: 확대 모드에서 십자 커서로 영역을 선택하면 서버가 그 범위로 다시 그린다.
- 축소: 정해진 비율로 축소한다.
- 처음으로 되돌리기가 있다.

### 4.6 도형
- 사각형, 선, 자유곡선, 텍스트 메모를 지원한다.
- 위치는 데이터 좌표로 저장해서, 확대해도 같은 데이터 위치에 붙어 있다.
- 서버에 저장하고, 서버가 PNG 안에 함께 그린다.
- 그리는 동안에는 화면에 임시 미리보기를 보여준다. 마우스를 떼면 서버에 저장하고 다시 그린다. PNG를 다시 받는 동안 그 item의 조작은 막는다.
- 그린 뒤에는 수정할 수 없다. undo(마지막 도형 삭제)와 전체 삭제만 있다.
- undo는 서버에서 마지막 도형을 삭제(`DELETE .../shapes/last`)하고 다시 그리는 방식이다. 이력은 세션 안에서만 유지하고, redo는 없다.

### 4.7 공통 속성 / 개별 속성
- 모든 item은 기본적으로 공통 속성을 따른다.
- 개별 속성은 split 조합을 키로 서버에 저장한다. 다시 불러와도 유지된다.
- 공통 속성을 바꾸면 개별 속성까지 덮어쓰고 전체를 다시 그린다.
- 이번 범위에서 개별 속성은 색상만 지원한다.

---

## 5. 렌더링 작업(job)

### 5.1 원칙
- **모든 렌더링을 job + long polling 하나의 모델로 처리한다.** 전체 draw, item 하나 다시 그리기(확대/도형/색상), resize로 인한 일괄 다시 그리기가 모두 여기에 해당한다.
- draw 한 번으로 생기는 job은 모든 페이지의 item 전체를 처음부터 순서대로 그린다. 대기열 순서를 바꾸지 않는다 (렌더 연산이 무거워서 순서를 당기면 총 작업 시간이 늘 수 있다).
- 페이지 이동은 job과 무관하다. 페이지를 넘겨도 작업은 멈추지 않는다.
- 다 그려진 item부터 화면에 보여준다. `url`이 없으면 spinner + progress bar를 보여준다.
- 사용자 조작은 item 단위로 막는다. 다 그려진 item에서는 툴팁, 확대, 도형을 바로 쓸 수 있다.
- 실패한 item에는 에러 표시만 남긴다. 다시 시도 버튼은 없다.

### 5.2 상태

```ts
const TERMINAL_STATUSES = ['success', 'failed', 'cancelled'] as const;
type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

type JobStatus = 'init' | 'progress' | TerminalStatus;
type ItemStatus = 'queued' | 'running' | TerminalStatus;
type ItemStage = 'query' | 'aggregate' | 'render' | 'encode';
```

- `init`: 데이터 생성을 기다리는 상태. spinner만 표시한다.
- 진행률은 단계별로 최대한 자세하게 보여준다 (item마다 단계 + 단계별 진행률, 하단에 전체 진행률).
- long polling은 현재 페이지의 item이 모두 끝난 상태(`TERMINAL_STATUSES`)가 되면 끝난다.

### 5.3 draw 버튼

```
[draw] ──클릭──▶ [pending] (disabled) ──job 진행 상태 수신──▶ [cancel] ──클릭 또는 job 종료──▶ [draw]
```

- 설정을 바꿔도 자동으로 다시 그리지 않는다. draw를 눌러야 그린다.
- 취소하면 아직 그려지지 못한 item은 `cancelled`로 mock 서버와 history에 기록한다.
- 예외: grid 크기를 바꾸면 바로 전체를 다시 그린다 (item 픽셀 크기가 바뀌기 때문). 단, 렌더링 중에는 grid 크기를 바꿀 수 없고 팝업으로 알린다.

### 5.4 resize
- 크기 변경이 멈추고 300ms가 지나면 한 번만 다시 그린다.
- 다시 그리는 동안에는 이전 PNG를 새 크기에 맞게 늘리거나 줄여서 보여주고 progress를 함께 표시한다.
- 현재 페이지 item만 다시 그린다. 다른 페이지는 이동했을 때 크기가 다르면 그때 다시 그린다.
- first draw 도중에 resize가 일어나면 진행 중인 job은 그대로 두고, 끝난 뒤 크기가 달라진 item만 다시 그린다.
- history에는 기록하지 않는다.

### 5.5 PNG 보관
- 완성된 PNG는 Cache API에 보관한다. 키는 차트 ID + item 키 + 버전이다.
- 페이지를 오가도 이미 그린 PNG는 바로 보여준다.

---

## 6. API (MSW, REST)

그리기를 요청하는 API는 모두 `{ jobId }`를 돌려준다.

| 용도 | 요청 | 응답 / 설명 |
|---|---|---|
| 컬럼 목록 | `GET /datasets/:id/columns` | 이름, 타입, 고유값 수 |
| 데이터 상태 | `GET /datasets/:id/status?rows=` | 생성 여부, 생성 진행률 |
| split 개수 확인 | `GET /datasets/:id/split-count?cols=a,b,c` | 조합 수 (30,000개 초과 검사) |
| 그리기 시작 | `POST /charts` | 요청: 차트 종류, x, y, 통계 함수, split by(순서 포함), 구분 기호, tooltip 컬럼, grid 크기, 공통 속성, 행 수<br>응답: `chartId`, `jobId`, `historyId`, 전체 item 목록 |
| 진행 상태 | `GET /jobs/:jobId?items=k1,k2,...` | long polling. 전체 진행률 + 요청한 item의 상태·단계·진행률·`{ url, width, height }` |
| 취소 | `POST /jobs/:jobId/cancel` | 남은 item을 `cancelled`로 기록 |
| PNG | `GET /charts/:chartId/items/:key/png?v=` | `image/png` |
| metadata | `GET /charts/:chartId/items/:key/meta` | 4.4 참고 |
| 툴팁 추가 컬럼 | `POST /charts/:chartId/items/:key/tooltip` | 점의 행 id + 고른 컬럼 → 값 |
| 확대/축소 | `POST /charts/:chartId/items/:key/view` | `{ type: 'zoomIn', rect }` \| `{ type: 'zoomOut', ratio }` \| `{ type: 'reset' }` |
| 도형 | `POST .../items/:key/shapes`<br>`DELETE .../items/:key/shapes/last`<br>`DELETE .../items/:key/shapes` | 추가 / undo / 전체 삭제 |
| 개별 색상 | `PATCH .../items/:key/props` | `{ color }` |
| grid 변경 | `PATCH /charts/:chartId/grid` | 전체 다시 그리기 job |
| resize | `POST /charts/:chartId/resize` | 요청한 item만 다시 그리기 job |
| history | `GET /history`, `GET /history/:id` | 목록(썸네일 포함), 저장된 상태로 복원 |

---

## 7. History
- 브라우저(IndexedDB)에만 보관한다. 서버 비용은 0원이다.
- draw 한 번에 한 건이 생긴다. 그 뒤의 확대, 도형, 개별 색상, grid 변경은 같은 건에 덧붙인다. resize는 기록하지 않는다.
- 저장 내용: 행 수, 생성기 버전, 차트 설정, 공통/개별 속성, 도형, 확대 상태, item별 최종 상태(`cancelled` 포함), 썸네일.
- 공유는 URL에 설정을 담아서 한다. 시드가 고정이라 같은 URL이면 같은 차트가 다시 만들어진다.

---

## 8. 범위 밖 (후순위)
- 색상 외 개별 속성 (원본에는 많은 개별 속성 제어가 있음)
- 도형 수정, redo
- 실패한 item 다시 시도
- 기기 간 history 동기화, 팀 공유
- 고해상도(레티나) 대응
- 데이터셋 여러 개, 사용자 업로드

---

## 9. 구현 순서

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| 1 | 기본 구조: Next.js static export, MSW, DB Worker, Render Worker pool | `<img>` 요청이 MSW handler에서 Cache API의 PNG로 응답되는지 검증 |
| 2 | 데이터 생성기 + PGlite 적재 | 10만 / 50만 / 100만 행 생성, 진행률 표시, 새로고침 후에도 데이터 유지 |
| 3 | scatter 하나로 전체 흐름 연결 | draw → job → PNG 표시 |
| 4 | job 모델 완성 | 단계별 progress, long polling, 취소, `init` 상태, 상태 tuple |
| 5 | split by + grid + pagination | 조합 순서, 구분 기호, 30,000개 경고 |
| 6 | 툴팁 + metadata | strategy pattern, 픽셀 기준 점 줄이기, 추가 컬럼 조회 |
| 7 | 확대/축소 + 도형 | 데이터 좌표 고정, undo, 조작 차단 |
| 8 | bar / boxplot | 통계 함수 select, 사분위수 툴팁 |
| 9 | 공통/개별 속성 | 색상 덮어쓰기 규칙 |
| 10 | resize + grid 변경 | 300ms debounce, 현재 페이지만 다시 그리기 |
| 11 | history + URL 공유 | 저장, 복원, 링크로 재현 |
