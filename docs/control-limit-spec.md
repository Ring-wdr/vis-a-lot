# 관리선(Control Limit) 스펙

> 차트 위에 규격선·기준선·띠를 그리고, 규격을 벗어난 점을 강조한다.
> `docs/feature-expansion-plan.md`의 2단계(A1)다. PR 하나로 올린다.

지금 차트에는 데이터가 아닌 기준(규격 상·하한, 목표값, 평균 수준)을 그릴 방법이 없다. Focus는 조건에 맞는 점을 강조할 뿐 선을 그리지 않고, Score의 상·하한(`score.ucl`·`score.lcl`)은 숫자 계산에만 쓰인다. IoT 샘플에는 수준 상승 구간과 갑자기 튀는 값이 들어 있어, 규격선과 이탈 강조가 있으면 "어디서부터 규격을 벗어났는지"가 그림에서 바로 보인다. 제조 데이터를 올려 쓰는 경우에도 규격 관리가 가장 먼저 찾는 기능이다.

---

## 1. 지금과 더하는 것

| 항목 | 지금 | 더하는 것 |
|---|---|---|
| 기준 표시 | 없음. 막대가 시작하는 0 기준선만 그린다 | 기준선(고정 값), 컬럼 선(집계 값), 띠(두 컬럼 사이) |
| 규격 | Score 구역의 상·하한 숫자 (zscore·Cpk 계산용) | 선에 USL·LSL을 정하고, 벗어난 점·막대를 강조하고 수를 센다. Score가 이 값을 가져다 쓴다 |
| 강조 | Focus (조건 하나, x 또는 y) | 규격 이탈 강조. Focus와 함께 쓸 수 있다 |
| 설정 위치 | 차트 속성 14구역 (공통 + item 개별) | 15번째 구역 `controlLimit` |
| 축 범위 | 데이터 범위, 축 최소·최대, 확대, 예측 구간 | 관리선 값이 보이도록 넓히기 |

---

## 2. 범위

| 들어가는 것 | 빼는 것 |
|---|---|
| 기준선(고정 값), 컬럼 선(집계), 띠(두 컬럼 사이) | 이벤트선과 이벤트 데이터셋(기획서 D3) → 이번 순서에 없다 (2.1) |
| USL / LSL 지정, 규격 이탈 점·막대 강조, 이탈 수 표시 | 기준선 하나에 값 여러 개 (선 하나에 값 하나만 받는다) |
| 규격 영역 채우기(안쪽 / 바깥쪽), 색·투명도 | 오른쪽·위쪽 축 (보조 축이 없다) |
| 구간별 규격 (x 구간마다 값이 다른 계단선·계단 띠) | 규격 이탈 행만 보는 데이터 테이블·다운로드 |
| 선 색·굵기·모양, 이름 글자 | 관리선을 끌어서 옮기기 |
| 공통 속성 + item 개별 속성 | scatter·line·bar 밖의 차트 (3.1) |
| 화면 툴팁에 선 이름·값 | |
| Score(zscore·Cpk)의 상·하한을 USL·LSL에서 가져오기 | |

### 2.1 이벤트선은 넣지 않는다

이벤트선은 "언제 무슨 일이 있었는지"를 다른 데이터(이벤트 목록)에서 읽어 세로선으로 그리는 기능이다. 차트 데이터와 다른 테이블이 필요하다.

| 방법 | 필요한 일 | 판단 |
|---|---|---|
| 등록된 다른 데이터셋을 이벤트 데이터로 고른다 | `ChartSpec`에 두 번째 데이터셋 id. chart 서비스의 데이터 확인(`dataService.schema`)·캐시(`loadChartData`)가 데이터셋 하나를 전제로 한다. history 복원의 '지운 업로드 데이터' 실패 사유, 공유 링크(업로드 데이터는 같은 브라우저만)가 데이터셋 둘로 늘어난다. IoT 샘플에는 이벤트 테이블이 없어 사용자가 이벤트 CSV를 따로 올려야만 쓸 수 있다 | 이번에 하지 않는다 |
| 이번 순서에서 뺀다 | 없음. 선 종류에 `event`를 나중에 더할 수 있게 `kind` union으로 둔다 | **채택** |

