# 차트 다듬기 스펙

> [기능 확장 후보 기획](feature-expansion-plan.md)의 1단계. 지금 차트 화면에서 손이 닿지 않던 작은 기능을 기존 구조 안에서 채운다.
> PR 하나로 올린다. 브랜치 `feat/chart-refinements` → `develop`.

기준: vis-a-lot `develop` 0.18.2.

---

## 1. 범위

| 기획서 | 기능 | 지금 | 더하는 것 |
|---|---|---|---|
| A6 | item 제목 검색 | split item은 30,000개까지 생기는데 페이지를 넘겨 찾는 길뿐이다 | 이름 조건으로 item을 걸러 본다 |
| A8 | 순서 바꾸기 | legend는 컬럼 값 순과 뒤집기만, 범주 x축은 값 순만 된다 | legend 값과 범주 x축의 순서를 직접 정한다. 자연 정렬 |
| A9 | 강조 방식 | 강조는 조건(연산자 + 값) 하나다 | 순위(위·아래 N개)와 범위(최소~최대) |
| A12 | 차트 속성 보강 | 통계 함수 6종, 점 모양 5종, 이상치는 빼기만, 팔레트는 기본 8색 또는 그라데이션, 부제목은 글자·색만 | 통계 함수 5종, 점 모양 5종, 이상치만 보기, 팔레트 색 목록, 부제목 글자 크기·정렬 (6장 표) |

### 빼는 것

| 뺀 것 | 이유 |
|---|---|
| 보조 y축, 축 여러 개 | y 컬럼을 여러 개 받는 일(A4)이 먼저다. `ChartSpec`의 y가 하나다 |
| 선택 필드 값 묶기 | 임베드 단계(A10)에서 선택 이벤트와 함께 다룬다 |
| 강조 규칙 여러 개, legend 값·점 크기를 대상으로 한 강조 | 저장 모양(`focus` 객체 하나)을 바꿔야 한다. 10장에서 정한다 |
| legend 정규식 정렬, 뒤에 둘 값 목록 | 직접 순서 + 자연 정렬로 같은 결과를 낸다 |
| 툴팁 항목마다 다른 앞뒤 글자·소수 자리 | 툴팁 컬럼 선택과 공통 앞뒤 글자·소수 자리가 이미 있다 |
| item 정렬 (행 수, x·y 최소·최대 순으로 grid 놓기) | 검색과 같은 자리(job 조회의 item 순서)를 쓰는 다음 후보다. 이번에는 적어만 둔다 |

---

## 2. item 제목 검색 (A6)

### 2.1 동작

- 탭 도구 줄 오른쪽에 검색 입력을 둔다. 입력에 포커스가 들어오면 popover가 열린다: 일치 방식 넷(포함 · 시작 · 끝 · 완전 일치, segmented), 걸어 둔 조건 목록(글자 + 방식 + 삭제), `모두 지우기`.
- Enter로 조건을 더한다. 더한 뒤 입력을 비우고 포커스는 그대로 둔다. 글자와 방식이 같은 조건(대소문자 무시)은 더하지 않고 알린다. 조건은 10개까지, 글자는 100자까지다.
- 대상은 item 이름(split 조합 이름, 구분 기호 포함)이다. 제목 속성(`title.text`)으로 바꾼 글자는 보지 않는다. 대소문자를 가리지 않는다.
- 조건이 여럿이면 **하나라도 맞는 item**을 남긴다(OR). 조건을 더할수록 결과가 늘어나므로 "A 설비와 B 설비만 보기"처럼 쓴다.
- 조건이 있으면 grid·페이지 스크롤바·크게 보기 섬네일이 맞는 item만 순서대로 보인다. 조건이 바뀌면 첫 페이지로 간다. 입력 옆에 맞는 개수를 적는다. 맞는 item이 없으면 grid 자리에 빈 상태(아이콘·제목·`조건 지우기`)를 보인다.
- 렌더 job과 무관하다. 검색해도 그리는 순서와 하단 진행률(전체 기준)은 바뀌지 않는다.
- 검색 조건은 탭 상태다. 차트 설정(spec)·history·공유에 넣지 않는다. 새로 draw하면 지운다.
- `모든 차트 엑셀로 다운로드`는 조건이 있으면 맞는 item만 담고 파일 이름에 `_검색`을 붙인다.
- 그린 차트가 없거나 item이 하나면 입력을 막는다. history 탭(다시 보기)에서도 쓴다.