근거: 샘플 데이터는 현상 유지라 이벤트 테이블을 만들지 않는다. 임베드 스펙(4단계)도 데이터셋 하나만 받는다. IoT 샘플의 이상 구간은 `status` legend와 규격 이탈 강조로 이미 보인다. 시각 하나를 표시하는 일은 Bottom 축 기준선(ISO 시각)으로 된다.

---

## 3. 동작

### 3.1 지원 차트

| 차트 | 선 종류 | 축 | 메모 |
|---|---|---|---|
| scatter | 기준선, 컬럼 선, 띠 | Left(y), Bottom(x) | Bottom은 x가 숫자일 때 기준선·컬럼 선·띠, 시계열이면 기준선만(값은 ISO 시각) |
| line | 같음 | 같음 | 분포 서브 차트(ECDF·NCDF·Probability)는 좌표가 컬럼 값이 아니라 **구역을 끈다**. 저장한 선은 남지만 검사하지도 그리지도 않는다 |
| bar (Side) | 기준선, 컬럼 선 | Left | 컬럼 선은 그 item 행 전체의 집계 한 줄 |
| bar (Stack, Stack 100) | 기준선 | Left | 쌓은 합·비율에 컬럼 집계는 뜻이 없다 |

규칙은 `controlLimitSupport(spec, xType)`(서버 `server/charts/chart-options.ts`, 화면 사본 `src/entities/chart/model/chart-options.ts`)가 축별 선 종류와 구간별 여부로 돌려준다. 그 밖의 차트는 쓰지 않는다. 구역이 없고 도구 줄 버튼은 비활성(title로 이유)이다. 이탈을 판정할 단위(점 하나, 막대 하나)와 값 축이 분명한 차트로 좁혔다. boxplot은 상자 하나가 분포라 '벗어난 것'의 단위가 없고, histogram·waterfall·candle은 값 축이 개수·누적·구간 값이라 컬럼 집계와 맞지 않는다. pie·radar·sankey 등은 직교 축이 없다. 고칠 렌더러도 `scatter.ts`(scatter·line)와 `category.ts`의 막대 경로 둘로 묶인다.

### 3.2 선 종류

선마다 이름(필수, item 안에서 중복 금지), 축, 색, 굵기, 모양(실선·파선·점선)을 갖는다.

| 종류 | 입력 | 값 | 그림 |
|---|---|---|---|
| 기준선 `reference` | 고정 값 | 입력한 값 | 축에 수직인 선 하나 |
| 컬럼 선 `column` | 숫자 컬럼, 함수(평균·최대·중앙값·최소) | item 행(3.4)에서 집계한 값 | 선 하나. 구간별이면 계단선 |
| 띠 `band` | 숫자 컬럼 둘 | 두 컬럼을 각각 평균한 값 | 선 둘과 그 사이 채움. 구간별이면 계단 띠 |

- **USL / LSL**: 기준선과 컬럼 선에 종류(없음·USL·LSL)를 정한다. IoT 샘플에는 규격 컬럼이 없으므로 고정 값(기준선)으로도 규격을 정할 수 있어야 한다. 띠는 종류를 고르지 않는다. USL·LSL은 축마다 하나씩만 정한다 (영역 채우기와 Score 상·하한이 한 쌍을 기준으로 한다).
- 선은 목록에 10개까지, 이름은 40자까지. 띠의 두 컬럼은 서로 달라야 한다.
- **구간별**: 컬럼 값이 x를 따라 달라지는 규격이다(예: 기간마다 다른 상한). Left 축 선에서만 쓴다. x 전체 범위를 240구간으로 나눠 구간마다 집계하고, 값이 있는 구간을 계단선으로 잇는다. 구간은 전체 범위로 한 번 정하므로 확대해도 다시 조회하지 않는다. bar에서는 쓰지 않는다.
- 값이 없으면(행이 없음, 전부 null) 그 선은 그리지 않는다.

### 3.3 규격 이탈과 영역

USL·LSL로 정한 선이 하나라도 있으면 동작한다.