### 2.2 API

| 요청 | 변경 |
|---|---|
| `GET /jobs/:jobId` | query `search` 추가. `[{ keyword, match }]`를 JSON 문자열로 보낸다. `match`는 `contains` · `startsWith` · `endsWith` · `exact`. `page`·`offset`은 거른 순서 기준이다 |
| 응답 | `matchedItems: number \| null` 추가. `search`가 없으면 `totalItems`와 같고, split 조합을 아직 모르면(`init`) null |

- `items=k1,k2`(item 단위 다시 그리기)에는 `search`를 적용하지 않는다.
- 잘못된 JSON이나 한도 초과는 400이다.

### 2.3 서버

- `server/jobs/job-manager.ts`: `ItemSelection`에 `search`를 더하고, `selectedKeys`·`startOf`가 `job.order`를 item `label`로 거른 순서를 쓴다. 거른 순서는 job마다 조건 문자열을 키로 한 건만 기억한다(30,000개를 요청마다 다시 훑지 않게).
- long polling 종료 조건(요청한 페이지 item이 모두 끝남)은 그대로다.

### 2.4 화면

| 위치 | 내용 |
|---|---|
| `apps/web/src/features/search-items` (새 slice) | `ui/ItemSearch.tsx`(입력·popover·조건 목록), `model/search-conds.ts`(중복 판정·한도), `config/messages` |
| `apps/web/src/entities/workspace/model/workspace-store.ts` | 탭 상태 `search`, `setSearch`. draw 때 초기화 |
| `apps/web/src/shared/api` | job query에 `search`, query key에 조건 포함 |
| `apps/web/src/widgets/tab-toolbar` | 검색 입력 자리 |
| `apps/web/src/widgets/chart-grid` | 페이지 수를 `matchedItems`로, 빈 상태, 크게 보기 섬네일 offset |
| `apps/web/src/features/chart-actions/model/chart-download.ts` | 엑셀 내보내기가 조건을 함께 보낸다 |

입력 중 글자는 화면에만 두고 Enter로만 조건이 된다. 조건이 바뀌어 페이지를 다시 받는 동안 이전 grid를 그대로 두고 흐리게 보인다(transition).

---

## 3. 순서 바꾸기 (A8)

지금 legend 항목은 전체 데이터 기준 컬럼 값 순으로 놓이고 `legend.reverse`로 뒤집을 수만 있다. 범주 x축도 값 순이다. 그래서 `L2, L10, L1`을 `L1, L2, L10`으로 놓거나 '정상 → 경고 → 이상'처럼 뜻이 있는 순서로 놓을 수 없다. 순서를 차트 속성으로 받는다. 공통 속성에 정하면 모든 item에, item 개별 속성에 정하면 그 item에만 걸린다.

### 3.1 속성

| 경로 | 타입 | 기본 | 뜻 |
|---|---|---|---|
| `legend.sort` | `"default" \| "natural"` | `default` | 나머지 값의 순서. default는 지금처럼 컬럼 값 순, natural은 글자 안 숫자를 수로 비교 |
| `legend.order` | `string[]` | `[]` | 앞에 둘 legend 값. 적은 순서대로 놓고, 적지 않은 값은 `sort` 순으로 뒤에 온다 |
| `axes.x.categorySort` | 같음 | `default` | 범주 x축의 나머지 순서 |
| `axes.x.categoryOrder` | `string[]` | `[]` | 앞에 둘 범주 |