| 설정 | 기본 | 동작 |
|---|---|---|
| 규격 이탈 강조 | 켬 | Left 축이면 y, Bottom 축이면 x가 USL보다 크거나 LSL보다 작은 점(막대)을 이탈 색으로 맨 위에 다시 그린다. 구간별 규격이면 그 점이 든 구간의 값과 비교한다 |
| 이탈 색 | `#e03131` | 사용자가 정한 색이라 테마와 상관없다 |
| 영역 채우기 | 끔 | In: USL과 LSL 사이를 채운다(하나뿐이면 선에서 그림 영역 끝까지 규격 안쪽). Out: 그 반대쪽 |
| 영역 색·투명도 | `#2f9e44`, 0.8 | 투명도 0~1 (0이 불투명, 1이 완전 투명). 다른 구역의 투명도(`shape.transparency` 등)와 같은 범위 |
| 이름 글자 | 켬 | 선 끝(Left 축은 오른쪽 끝 위, Bottom 축은 위쪽 끝 옆)에 `이름 값`. 글자 크기(기본 10)·색을 정한다. 색을 비우면 눈금 글자 색 |
| 축 범위에 포함 | 켬 | 확대하지 않았을 때 선 값이 보이도록 축 범위를 넓힌다 (예측의 `extendDomain`과 같은 방식). 끄면 데이터 범위만 쓰고 밖의 선은 잘린다 |

- 이탈 수는 그린 점 기준(끈 legend 값·지운 점 제외)으로 세어 PNG 제목 줄 요약에 `이탈 N`으로 더하고 metadata에 담는다.
- Focus와 함께 켜면 이탈 점을 먼저, Focus 점을 그 위에 그린다.
- 그리는 순서: 영역 채움 → 격자 → 점·선·막대 → 선택 밖 흐리게 → 관리선 → 이탈 점 → 이름 글자. 관리선은 선택 밖 흐리게에 덮이지 않는다.
- 섬네일에는 영역과 선만 그리고 글자는 뺀다.
- line은 M4로 줄인 선과 별개로 이탈 판정을 원자료 점으로 한다. 이탈 점은 점으로 찍는다.

### 3.4 집계 범위

컬럼 선·띠의 값은 **split 조합 + draw 시점 필터**(`spec.filters`)의 행으로 집계한다. legend 체크박스로 끈 값과 지운 점은 빼지 않는다. 체크박스를 누를 때마다 규격선이 움직이면 안 되기 때문이다.

### 3.5 공통 속성과 item 개별 속성

- 관리선은 차트 속성의 15번째 구역 `controlLimit`이다. 합치는 순서는 다른 구역과 같다(전체 → 테마 → 차트 종류 → 공통 → item).
- 선 목록은 배열이라 `mergeOptions`가 통째로 바꾼다. item에 목록을 정하면 공통 목록 대신 그 목록을 쓴다. split 조합마다 규격이 다른 경우를 item 개별 속성으로 푼다.
- 공통은 다른 구역처럼 확인 후 다음 draw에 적용하고, item은 확인하면 그 item만 다시 그린다. '공통 속성 따르기'로 되돌린다.

### 3.6 Score 연결

`score.ucl`·`score.lcl`이 비어 있으면(null) 구간별이 아닌 Left 축 USL·LSL 값을 zscore·Cpk의 상·하한으로 쓴다. 직접 적은 값이 우선이다.

---

## 4. 모델

저장할 곳은 둘이다. 차트 속성 구역으로 둔다.

| | 차트 속성 구역 (채택) | 별도 필드 `spec.controlLimit` |
|---|---|---|
| 공통 → item 합치기 | `resolveOptions` 그대로 | 새로 만든다 |
| 지원 차트 거르기 | `OPTION_SUPPORT`·`pickSupported` 그대로 | 새로 만든다 |
| history·공유 복원 | `ItemRestore.options`, history 이벤트 `options` 그대로 | 필드·이벤트 추가 |
| 기본값 | `GET /defaults`에 함께 나간다 | 따로 내보낸다 |
| 걸리는 것 | 설정 창의 필드 표가 목록을 모른다. 컬럼 검증이 속성 안으로 들어온다 | 없음 |