- 목록에 있지만 그 item에 없는 값은 건너뛴다. 목록은 200개까지다.
- 배열은 합칠 때 통째로 바뀐다(`mergeOptions`의 기존 규칙). item 개별 순서를 정하면 공통 순서 전체를 대신한다.
- `legend.reverse`는 이 순서를 정한 뒤 뒤집는다.

### 3.2 그림

- **legend 순서**가 바꾸는 것: legend 상자의 항목 순서, 범주 안에 나란히 놓는 막대·상자 순서, 쌓는 순서(Stack·Stack 100), histogram의 구간 안 막대 순서, radar 다각형·line 계열을 그리는 순서.
- **색은 바뀌지 않는다.** 색은 지금처럼 값을 따른다(전체 데이터 기준 legend 값 순번). metadata의 legend 항목도 원래 순번을 그대로 갖는다(`reverse`와 같은 방식).
- **범주 순서**를 쓰는 차트: bar, boxplot, waterfall, heatmap(x). waterfall은 바꾼 순서대로 누적한다. 값 크기로 놓는 차트(pie, funnel, radar 축, treemap, sankey)와 gantt 행은 쓰지 않는다.
- legend 순서를 쓰는 차트: legend 컬럼을 고르는 차트(scatter, line, bar, boxplot, histogram, radar, gantt, treemap). 차트가 legend를 정하는 종류(pie, funnel, sankey, waterfall, candle, heatmap)는 쓰지 않는다.
- 범주 순서는 데이터를 받은 직후 범주 배열과 칸을 함께 옮겨 적용한다. 툴팁·선택·데이터 테이블은 metadata의 범주 순번을 쓰므로 그대로 맞는다.

### 3.3 화면

- 전체 설정·item 속성 팝업의 범례 구역에 `정렬`(select)과 `순서`, 축 › X축에 `범주 정렬`과 `범주 순서`.
- `순서` 필드는 새 필드 종류 `order`다. 값 목록을 끌어 순서를 바꾸고(키보드는 Alt+↑↓), 옮긴 값만 저장한다. 목록 맨 위부터 마지막으로 옮긴 값까지가 `order`가 된다. `처음 순서로`로 비운다.
- 값 목록: legend는 `GET /api/data/datasets/:id/legend-values?column=`, 범주는 `GET /api/data/datasets/:id/columns/:column/summary`. 고유값이 200개를 넘는 범주 컬럼은 `순서`를 막고 정렬만 고르게 한다.
- 드래그는 저장소가 이미 쓰는 dnd-kit, 긴 목록은 가상 스크롤.

| 위치 | 내용 |
|---|---|
| `apps/web/src/features/chart-settings` | `model/option-fields.ts`에 필드와 `order` 종류, `ui/OptionSectionForm.tsx`가 그린다. 새 `ui/OrderField.tsx` |
| `apps/web/src/entities/chart/model/chart-options.ts` | 차트별 지원 표(범주 순서를 쓰는 차트) |
| `apps/web/server/render/options.ts`, `server/charts/chart-defaults.ts`, `server/services/chart/schemas.ts` | 타입·기본값·검증 |
| `apps/web/server/jobs/job-manager.ts`, `server/render/legend.ts`, `server/render/category.ts`, `server/render/heatmap.ts`, `server/render/waterfall.ts` | 순서 적용 |
| `apps/web/server/render/order.ts` (새 파일) | `orderValues(values, order, sort)`와 자연 정렬 비교. 렌더러가 쓰므로 import 없는 순수 함수 |

---

## 4. 강조 방식 (A9)

지금 강조(`focus`)는 규칙 하나다: 대상(x 또는 y), 연산자, 값, 그리고 맞는 도형의 색·모양·크기. "값이 큰 10개"나 "20~40 사이"는 조건 하나로 적을 수 없다. 규칙 하나는 그대로 두고 방식을 더한다.

### 4.1 속성

| 경로 | 타입 | 기본 | 뜻 |
|---|---|---|---|
| `focus.type` | `"condition" \| "rank" \| "range"` | `condition` | 강조 방식 |
| `focus.rankFrom` | `"top" \| "bottom"` | `top` | 큰 쪽·작은 쪽 |
| `focus.rankCount` | 1..1000 | 10 | 강조할 개수 |
| `focus.rangeMin` / `focus.rangeMax` | `number \| null` | null | 범위(양 끝 포함). null이면 그쪽은 열려 있다 |

- 순위는 그 item이 그리는 도형(점·막대·상자·캔들·작업) 전체에서 대상 값으로 매긴다. 확대 범위와 상관없고, 필터·지운 점·끈 legend 값은 뺀 뒤다. 경계 값과 같은 것은 모두 넣는다.
- 지금 focus를 쓰는 차트(scatter, line, bar, boxplot, gantt, candle)에서 그대로 쓴다. 색·모양·크기·`legendSingleColor`는 세 방식이 함께 쓴다.
- 설정 팝업은 방식에 맞는 필드만 보인다 (조건: 연산자·값, 순위: 방향·개수, 범위: 최소·최대).

### 4.2 구현

- `server/render/analytics/focus.ts`: `focusTest`를 `focusMatcher(options, xs, ys)`로 바꾼다. 순위는 먼저 경계 값을 구하고(개수 N 크기 heap, O(n log N)) 판정 함수를 돌려준다. 조건·범위는 값만 본다.
- 부르는 곳: `server/render/scatter.ts`, `category.ts`, `gantt.ts`, `candle.ts`.
- 화면: `features/chart-settings/model/option-fields.ts`의 강조 구역, 필드를 방식에 따라 숨기는 규칙.

---

## 5. 차트 속성 보강 (A12)

### 5.1 통계 함수

지금 6종(`server/data/schema.ts`의 `AGG_FNS`): avg, sum, count, min, max, median. 흩어짐과 고유값 수를 볼 함수가 없다.

| 더하는 값 | SQL | 메모 |
|---|---|---|
| `uniqueCount` | `count(distinct y)` | |
| `stddev` | `stddev_samp(y)` | 행이 하나면 null → 빈 칸 |
| `stddevP` | `stddev_pop(y)` | |
| `q1` / `q3` | `percentile_cont(0.25 / 0.75)` | |

통계 함수를 쓰는 모든 차트(bar, pie, radar, heatmap, treemap, sankey, waterfall, funnel)와 '기타' 다시 집계에 적용한다. 이름은 화면 3개 언어, 서버 `AGG_LABELS`.

### 5.2 점 모양

지금 5종(`POINT_SHAPES`). legend 값이 8개까지라 모양으로도 계열을 가르려면 모자란다. `downTriangle`, `leftTriangle`, `rightTriangle`, `hexagon`, `star`를 더한다. `shape.type`과 `focus.shape`가 함께 쓴다. PNG 점, legend 표시(PNG와 DOM), 툴팁 표시가 같은 모양이어야 한다.

### 5.3 그 밖

| 경로 | 타입 | 기본 | 뜻 |
|---|---|---|---|
| `value.outlierMode` | `"except" \| "only"` | `except` | 이상치 처리. except는 지금처럼 이상치를 빼고, only는 이상치만 그린다 |
| `palette.colors` | `string[]` | `[]` | 기본 팔레트 8색을 대신할 색 목록(8개까지). 비면 기본 팔레트. 그라데이션을 켜면 그라데이션이 우선 |
| `title.subtitleFontSize` | number | 11 | 부제목 글자 크기 |
| `title.subtitleAlign` | `left \| center \| right` | `left` | 부제목 정렬 |