```ts
// server/render/options.ts
type LimitLine = {
  name: string;               // 40자까지, 목록 안에서 겹치지 않는다
  axis: "left" | "bottom";
  color: string;              // hex
  width: number;              // 0.5~10
  style: "solid" | "dash" | "dot";
} & (
  | { kind: "reference"; value: number | string; type: LimitType }   // string은 시계열 x의 ISO 시각
  | { kind: "column"; column: string; fn: "avg" | "max" | "median" | "min"; type: LimitType; multi: boolean }
  | { kind: "band"; column: string; column2: string; multi: boolean }
);
type LimitType = "none" | "usl" | "lsl";

type ControlLimitOptions = {
  lines: LimitLine[];                       // 기본 [], 10개까지
  highlightOut: boolean;                    // true
  outColor: string;                         // "#e03131"
  area: { visible: boolean; color: string; transparency: number; side: "in" | "out" };  // false, "#2f9e44", 0.8, "in"
  text: { visible: boolean; fontSize: number; color: string };   // true, 10, "" (눈금 글자 색)
  fitAxis: boolean;                         // true
};
```

- 기본값은 선이 없어 지금 PNG와 같다. 색은 사용자가 정하는 데이터 색이라 `DARK_OPTIONS`에 넣지 않는다. 글자 색만 빈 값으로 테마를 따른다.
- 임베드(4단계)의 draw payload는 이 구역 타입을 그대로 받는다.

---

## 5. 서버

### 5.1 검증

- `server/charts/validate-spec.ts`의 `controlLimitError`: 선이 쓰는 컬럼이 스키마에 있고 숫자형인지, 이름이 비었거나 겹치는지, 띠의 두 컬럼이 다 있고 서로 다른지, 축·종류·구간별이 차트와 맞는지(3.1), 기준선 값이 축에 맞는지(시계열 Bottom은 ISO 시각, 그 밖은 숫자), 축마다 USL·LSL이 하나씩인지 본다. 맞지 않으면 다른 설정처럼 사유를 알려 준다. 구역을 끈 차트(3.1)에서는 보지 않는다.
- 공통 속성은 draw(`specError`)에서 job 실패 사유로, 공통 속성 변경(`PATCH …/common`)에서 400으로 거절한다. item 속성(`PATCH …/props`)도 같은 검사를 하고 400으로 거절한다. 둘 다 draw 때 받은 스키마(`chart.columns`)로 본다.
- 컬럼 이름은 다른 SQL처럼 스키마로 확인하고 인용한다.

### 5.2 계산

- 새 DB op `limitValues` (`server/data/limit-data.ts`): `{ dataset, splitBy, filters, x, lines: [{ column, fn, multi }] }` → split 조합별 값. 한 번의 `group by`로 요청한 (컬럼, 함수) 전부를 집계한다. 중앙값은 `percentile_cont(0.5)`. 구간별은 `width_bucket(x, min, max, 240)`을 더해 구간별 값을 준다.
- 값은 차트 데이터 캐시 옆에 (컬럼, 함수, 구간별) 키로 보관한다. draw에서는 공통 속성과 복원할 item 속성에 쓰인 것을 모아 한 번 조회하고, item 속성 변경으로 새 조합이 생기면 그때 조회한다. 캐시에서 밀려나면 차트 데이터처럼 다시 조회한다.
- 기준선은 조회하지 않는다.

### 5.3 그리기

- job-manager가 item마다 `options.controlLimit.lines`를 값이 든 `ResolvedLimit[]`로 바꿔 렌더 입력(`ScatterInput.limits`, `CategoryInput.limits`)에 싣는다. Render Worker는 DB를 모른다.
- `ResolvedLimit`(`server/render/control-limit.ts`)은 값이 모두 그 축의 데이터 값(시계열 x는 epoch ms, 기준선 ISO 시각도 바꿔 싣는다)인 선이다. 구간별이 아니면 `{ multi: false, value, value2? }`, 구간별이면 `{ multi: true, steps }`. 값을 구하지 못한 선은 job이 빼고, 구역을 끈 차트(3.1)면 `limits`를 싣지 않는다. 영역·이탈 강조·글자·축 범위 설정은 렌더 입력의 `options.controlLimit`에서 읽는다.
- 새 모듈 `server/render/control-limit.ts`: 축 범위 넓히기, 영역 채움, 선(계단선 포함), 이름 글자, 이탈 판정 함수. `scatter.ts`와 `category.ts`가 3.3의 순서대로 부른다.
- 로그 축에서 0 이하 값의 선은 그리지 않는다.