기본값은 모두 지금 그림과 같다. `option-fields.test.ts`(서버 기본값의 모든 칸이 설정 창에 있는지)가 새 칸도 지킨다.

---

## 6. 차트 속성 구역별 정리

구역마다 지금 있는 칸, 이 PR이 더하는 칸, 검토했지만 하지 않는 것을 적는다. 경로는 `ChartOptions`(`server/render/options.ts`) 기준이다.

### 제목 (`title`)

| | 내용 |
|---|---|
| 지금 있는 것 | 보이기, 글자(`text`), 부제목(`subtitle`)·부제목 색, 글자 크기·굵게·색·정렬, 요약 보이기·색, split 구분 기호 |
| 더하는 것 | 부제목 글자 크기·정렬 (5.3) |
| 하지 않는 것 | 글꼴 고르기. PNG 글꼴은 하나다 |

### 축 (`axes.x`, `axes.y`)

| | 내용 |
|---|---|
| 지금 있는 것 | 보이기, 축 제목(보이기·글자·색), 최소·최대(null = 자동), 로그, 축선·격자·눈금(보이기·굵기·색·개수·길이), 눈금 글자(보이기·각도·크기·색), 소수 자리, 시계열 형식 |
| 더하는 것 | 범주 정렬·범주 순서 (3장) |
| 하지 않는 것 | 격자 간격 따로 정하기(격자는 눈금을 따른다). 눈금 글자 최대 길이(겹치는 글자는 렌더러가 건너뛴다). 축 제목 각도. 보조 y축(A4가 먼저다) |

### 범례 (`legend`)

| | 내용 |
|---|---|
| 지금 있는 것 | 보이기, 위치, 테두리·테두리 색, 순서 뒤집기, 글자 크기·색, 제목 색, 값별 색 |
| 더하는 것 | 정렬(`sort`), 순서(`order`) (3장) |
| 하지 않는 것 | legend 상자 크기 직접 정하기. 넘치면 `+N`으로 줄인다 |

### 패널 (`panel`)

| | 내용 |
|---|---|
| 지금 있는 것 | 배경색, 그라데이션, 테두리·테두리 색, 여백(위·아래·왼쪽·오른쪽) |
| 더하는 것 | 없음 |

### 팔레트 (`palette`)

| | 내용 |
|---|---|
| 지금 있는 것 | 공통 색, 그라데이션(시작·중간·끝·단계 수·뒤집기), 기타 색 |
| 더하는 것 | 색 목록(`colors`) (5.3) |

### 모양 (`shape`)

| | 내용 |
|---|---|
| 지금 있는 것 | 점 모양 5종, 채우기 방식(둘 다·테두리·채우기), 투명도, 테두리 굵기·색, 선택 밖 진하기, 막대 모서리 둥글기, 중앙값 선 색 |
| 더하는 것 | 점 모양 5종 (5.2) |
| 하지 않는 것 | 도형 안 그라데이션. 겹친 점을 구분하는 테두리와 맞지 않는다 |

### 크기 (`size`)

| | 내용 |
|---|---|
| 지금 있는 것 | 점 크기 자동·고정·최소·최대, 글자 크기 자동·최소·최대, 선 굵기 |
| 더하는 것 | 없음 |

### 점 라벨 (`pointLabel`)

| | 내용 |
|---|---|
| 지금 있는 것 | 보이기, 각도, 위치, 글자 크기·색, 앞뒤 글자, 소수 자리, 상자(보이기·배경색·테두리 색) |
| 더하는 것 | 없음 |
| 하지 않는 것 | 라벨에 적을 값 고르기(차트마다 적는 값이 정해져 있다). 라벨 이음선(겹치면 건너뛰는 방식이라 이음선이 없다) |

### 값 (`value`)

| | 내용 |
|---|---|
| 지금 있는 것 | 빈 칸 값(`nullNumeric`), 이상치 제외(`outlier`), 방식(`outlierMethod`: IQR·σ), 배수(`outlierK`) |
| 더하는 것 | 이상치 처리(`outlierMode`: 빼기·이상치만) (5.3) |
| 하지 않는 것 | 범주·시계열 컬럼의 빈 값 바꿔 그리기. 빈 값은 필터의 '값 없음 포함'으로 다룬다 |

### 강조 (`focus`)

| | 내용 |
|---|---|
| 지금 있는 것 | 켜기, 대상(x·y), 연산자, 값, 색·모양·크기, 나머지를 한 색으로(`legendSingleColor`) |
| 더하는 것 | 방식(`type`), 순위(`rankFrom`·`rankCount`), 범위(`rangeMin`·`rangeMax`) (4장) |
| 하지 않는 것 | 규칙 여러 개, legend 값·점 크기 대상 (10장) |

### 툴팁 · 식 · 통계 함수

| | 내용 |
|---|---|
| 지금 있는 것 | 툴팁: 제목, 글자, 배경, 투명도, 모서리, 테두리, 앞뒤 글자, 소수 자리. 식: x·y. 통계 함수 6종 |
| 더하는 것 | 통계 함수 5종 (5.1) |
| 하지 않는 것 | 색을 식으로 정하기. 색은 legend 컬럼 값을 따른다 |

---

## 7. 호환

- 더하는 속성은 모두 선택 값이고 기본값이 지금 그림과 같다. 예전 history·공유 링크·hash 링크는 그대로 열리고 같은 PNG가 나온다.
- `GET /jobs/:jobId`의 `search`와 `matchedItems`는 더하기만 한다.
- `AggFn`·`PointShape`에 값이 늘어난다. 화면은 생성 타입의 union을 키로 한 Record를 쓰므로 이름표를 빠뜨리면 컴파일이 깨진다.
- OAS(`public/openapi/chart.json`, `data.json`)와 생성 타입을 다시 만든다 (`pnpm gen:api`, `gen:api:check`).

---

## 8. 작업 단위

PR 하나, 에이전트 여섯 덩어리. 0번이 계약(타입·기본값·검증)을 먼저 올려 `options.ts`·`schemas.ts`·`chart-defaults.ts`를 한 번만 고친다. 1~4는 그 위에서 함께 돌고, 5가 마무리한다.

| # | 덩어리 | 맡는 파일 | 의존 |
|---|---|---|---|
| 0 | 계약 | `server/render/options.ts`(3.1·4.1·5.2·5.3의 타입·기본값), `server/data/schema.ts`(`AGG_FNS`), `server/services/chart/schemas.ts`·`server/services/data` 스키마, `server/charts/chart-defaults.ts`, `src/entities/chart/model/chart-options.ts`, `pnpm gen:api` | — |
| 1 | 제목 검색 | `server/jobs/job-manager.ts`의 item 고르기, `server/services/chart/routes.ts`의 job 조회, `features/search-items`, `entities/workspace`, `widgets/tab-toolbar`, `widgets/chart-grid`의 페이지·빈 상태, `features/chart-actions`의 엑셀 | 0 |
| 2 | 순서 | `server/render/order.ts`, `legend.ts`, `category.ts`·`heatmap.ts`·`waterfall.ts`의 범주·legend 순서, `job-manager.ts`의 렌더 입력(legend 순서 전달), `features/chart-settings/ui/OrderField.tsx` | 0 |
| 3 | 강조 · 점 모양 | `server/render/analytics/focus.ts`, `scatter.ts`·`gantt.ts`·`candle.ts`와 `category.ts`의 focus 부분, 점 모양 그리기(`server/render/style.ts` 계열), legend 표시 DOM·툴팁 표시(`entities/chart/ui`) | 0 |
| 4 | 통계 함수 · 값 · 팔레트 · 부제목 | `server/data/category-data.ts`·`polar-data.ts` 등 집계 SQL, `server/render/analytics/outlier.ts`, palette 색 목록 적용, 부제목 그리기(`server/render/frame.ts` 계열), 왼쪽 패널 통계 함수 select | 0 |
| 5 | 설정 창 · 문서 | `features/chart-settings/model/option-fields.ts`(새 칸 전부, `order` 종류, focus 방식별 숨김), `option-fields.test.ts`, Lingui 카탈로그 3개 언어, 도움말, CHANGELOG, `prototype-spec.md` | 1~4 |