### 5.4 metadata와 툴팁

```ts
// ScatterMeta, CategoryMeta
limits?: {
  lines: { name: string; axis: "left" | "bottom"; type: LimitType; value?: number; value2?: number; steps?: LimitStep[] }[];
  out: number;
};
// LimitStep = [x0, x1, v] | [x0, x1, v, v2] (띠만 v2). 타입은 server/render/control-limit.ts (LimitsMeta)
```

- 화면 툴팁은 커서가 선에서 4px 안이면 서버 호출 없이 `이름: 값`을 한 줄 더한다. 구간별 선은 커서 x가 든 구간의 값이다.
- 점 툴팁에는 그 점이 이탈이면 '규격 이탈'을 적는다 (metadata의 선 값으로 화면이 판정).

### 5.5 API

| 바뀌는 것 | 내용 |
|---|---|
| `ChartOptionsSchema` | `controlLimit` 구역 추가. `CommonProps.options`, `ItemRestore.options`, `ItemState.options`, `ItemPropsRequest`가 함께 넓어진다 |
| `GET /defaults` | `options.controlLimit` 기본값 |
| `ScatterMeta`, `CategoryMeta` | `limits` (선택, 컴포넌트 `LimitsMeta`). 선 목록 컴포넌트는 `LimitLine`·`LimitAxis`·`LimitType`, 구역은 `ControlLimitOptions` |
| 호환 | 더하기만 한다. 예전 history·공유 링크에는 구역이 없어 기본값(선 없음)으로 열린다 |

`pnpm gen:api`로 `public/openapi/chart.json`과 생성 타입을 다시 만든다.

---

## 6. 화면

- **설정 창**: 전체 설정과 item 속성 팝업에 '관리선' 메뉴를 더한다. 위에 전체 설정(이탈 강조·색, 영역, 글자, 축 범위에 포함), 아래에 선 목록 표. 종류(컬럼 선·띠·기준선)를 고르고 `+`로 행을 더하며, 종류에 없는 칸은 `-`로 비운다. 컬럼 select는 숫자 컬럼만 보인다. 폼은 react-hook-form `useFieldArray`.
- 설정 창의 필드 표(`option-fields.ts`)는 낱개 필드만 안다. 관리선의 낱개 필드는 표에 넣고, 선 목록은 전용 컴포넌트가 그린다. `option-fields.test.ts`의 '서버 기본값의 모든 칸이 설정 창에 있다' 검사에는 전용 컴포넌트가 맡는 경로(`controlLimit.lines`)를 따로 적는다.
- **도구 줄**: 차트 도구에 '관리선' 버튼. 전체 설정 팝업을 관리선 메뉴로 연다. 그린 차트가 지원하지 않으면(3.1) 비활성하고 title로 이유를 알린다. history 탭에서는 보기 전용으로 연다.
- **데이터셋 변경**: 다른 데이터셋으로 바꾸면 스키마에 없는 컬럼을 쓰는 선을 지운다 (x·y·legend를 바로잡는 곳과 같은 규칙).
- 문구는 ko·en·ja 카탈로그에 넣는다. 선 이름은 사용자가 적은 그대로 PNG에 그린다.

### 화면 위치

| 내용 | 위치 (`apps/web`) |
|---|---|
| 관리선 설정 폼, 선 목록 표 | `src/features/chart-settings/ui/ControlLimitSettings.tsx`, `model/control-limit-form.ts` |
| 낱개 필드·구역 라벨 | `src/features/chart-settings/model/option-fields.ts` |
| 구역·지원 표 화면 사본 | `src/entities/chart/model/chart-options.ts` |
| 도구 줄 버튼 | `src/features/chart-actions/ui/ChartActionBar.tsx` |
| 툴팁 한 줄 | `src/features/item-tooltip/lib` |
| 서버 | `server/render/control-limit.ts`, `server/data/limit-data.ts`, `server/charts/*`, `server/jobs/job-manager.ts`, `server/services/chart/schemas.ts` |