- `job-manager.ts`는 1(item 고르기)과 2(렌더 입력)가 함께 만진다. 함수가 달라 겹치지 않지만, 2가 1 뒤에 rebase한다.
- `category.ts`는 2(순서)와 3(focus)이 만진다. 3이 2 뒤에 들어간다.
- `option-fields.ts`는 5만 고친다. 1~4는 화면 필드 없이 서버 테스트로 끝낸다.

---

## 9. 완료 기준

- 루트에서 `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build`가 통과한다 (`build`가 번역 누락을 잡는다). `pnpm gen:api:check` 통과.
- 테스트
  - `job-manager`: 조건 넷의 일치, OR, 대소문자, 거른 순서의 `page`·`offset`, `matchedItems`, `items=`에는 미적용.
  - `order.test.ts`: 직접 순서 + 나머지 정렬, 자연 정렬(A1·A3·A12), 없는 값 건너뛰기. 렌더 테스트: legend 순서를 바꿔도 값의 색이 같다, waterfall 누적이 순서를 따른다.
  - `focus.test.ts`: 순위(위·아래, 동률), 범위(한쪽 열림, 양 끝 포함).
  - 집계: 새 통계 함수 5종의 값, 행 하나일 때 `stddev`.
  - 새 점 모양 5종이 PNG와 legend에 같은 모양으로 나온다.
  - 화면: `ItemSearch`(중복·한도·Enter), `OrderField`(끌기·키보드·비우기), `option-fields.test.ts`, 렌더 횟수 회귀(`ChartGrid.render.test.tsx`)에 검색 상태 추가.
  - 옵션을 하나도 정하지 않은 PNG가 바뀌지 않는다 (기존 렌더 테스트가 그대로 통과).
- 문구는 ko·en·ja 카탈로그에 모두 있다.
- 도움말(`apps/help/content/help/vis`의 `explore`·`customize`·`draw`·`chart-types`, 3개 언어)에 검색·순서·강조 방식·통계 함수를 더한다.
- `CHANGELOG.md`에 다음 버전 항목, `docs/prototype-spec.md`의 4.1(탭 도구 줄)·4.2(통계 함수)·4.7(legend 순서)·6.4(job 조회)를 고친다.
- dev 서버에서 직접 확인: 10만 행, split `lot_id`(약 5,000 item)로 검색·페이지·크게 보기, bar Stack에서 legend 순서, scatter 순위 강조.

---

## 10. 정해야 할 것

이 스펙은 아래처럼 정해 두었다. 다르게 가려면 구현 전에 바꾼다.

| # | 질문 | 이 스펙이 정한 것 |
|---|---|---|
| 1 | 검색 조건 여러 개의 결합 | OR (하나라도 맞으면 남긴다) |
| 2 | 검색 중 엑셀 내보내기 | 맞는 item만 담는다 |
| 3 | legend 순서가 색도 바꾸는지 | 바꾸지 않는다 (값 → 색 규칙 유지) |
| 4 | 강조 규칙 여러 개 | 이번에는 하나. 여러 개로 가면 `focus`가 배열이 되어 예전 history·공유를 옮겨 읽어야 한다 |
| 5 | 순위 강조의 기준 범위 | item 데이터 전체 (확대와 무관) |
| 6 | 범주 순서를 heatmap y·gantt 행에도 쓸지 | x축만 |