새 slice는 만들지 않는다. 설정은 `chart-settings`, 버튼은 `chart-actions`가 이미 맡는 동작이다.

---

## 7. PR 안의 작업 단위

브랜치 `feat/control-limit` → develop. 단위 1이 끝난 뒤 2·3·4를 함께 진행한다.

| # | 단위 | 건드리는 파일 | 의존 |
|---|---|---|---|
| 1 | **모델·API·검증** | `server/render/options.ts`(타입·기본값), `server/charts/chart-options.ts`·`validate-spec.ts`·`item-props.ts`와 테스트, `server/services/chart/schemas.ts`, `server/api/types.ts`, `public/openapi/chart.json`·생성 타입, `src/entities/chart/model/chart-options.ts`, `server/render/control-limit.ts`에 `ResolvedLimit`·metadata 타입만 | 없음 |
| 2 | **집계와 job 연결** | `server/data/limit-data.ts`(+테스트), `server/protocol.ts`, `server/workers/db.worker.ts`, `server/charts/chart-store.ts`(캐시), `server/jobs/job-manager.ts`(조회·렌더 입력) | 1 |
| 3 | **렌더** | `server/render/control-limit.ts`(구현·테스트), `server/render/scatter.ts`·`category.ts`(호출, 축 범위, 이탈 점, 요약, metadata, Score 상·하한), 렌더 테스트 | 1 |
| 4 | **화면** | `src/features/chart-settings/**`, `src/features/chart-actions/ui/ChartActionBar.tsx`, `src/features/item-tooltip/lib/**`, 데이터셋 변경 바로잡기, 세 언어 카탈로그 | 1 |
| 5 | **문서·마무리** | `apps/help/content/help/vis/customize*.mdx`(3개 언어), `CHANGELOG.md`, `docs/prototype-spec.md`(차트별 표·4.8·6.4), 전체 검사 | 2·3·4 |

- 2와 3은 `ResolvedLimit` 타입(단위 1)으로만 만난다. `job-manager.ts`는 2만, `scatter.ts`·`category.ts`는 3만 고친다.
- 카탈로그(`.po`)는 4만 고친다. 5의 도움말은 help 앱 파일이라 겹치지 않는다.

---

## 8. 완료 기준

- 렌더 테스트: 기준선·컬럼 선·띠·구간별 계단선의 픽셀 위치, 영역 In·Out, 이탈 수, 축 범위 넓히기, 로그 축, 섬네일, 선 없는 기본값이 예전 PNG와 같음.
- 집계 테스트: split 조합별 값, 필터 적용, 중앙값, 구간별, 빈 조합.
- 검증 테스트: 없는 컬럼·범주 컬럼·이름 중복·차트와 맞지 않는 축 거절, 지원하지 않는 차트에서는 구역을 저장하지 않음.
- 화면 테스트: 폼 ↔ patch 변환, 종류별 칸 보이기, 데이터셋 변경 시 선 정리, 필드 표 검사 통과.
- IoT 10만 행에서 확인: scatter(측정 시각 × 측정값, split 센서 종류)에 USL·LSL 기준선 + 평균 컬럼 선 + 영역, item 하나만 다른 규격, history 다시 보기, 공유 링크로 열기, 다크 모드, 크게 보기.
- 루트에서 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm gen:api:check` 통과. `build`가 번역 누락을 잡으므로 ko·en·ja를 모두 채운다.
- 도움말 '꾸미기'에 관리선 절, CHANGELOG에 항목.

---

## 9. 정한 것

단위 1에서 아래 기본대로 정했다.

1. **이벤트선**: 넣지 않는다(2.1).
2. **기준선의 USL·LSL**: 고정 값 기준선에도 USL·LSL을 둔다.
3. **구간별 규격**: 넣는다(3.2). `multi`와 240구간 집계를 둔다.
4. **집계 범위**: 끈 legend 값·지운 점을 집계에서 빼지 않는다(3.4).
5. **도구 줄 버튼**: 둔다(6장).
6. **지원 차트**: scatter·line·bar만(3.1). boxplot·histogram은 넣지 않는다.
