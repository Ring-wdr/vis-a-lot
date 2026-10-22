# vis-a-lot 프로토타입 기획서

> 서버사이드에서 그린 PNG 차트를 브라우저에 띄우는 B2B 시각화 솔루션의 포트폴리오/기술검증용 프로토타입.
> 원본(Spring 서버 + 사내 렌더링 툴)의 동작을 재현하되, 서버 유지비 없이 브라우저 안에서 "서버"를 돌린다.

---

## 1. 목표와 전제

| 항목 | 내용 |
|---|---|
| 목적 | 포트폴리오 / 기술 검증. 서버사이드 렌더링, 대용량 데이터 처리 구조, B2B 제품 흐름을 고르게 보여준다 |
| 비용 | 유지비 0원. 정적 호스팅만 사용 |
| 규모 | 실제 행만 정직하게 보여준다. 행 수(10만 / 50만 / 100만)를 바꿔 규모별 성능 차이를 보여준다. CSV를 올려 자기 데이터로도 그릴 수 있다 |
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
| mocking server | MSW, REST | 화면에서는 실서버에 `fetch`하는 것과 똑같다. MSW는 gateway에 요청을 넘기고, 서비스는 Hono 앱이다 (6장) |
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

### 3.3 스키마 기반 컬럼
- 공장마다 raw data의 컬럼 이름이 제각각이므로, 컬럼 이름과 타입을 코드에 정해 두지 않는다. 적재된 테이블의 스키마(information_schema)에서 읽는다.
- DB 타입으로 논리 타입을 정한다: 숫자형(smallint, integer, bigint, numeric, real, double precision) → `numeric`, 시각형(timestamp, timestamptz, date) → `datetime`, 그 밖(text, boolean, uuid …) → `categorical`.
- 화면 라벨은 컬럼 주석(comment)을 쓰고, 없으면 컬럼 이름을 그대로 쓴다. IoT 생성기는 테이블을 만들 때 라벨을 주석으로 남긴다.
- 컬럼의 쓰임은 타입으로 정한다.
  - scatter x: datetime·numeric, y: numeric
  - bar/boxplot x: categorical, y: numeric
  - legend: categorical이면서 고유값 8개 이하 (팔레트 8색)
  - split by·tooltip: 모든 컬럼
  - 필터: datetime·numeric은 범위, categorical은 값 목록
- 스키마는 적재를 시작하면(테이블 생성 직후) 알 수 있고, 고유값 수는 적재가 끝나야 알 수 있다. 등록하지 않은 데이터셋은 스키마가 없어 컬럼을 고를 수 없다.
- 서버는 SQL에 컬럼 이름을 넣을 때 항상 스키마로 확인하고 식별자를 인용한다(공백·한글·특수문자 이름도 안전). job은 데이터가 준비된 뒤 스키마로 차트 설정을 검증하고, 맞지 않으면 사유를 알려 준다.
- 다른 데이터셋으로 바꾸면 화면이 스키마에 맞지 않는 설정(x, y, legend, split, tooltip, 필터)을 타입에 맞는 기본값으로 바로잡는다.

### 3.4 데이터셋 (샘플과 업로드)
- 데이터셋은 id로 구분한다. 샘플은 행 수별로 `iot-100k` / `iot-500k` / `iot-1m`, 업로드한 데이터는 `up-…`. 차트 설정·history·공유 링크는 이 id를 저장한다(예전 `rows` 기록은 샘플 id로 옮긴다).
- 샘플(10만 / 50만 / 100만)은 상단 `datastore` 팝업 목록 맨 아래에 있고, `등록`을 눌러야 쓸 수 있다(서버가 시드로 생성). 한 번 만든 데이터는 IndexedDB에 남는다.
- 왼쪽 패널의 데이터 select에서는 등록한 데이터(샘플·업로드)만 고를 수 있다.
- history에는 어느 데이터였는지 함께 저장한다. 불러올 때 샘플이 없으면 생성하고, 지운 업로드 데이터면 사유와 함께 실패한다.

### 3.5 업로드와 데이터스토어
- 상단 바의 진입점을 둘로 나눈다. `upload`는 파일을 올려 적재하는 팝업, `datastore`는 등록된 데이터 목록 팝업이다. 업로드가 끝나면 그 데이터를 고른 채로 데이터스토어 팝업으로 바로 넘어간다.
- **업로드(파일 열기) 팝업:** 위에 `파일 선택`·`검사` 버튼. 왼쪽 파일 목록(zip이면 안의 CSV들), 가운데 원본 앞부분, 오른쪽 전처리 옵션, 아래 미리보기 표.
  - 파일은 먼저 서버에 올려 둔다(staging). 옵션을 바꾸면 300ms 뒤 앞부분(1MB, 100행)만 다시 읽어 미리보기를 갱신한다.
  - 미리보기 표 머리 첫 줄은 컬럼 포함 체크(전체 체크 포함), 둘째 줄은 타입(`자동 (추론)` / 범주 / 숫자 / 시계열). 표의 값은 정한 타입으로 바꾼 값이고, 바꿀 수 없는 칸은 원래 값을 빨갛게 표시한다.
  - `검사`는 적재하지 않고 파일 전체를 읽어 행 수와 컬럼별 변환 불가 값 수를 알려 준다. 검사한 옵션 그대로면 표의 `자동`도 전체 기준 추론으로 바뀐다.
  - `확인`을 누르면 적재한다. 검사·변환(글자 수) → 대기 → 적재(행 수) → 컬럼 통계 진행을 long polling으로 받아 아래 줄에 보여준다. 거절되면 사유를 보여주고 옵션을 고쳐 다시 확인할 수 있다.
- **데이터스토어 팝업:** 이름 검색, `수정`·`삭제`·`새로고침` 아이콘, 가상 스크롤 표(번호, 이름, 등록 시간, 행 수, 크기, 상태), 아래에 브라우저 저장소 사용량과 데이터 수. 업로드 데이터가 위(최근 순), 샘플이 맨 아래다. 고르고 `gallery에서 열기`(또는 더블 클릭)로 새 탭을 연다. 샘플은 수정·삭제할 수 없다.
- `수정`은 같은 업로드 팝업을 수정 모드로 연다. 보관해 둔 원본을 다시 올려 두고, 저장한 이름·옵션·타입·포함 컬럼을 채워 보여준다. `다시 적재`하면 그 데이터셋을 다시 만들고(등록 시간 유지), 거절되면 기존 데이터를 그대로 둔다. 수정에서는 원본 파일을 바꿀 수 없다.
- CSV 파일 하나 또는 CSV를 묶은 zip을 올린다. zip 안의 CSV(폴더 포함, 이름순)는 **한 데이터셋으로 합친다**. CSV가 아닌 파일과 macOS 메타 파일은 건너뛴다.
- zip 안 CSV의 스키마(컬럼 수, 이름, 값으로 추론한 타입)가 하나라도 다르면 **전체를 거절**하고 아무것도 남기지 않는다. 사유(어느 파일의 어느 컬럼이 어떻게 다른지)를 업로드 팝업에 보여준다.
- 전처리 옵션: 구분 기호(쉼표·탭·세미콜론·세로 막대·직접 입력 한 글자), 첫 번째 행 헤더(아니면 `column_1…`), Null 값(이 값과 같은 필드를 null로, 기본은 빈 값), 따옴표(한 글자, 기본 `"`), 날짜 시간 형식, 데이터 오류 무시, 인코딩(자동: UTF-8, 깨지면 EUC-KR / UTF-8 / EUC-KR). BOM은 뗀다.
- 날짜 시간 형식: `자동 (ISO 8601)` 또는 `yyyy-MM-dd HH:mm:ss.SSS` 같은 패턴(yyyy yy MM M dd d HH H mm m ss s SSS, 목록에서 고르거나 직접 입력). 패턴으로 읽히는 컬럼을 시계열로 보고, 적재할 때 ISO로 바꾼다. 달력에 없는 날짜는 읽지 못한 값이다.
- 타입은 값으로 추론한다: 모두 숫자면 숫자, 모두 날짜 시간 형식으로 읽히면 시계열, 아니면 범주. 컬럼별로 직접 정할 수 있다(타입 변환).
- 데이터 오류 무시를 끄면 정한 타입으로 읽히지 않는 값이나 필드 수가 맞지 않는 행이 있을 때 사유(파일, 행, 값)와 함께 거절한다. 켜면 그런 값은 null로 넣고 그런 행은 건너뛴다.
- 포함하지 않은 컬럼은 테이블에 만들지 않는다. 하나도 남지 않으면 거절한다.
- 적재 중에는 수정·삭제할 수 없다.
- 파싱은 서버(DB Worker)의 papaparse 하나로 하고, Postgres에는 정규화한 CSV 조각(값마다 따옴표, null은 빈 필드)을 COPY로 넣는다. 구분 기호·따옴표·줄바꿈·빈 줄을 두 파서가 다르게 해석할 여지를 없앤다.
- 원본 파일은 IndexedDB(idb-keyval)에 따로 보관한다. 업로드 데이터는 그 브라우저에만 있으므로 공유 링크도 같은 브라우저에서만 열린다.
- zip·CSV 라이브러리(fflate, papaparse)는 DB Worker가 업로드를 받을 때, 업로드 팝업은 처음 열 때 동적으로 불러온다.
- 검사·변환은 두 번 읽는다(추론, 변환). DB Worker 한 스레드에서 돌므로 2만 행마다 이벤트 루프에 양보해 진행률 조회(long polling)에 답한다.
- 한도: 압축 해제 후 300MB, CSV 500개, 컬럼 200개.
- 컬럼은 스키마에서 고르므로 draw하려면 데이터를 등록해야 한다. 적재 중에 draw하면 job은 `init` 상태(spinner만 표시)로 기다리고, 적재가 끝난 뒤부터 `progress`로 넘어간다.

---

## 4. 화면

### 4.1 레이아웃

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [data] [gallery] [history]                                        사용자 │
├──────────────────────────────────────────────────────────────────────────┤
│ [Scatter · 측정 시각 × 측정값 ×] [새 차트 · IoT 10만 행 ×] [+]   [필터 2] │ ← 탭
├──────────────────────────────────────────────────────────────────────────┤
│ [↖][✥][🔍][⬚][➰][⬚x][➰x][🖌] │ [☑][🖼][📊][⬇][▦] ← 모드 바 │ 차트 도구 [링크 복사] │ ← 탭 도구 줄
├──────────────────┬──────────────────────────────────┬─┬─────────────────┤
│ 데이터    [▼]     │  ┌────────┐ ┌────────┐ ┌────────┐ │▮│ 필터            │
│ 차트 종류 (아이콘)  │  │toolbar │ │toolbar │ │toolbar │ │ │ ▸ 측정 시각      │
│ grid [▦ 3 × 3]   │  │  PNG   │ │  PNG   │ │  PNG   │ │ │ ▾ 공장   ●       │
│ x / y / legend   │  └────────┘ └────────┘ └────────┘ │ │   [검색]         │
│ 통계 함수 (bar)    │                                  │ │   ☐ 구미 ☑ 울산  │
│ split by [다중]   │                       페이지 스크롤바 │ │ ▾ 측정값  ●      │
│ tooltip  [다중]   │                                  │ │   ●━━━━━━●       │
│ [전체 설정]        │ ◌ 렌더링 중 ▬▬▬ 531/2,500 · ✓ ◐ … · 2.0초 · 704 item/s │
│ [draw]           │                                    ‹ 1 / 278 ›        │
└──────────────────┴──────────────────────────────────┴─┴─────────────────┘
```

- **상단 바:** `upload`(파일 열기 팝업), `datastore`(데이터 목록 팝업), `gallery`(그리고 편집하는 화면), `history`(그린 차트를 다시 보는 화면), 사용자. 앱 전체에 걸린 것만 둔다
- **탭 도구 줄:** 탭 바 아래, 탭 내용과 같은 배경. 모드 바와 링크 복사처럼 그 탭의 차트에 걸린 도구를 둔다
- **탭:** gallery와 history 모두 탭이 있다. 탭마다 작업 상태(데이터·설정·차트·진행)를 따로 가져 오가도 그대로 남는다.
  - gallery 탭은 작업 공간이다. `+`로 새 탭, datastore 팝업에서 준비된 데이터를 선택하고 `gallery에서 열기`를 누르면 그 데이터로 새 탭이 열린다. 마지막 하나는 닫을 수 없다.
  - history는 목록에서 고른 건마다 탭으로 열고(이미 열린 건이면 그 탭으로), `gallery에서 편집`은 새 gallery 탭으로 가져간다.
- **모드 바:** 기본 / 이동 / 확대 / 사각형 선택 / 자유형 선택 / 사각형 삭제 / 자유형 삭제 / 페인트. 아이콘으로 표시하고 이름은 title로 보여준다. 기본 외의 모드는 그린 차트가 없거나 다시 보기 전용(history)이면 disabled이고 흐리게 보인다
- **차트 도구:** 모드 바 오른쪽에 구분선을 두고 누르면 바로 동작하는 버튼을 둔다. 체크박스 표시(토글), 차트 다운로드, 모든 차트 엑셀로 다운로드, 데이터 다운로드, 데이터 테이블
- **고른 item:** item을 누르거나 item 안에 포커스가 들어오면 그 item을 고른 것으로 보고 테두리를 강조한다. 차트·데이터 다운로드와 데이터 테이블처럼 item 하나를 대상으로 하는 도구가 이 item을 쓰고, 고르기 전에는 막혀 있다. 새로 draw하면 풀린다
- **페인트 도구:** 페인트 모드일 때만 item 좌측 상단에 우측 툴바와 같은 모양으로 띄운다. 사각형 / 선 / 자유곡선 / 텍스트 중 고르고(탭 안 모든 item이 같은 도구), 도형 undo와 전체 삭제도 여기에 둔다
- **왼쪽 패널:** 데이터, 차트 종류, grid 크기, x, y, legend, 통계 함수(bar일 때만), split by, tooltip. `전체 설정`과 draw 버튼은 패널 하단에 고정되어 설정을 스크롤해도 보인다
- **전체 설정 팝업:** 자주 바꾸지 않는 설정을 모은다. 왼쪽 메뉴로 고른다: 색상(공통 색 또는 legend 값별 색), legend(위치), split by(구분 기호), 툴팁(가까운 점 표시)
- **선택 필드:** 단일 선택(데이터, x, y, legend, 통계 함수)과 다중 선택(split by, tooltip)은 같은 트리거·팝업 모양을 쓴다(Base UI Select / Combobox). 높이를 아끼려고 다중 선택은 고른 값을 한 줄에 순서대로 쉼표로 이어 쓰고 넘치면 말줄임, 오른쪽에 개수를 보여준다.
- **split by / tooltip:** 순서 다중 선택(OrderedSelect, Base UI Combobox + 가상 스크롤). 항목을 누른 채 끌면 지나간 순서대로 선택된다. 라이브러리 선정과 드래그 규칙은 [select-library-comparison.md](select-library-comparison.md)
- **grid 크기:** Excel의 표 삽입처럼 10 x 10 칸 popover에서 행 × 열을 고른다 (1..10 × 1..10, 직사각형 가능)
- **페이지 이동:** grid 오른쪽 Windows 방식 페이지 스크롤바(위·아래 화살표, 트랙, thumb). 네이티브 스크롤을 쓰지 않고 직접 그리며, thumb 한 칸이 한 페이지다. 화살표는 한 페이지(누르고 있으면 계속), 트랙은 누른 쪽으로 thumb이 포인터에 닿을 때까지, thumb은 끌어서 이동한다. 휠은 굴린 양을 모아 일정량마다 한 페이지, 키보드는 ↑↓·PageUp/PageDown·Home/End. 보이는 페이지는 즉시 바꾸고 서버 조회 페이지는 throttle(200ms)로만 바꿔, 한 번에 많이 넘겨도 조회가 몇 번만 일어난다.
- **하단 바:** job 단계, 진행률(%), 상태별 item 수(완료·그리는 중·대기·실패·취소), 경과 시간, 처리 속도(item/s), 남은 시간 어림, Render Worker 수
- **필터 패널(4.9):** 탭 바 오른쪽 `필터` 토글로 오른쪽에 연다
- **로딩 표시:** 빈 화면에 글자만 띄우지 않는다. 앱이 뜨는 동안은 한 부팅 화면에서 단계(화면 불러오기 → 서버 띄우기 → 로그인 확인)를 이어 보여주고, 목록·grid는 올 내용의 모양대로 skeleton이나 자리 표시 카드를 둔다. 받는 중과 '데이터 없음'을 구분해, 받는 동안에는 '등록하세요' 같은 안내를 띄우지 않는다. 버튼은 진행 중이면 spinner를 함께 보인다. 비어 있는 영역은 아이콘·제목·설명으로 다음 할 일을 알려 준다
- **팝업:** 모달 팝업(알림, data 등록, 전체 설정)은 overlay-kit으로 띄워 본문 상태와 분리한다. 버튼에 붙는 popover는 네이티브 popover API를 쓴다
- **item 툴바:** 축소, 확대 초기화, 설정(⚙: legend 위치·개별 색), 크게 보기. item 위에 상단 줄을 두지 않고 차트 우측 상단에 띄운다. 커서를 올리거나 포커스가 들어오면 보이고, PNG는 카드 전체 크기로 그린다. 이름은 PNG 제목으로 보인다.
- **커서:** 도구를 쓰지 않는 일반 모드에서는 기본 커서다. 확대·페인트 모드에서만 십자·글자 커서로 바꾼다.

### 4.2 차트 종류

| 차트 | x | y |
|---|---|---|
| scatter | 숫자 또는 시계열 컬럼 | 숫자 컬럼 |
| bar | categorical 컬럼 | 숫자 컬럼을 집계한 값 (통계 함수 선택) |
| boxplot | categorical 컬럼 (그룹) | 숫자 컬럼의 분포 |

PNG로 그리기 때문에 scatter의 점이 많아도 이미지 크기는 같다. 밀도 차트로 바꾸는 처리는 하지 않는다.

컬럼 역할(x·y·z에 쓸 수 있는 타입, 통계 함수 사용)은 차트 종류별 표 하나로 정한다: 서버 `server/charts/chart-fields.ts`, 화면 `src/entities/chart/model/chart-kinds.ts`. z는 세 번째 값 컬럼으로, 쓰는 차트에서만 고른다.

#### 차트별 상단 도구 줄

그린 차트 종류가 지원하지 않는 모드·도구는 비활성(이유를 title로 안내)하고, 다른 차트를 그려 지금 모드를 못 쓰게 되면 기본 모드로 돌린다. 선택 필드 = 선택 영역 기준의 데이터 다운로드·데이터 테이블.

| 기능 | scatter | bar | boxplot |
|---|---|---|---|
| 이동 | O | O | O |
| 확대 | O | O | O |
| 사각형/자유형 선택 | O | O | O |
| 선택 필드 | O | O | O |
| 사각형/자유형 삭제 | O | X | X |
| 페인트 | O | O | O |
| 체크박스 표시 | O | O | O |

### 4.3 Split by와 grid
- 여러 컬럼을 고를 수 있는 selectbox이고, 클릭한 순서를 보장한다. 예: `a`(숫자) → `b` → `c` 순서로 고르면 item 이름은 `a-b-c`가 된다. 구분 기호는 전체 설정에서 바꿀 수 있다.
- 어떤 컬럼이든 고유값을 그대로 category로 쓴다.
- item 수는 고른 컬럼 고유값의 조합 수이고, 최대 30,000개다. 넘으면 draw 전에 경고하고 그리지 않는다 (`split-count` API로 미리 확인, 필터 적용).
- grid는 1×1부터 10×10까지 행·열을 따로 고를 수 있고, pagination으로 보여준다. 예: 3×3 grid에 item이 20개면 3페이지가 된다. 오른쪽 페이지 스크롤바로 넘긴다.
- 고해상도(레티나) 화면 대응은 하지 않는다.

### 4.3.1 크게 보기
- item을 더블 클릭하거나 item toolbar의 크게 보기 버튼을 누르면 grid 자리에 그 item 하나를 크게 보여준다. 다시 더블 클릭하거나 Esc, 버튼으로 grid로 돌아가면 그 item이 있는 페이지가 보인다.
- 아래에는 `<< < [섬네일…] > >>`가 있다. 한 item씩 옆으로(`<` `>`, ←/→), 처음·끝으로(`<<` `>>`, Home/End) 옮긴다. 섬네일을 누르면 그 item으로 간다.
- 섬네일은 128×80 고정 크기다. 목록 폭에 들어가는 만큼 보여주므로 브라우저가 넓을수록 많아진다. 크게 보는 item을 가운데 두고 한 칸씩 미끄러지며, 처음·끝에서는 목록을 꽉 채운 채 멈춘다 (`GET /jobs/:jobId?offset=&pageSize=`로 페이지 경계와 상관없이 받는다).
- 섬네일은 draw 때 원래 PNG와 같은 렌더 작업에서 함께 그린다(축·제목·legend 없이 그림 영역만). 크기가 고정이라 resize나 grid 변경에서는 다시 그리지 않고, 확대·도형·색처럼 그림 내용이 바뀔 때만 다시 그린다.
- 큰 차트는 영역 크기로 따로 그린다. 해상도를 지키려고 크기를 구간으로 맞추지 않는다. 대신 다음으로 부담을 줄인다.
  - 보이는 item 한 장만 그린다. 옆 item을 미리 그리지 않는다.
  - 서버가 같은 내용(revision)·같은 크기로 그린 PNG를 item당 4개 크기까지 LRU로 보관한다. 오가거나 다시 열거나 원래 크기로 돌아오면 다시 그리지 않는다. 실서버라면 오브젝트 스토리지 + TTL로 같은 캐시를 둔다.
  - 크기 변경은 5.4와 같이 300ms debounce, 그동안 grid PNG를 늘려 보여준다. 크게 보는 동안에는 grid item을 다시 그리지 않는다.
- 크게 본 item에서도 툴팁·확대·도형·색 조작이 grid와 같이 된다. 조작하면 grid PNG와 섬네일을 다시 그리고, 이어서 큰 PNG를 새 내용으로 받는다.

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
  - scatter: 커서 위치의 좌표값 + 가장 가까운 점. 가까운 점 표시는 전체 설정 · 툴팁에서 끌 수 있다(기본 켬). 끄면 커서 좌표값만 보이고, tooltip 컬럼은 가까운 점의 행 값이라 함께 숨기며 서버도 호출하지 않는다. 화면 표시만 바꾸는 설정이라 탭 상태에 두고 차트 설정(spec)에는 넣지 않는다
  - bar: 막대의 집계값
  - boxplot: 사분위수 등 통계값

### 4.5 확대/축소
- item마다 따로 동작한다 (item마다 category가 달라서 축을 공유할 수 없다).
- 확대: 확대 모드에서 십자 커서로 영역을 선택하면 서버가 그 범위로 다시 그린다. 시계열 x축도 점 위치는 숫자(epoch ms) 선형 축으로 계산해 1ms보다 좁게 확대해도 고른 영역 그대로 보인다(눈금만 UTC 축). 값이 하나뿐인 시계열은 앞뒤 1분을 보여주고, 눈금 글자는 보이는 범위에 따라 초·밀리초까지 적는다.
- 이동: 이동 모드에서는 커서만 손 모양(grab)으로 바꾸고 끄는 동안 그림은 그대로 둔다. 놓으면 끈 거리를 데이터 값으로 바꿔(`view` 요청 `type: pan`) 서버가 옮긴 범위로 다시 그린다. 확대 초기화로 원래 범위로 돌아간다.
- 축소: 정해진 비율로 축소한다.
- 처음으로 되돌리기가 있다.

### 4.6 도형
- 사각형, 선, 자유곡선, 텍스트 메모를 지원한다.
- 위치는 데이터 좌표로 저장해서, 확대해도 같은 데이터 위치에 붙어 있다.
- 서버에 저장하고, 서버가 PNG 안에 함께 그린다.
- 그리는 동안에는 화면에 임시 미리보기를 보여준다. 마우스를 떼면 서버에 저장하고 다시 그린다. PNG를 다시 받는 동안 그 item의 조작은 막는다.
- 그린 뒤에는 수정할 수 없다. undo(마지막 도형 삭제)와 전체 삭제만 있다.
- undo는 서버에서 마지막 도형을 삭제(`DELETE .../shapes/last`)하고 다시 그리는 방식이다. 이력은 세션 안에서만 유지하고, redo는 없다.

### 4.6.1 영역 선택
- 사각형 선택 / 자유형 선택 모드에서 차트 위를 끌어 영역을 고른다. 영역은 데이터 좌표(사각형 또는 닫힌 다각형)로 서버에 저장하고, 서버가 영역 테두리와 함께 바깥 점(막대/상자)을 흐리게 그려 PNG 제목 줄에 선택 수를 적는다. bar/boxplot은 막대 끝·상자 중앙값이 영역 안이면 선택이다.
- 선택 모드에서 끌지 않고 클릭하면 선택을 푼다. item마다 선택 영역은 하나다.
- 우클릭 메뉴(Base UI ContextMenu): `즐겨찾기에 추가…`(이름 붙여 영역을 남김), `새 범례…`(영역 안의 점을 새 legend 항목으로 칠하고 선택을 푼다. legend 컬럼이 없으면 나머지는 '기타'), `선택 해제`, `즐겨찾기 선택 ▸`(남긴 영역을 다시 선택), `즐겨찾기 삭제 ▸`, `새 범례 삭제 ▸`. 새 범례 색은 legend 항목처럼 PNG의 legend를 눌러 바꾼다.
- 선택·즐겨찾기·새 범례는 item 상태라 history와 공유 링크로 되살아난다.

### 4.6.2 점 삭제 (scatter)
- 사각형 삭제 / 자유형 삭제 모드에서 고른 영역의 점을 그 item에서 뺀다. 데이터는 그대로 두고, 지운 영역(데이터 좌표)을 item 상태로 쌓아 서버가 그릴 때 빼고 점 수·툴팁·선택 수에서도 뺀다.
- scatter에서만 된다. 다른 차트를 그리면 모드 버튼이 막히고, 삭제 모드였다면 기본 모드로 돌아간다.
- item 툴바의 `지운 점 되돌리기`(마지막 영역)와 우클릭 메뉴의 `지운 점 모두 되돌리기`로 되돌린다. history와 공유 링크로 복원된다.

### 4.7 legend
- 왼쪽 패널의 `legend` select로 색을 나눌 범주 컬럼을 고른다. 팔레트 8색을 돌려쓰지 않도록 고유값이 8개 이하인 컬럼(공장, 라인, 센서 종류, 근무조, 상태)만 고를 수 있다.
- legend 값 목록은 전체 데이터 기준이다. 어느 item에서든 같은 값은 같은 색을 받는다 (색은 순위가 아니라 값을 따른다).
- scatter는 점을 legend 값별로 색칠하고, bar/boxplot은 범주 안에 legend 값별 막대/상자를 나란히 놓는다 (사이 2px 간격).
- 서버가 PNG 안에 legend 상자를 그리고, 각 항목의 위치를 metadata로 넘긴다. 위치는 위·아래(가로 `[● 값 ● 값 …]`)와 왼쪽·오른쪽(세로 목록) 중 고르고 기본은 위다. 넘치면 `+N`으로 줄인다.
- 위치 결정 순서: item 개별 위치 → 공통 속성의 위치 → 위.
- 색 결정 순서: item 개별 legend 색 → 공통 속성의 legend 색 → 팔레트 기본 색(legend 값 순서).
- 개별 속성: item 툴바의 설정(⚙) 팝업에서 legend 위치와 legend 값별 색을 바꾼다. 'item 위치/색 공통 따르기'로 되돌린다. item에 커서를 올리면 PNG의 legend 항목 자리에 버튼이 겹쳐지고, ●를 누르면 네이티브 color picker가 열린다. 고르기를 마친 최종 색(`change` 이벤트)으로 한 번만 서버에 요청해 그 item을 다시 그린다.
- 공통 속성: 전체 설정의 색상·legend 메뉴에서 legend 값별 색과 위치를 바꾸면 전체를 다시 그리고 item 개별 색·위치를 덮어쓴다.
- legend 상자 위에서는 툴팁 대신 색 선택이 동작하고, 툴팁에는 가리킨 점/막대/상자의 legend 값이 함께 나온다.

- 체크박스 표시: 차트 도구의 토글을 켜면 PNG legend 항목의 색 표시(●) 자리에 체크박스를 겹친다(위치는 metadata의 `marker`). 다시 그리지 않고 화면에만 띄운다. 체크를 풀면 그 item에서 그 값을 숨기고(`PATCH .../props { legendVisible }`) 서버가 그 값의 점·막대·상자를 빼고 legend 표시를 속 빈 원과 흐린 글자로 다시 그린다. 숨긴 값은 item 개별 속성이라 history와 공유 링크로 복원된다.

### 4.7.1 다운로드
- 차트 다운로드: 고른 item의 grid PNG를 `이름.png`로 내려받는다.
- 모든 차트 엑셀로 다운로드: job의 모든 item 상태를 100개씩 받아 PNG를 모은 뒤 xlsx 한 파일로 내려받는다(exceljs, 누를 때 동적 import). '차트' 시트에 차트 grid와 같은 열 수로 이름과 이미지를 놓고, '목록' 시트에 순번·이름·상태를 적는다. 그리지 못한 item은 목록에만 남는다. 파일 크기를 생각해 앞에서부터 300개까지만 넣고, 넘으면 알린다.

### 4.7.2 데이터 다운로드 / 데이터 테이블
- 대상 행: 고른 item이 그린 행이다. split 조합 + draw 필터 + y(scatter는 x도) 값이 있는 행에서, 지운 영역 안의 행과 체크박스로 끈 legend 값의 행을 빼고, 선택 영역이 있으면 그 안의 행만 둔다. bar/boxplot의 선택은 영역 안에 든 막대/상자의 [범주, legend 값] 조합으로 바꿔 거른다. 영역 판정은 Postgres 기하 연산(`point <@ box/polygon`)으로 한다.
- 컬럼: 차트에 쓴 컬럼(split by → x → y → legend → 툴팁, 겹치면 한 번).
- 데이터 다운로드: 대상 행 전체를 CSV(머리글 = 컬럼 라벨, Excel용 BOM)로 내려받는다. DB Worker가 `COPY ... TO '/dev/blob'`으로 만든다. 선택이 있으면 파일 이름에 `_선택`을 붙인다.
- 데이터 테이블: 팝업 표(가상 스크롤). 보이는 행이 든 200행 페이지만 받고, 열 머리를 누르면 오름차순 → 내림차순 → 정렬 없음으로 서버에서 정렬한다. 머리에 전체(또는 선택한) 행 수를 보여준다.

### 4.8 공통 속성 / 개별 속성
- 모든 item은 기본적으로 공통 속성을 따른다.
- 개별 속성은 split 조합을 키로 서버에 저장한다. 다시 불러와도 유지된다.
- 공통 속성을 바꾸면 개별 속성까지 덮어쓰고 전체를 다시 그린다.
- 이번 범위에서 개별 속성은 색상과 legend 위치를 지원한다.

---

### 4.9 필터
- 오른쪽 패널에 컬럼마다 아코디언이 있다. 원본처럼 값은 DB에서 가져오므로, 아코디언을 열기 전에는 컬럼 이름만 보이고 여는 순간 서버에서 그 컬럼 요약을 받는다(받는 동안 pending).
- 숫자·시계열: 범위 슬라이더 + 범위 반전(범위 밖만 남기기) + 값 없음(null) 포함. 전체 범위 그대로이고 반전·null 제외도 없으면 필터를 두지 않는다.
- 범주: 검색 입력(부분 일치) + 가상 스크롤 목록. 처음엔 전부 포함이고, 체크를 풀어 뺀다. 검색 중에는 보이는 값만 한꺼번에 선택/해제한다. 목록은 split by 선택과 같은 드래그 선택을 쓴다(useDragSelect 공유): 누른 채 훑으면 지나간 값을 한꺼번에 바꾸고(체크된 값에서 시작하면 해제, 해제된 값에서 시작하면 체크), 가장자리에서는 자동 스크롤, Esc로 되돌린다. 키보드 Space는 체크박스가 처리한다.
- 필터는 draw할 때만 적용된다(grid 변경, 공통 속성 같은 즉시 다시 그리기에는 반영되지 않는다). 바뀐 필터가 아직 반영되지 않았으면 패널에 알린다.
- 서버는 차트 데이터 조회, bar/boxplot 집계, split 개수 확인에 같은 조건을 건다. 값은 모두 바인딩 파라미터로 넘긴다.
- history에는 차트 설정과 함께 필터가 남고, history 탭에서는 보기 전용으로 보인다.

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

## 6. API (MSA, REST, OAS)

### 6.1 서비스 분리
원본은 MSA였다. 같은 경계로 브라우저 안에서 서비스를 나눈다. MSW는 요청을 gateway에 넘기기만 하고, gateway가 경로 prefix로 서비스를 고른다.

| 서비스 | prefix | 맡는 일 | 저장소 |
|---|---|---|---|
| auth | `/api/auth` | 로그인, 토큰 발급·refresh(rotation)·폐기, 서비스 토큰, JWKS | 서명 키·refresh 세션 (IndexedDB) |
| data | `/api/data` | 데이터 적재(샘플 생성, CSV 올려 두기·미리보기·검사·적재·삭제), 데이터셋 메타 조회 (상태, 컬럼, split 개수, legend 값) | PGlite (쓰기) |
| chart | `/api/chart` | 렌더 job, item 조작, 툴팁, PNG, history | PGlite (조회·history), Cache API (PNG) |

- chart 서비스는 데이터가 없을 때 data 서비스에 HTTP로 적재를 요청한다. 인증은 auth 서비스에서 받은 **서비스 토큰**(client credentials)으로 한다.
- 대용량 조회(차트 데이터, 툴팁 행 값)는 chart 서비스가 DB를 직접 읽는다 (읽기 전용 접근. 원본의 렌더 서버도 DB를 직접 조회했다).

### 6.2 인증
- 로그인하면 access token(ES256 JWT, `typ: at+jwt`, 5분)과 refresh token(7일, 세션 id를 담은 JWT)을 받는다.
- refresh token은 한 번 쓰면 폐기하고 새로 준다(rotation). 로그아웃하면 세션을 지운다.
- data·chart 서비스는 auth 서비스의 공개 키(JWKS)로 토큰을 검증하고 scope(`chart:read`, `chart:write`, `data:read`, `data:write`)를 확인한다. 서비스끼리 비밀 키를 나눠 갖지 않는다.
- 화면은 access token을 메모리에, refresh token을 localStorage에 둔다(브라우저 안 mock 서버라 httpOnly 쿠키를 쓸 수 없다). 만료가 가까우면 미리 refresh하고, 401이 오면 refresh 후 한 번 다시 보낸다. 동시에 여러 요청이 refresh하려 해도 한 번만 부른다.
- `<img src>`는 Authorization 헤더를 보낼 수 없어 PNG만 인증 없이 연다. chartId가 추측할 수 없는 UUID라 링크를 아는 사람만 본다(presigned URL과 같은 성격).
- 데모 계정: `demo` / `demo1234`.

### 6.3 OAS (code-first)
원본은 Spring 서버가 swagger를 내고 프런트가 OAS generator로 타입을 받았다. 같은 흐름을 따른다.

```
서비스 routes (zod 스키마 + createRoute)
  ├─▶ handler 요청 검증 (실패하면 400 { error })
  └─▶ pnpm gen:api ─▶ public/openapi/<서비스>.json (OpenAPI 3.1)
                         └─▶ openapi-typescript ─▶ src/shared/api/generated/*.ts (화면)
                                                └─▶ server/services/chart/generated/*.ts (chart → auth·data)
```

- handler의 반환값은 응답 스키마로, 검증된 요청 값은 서버 내부 도메인 타입으로 컴파일 타임에 맞춰진다. 스키마와 구현이 어긋나면 빌드가 깨진다.
- 화면은 `@server/*`를 import할 수 없다(Biome `noRestrictedImports`). API 타입은 생성 타입에서만 가져오고, 화면 전용 값(컬럼 이름표 등)은 생성된 union을 키로 하는 Record로 두어 서버가 값을 늘리면 컴파일 에러가 난다.
- `pnpm gen:api:check`로 생성물이 서비스 코드와 맞는지 확인한다.
- 그리기를 요청하는 API는 모두 `{ jobId }`를 돌려준다.

### 6.4 엔드포인트
경로는 서비스 prefix 뒤에 붙는다. 요청·응답의 정확한 형태는 `public/openapi/*.json`이 기준이다.

| 서비스 | 용도 | 요청 | 응답 / 설명 |
|---|---|---|---|
| auth | 로그인 | `POST /login` | `{ username, password }` → access / refresh token, 사용자 |
| auth | refresh | `POST /refresh` | `{ refreshToken }` → 새 토큰 (쓴 refresh token은 폐기) |
| auth | 로그아웃 | `POST /logout` | refresh 세션 폐기 |
| auth | 현재 사용자 | `GET /me` | Bearer 필요 |
| auth | 서비스 토큰 | `POST /token` | `{ grantType: 'client_credentials', clientId, clientSecret }` |
| auth | 공개 키 | `GET /.well-known/jwks.json` | JWK Set |
| data | 데이터셋 목록 | `GET /datasets` | 샘플과 업로드한 데이터셋의 상태(`missing` / `generating` / `ready` / `failed`), 단계(`copy` / `analyze`), 진행률, 생성 시간, 업로드 정보(파일, 크기, 등록 시간, 전처리 옵션, 추론 타입) |
| data | 데이터셋 상태 | `GET /datasets/:id` | 하나의 상태. 모르는 id면 404 |
| data | 데이터 생성 | `POST /datasets/:id/generate` | 샘플이 없으면 생성을 시작하고 현재 상태를 돌려준다(202). 업로드한 데이터셋은 상태만. 적재는 한 번에 하나씩 순서대로 |
| data | 파일 올려 두기 | `POST /datasets/staging` | multipart `file`(csv / zip) → 201 `stageId`, 안의 CSV 목록. 적재는 아직 하지 않는다 |
| data | 원본 다시 올려 두기 | `POST /datasets/:id/staging` | 업로드한 데이터셋의 보관 원본 + 저장한 이름·옵션 (수정) |
| data | 미리보기 | `POST /datasets/staging/:stageId/preview` | `{ file, options }` → 원본 앞 50줄, 컬럼(추론·정한 타입), 바꾼 앞 100행, 바꿀 수 없는 칸, 파싱 오류 |
| data | 검사 | `POST /datasets/staging/:stageId/check` | `{ options }` → 전체 행 수, 건너뛴 행 수, 컬럼별 타입·변환 불가 수. 거절은 422와 사유 |
| data | 적재 | `POST /datasets/staging/:stageId/commit` | `{ name, options }` → 202 task. 수정이면 그 데이터셋을 다시 적재 |
| data | 적재 진행 | `GET /datasets/staging/:stageId/task?since=` | long polling. `parse` → `queued` → `copy` → `analyze` → `done` / `rejected` / `failed`, 진행 수, version |
| data | 버리기 | `DELETE /datasets/staging/:stageId` | 팝업을 닫으면 올려 둔 파일을 버린다 |
| data | 이름 변경 | `PATCH /datasets/:id` | `{ name }` |
| data | 삭제 | `DELETE /datasets/:id` | 업로드한 데이터셋만. 적재 중이면 409 |
| data | 스키마 | `GET /datasets/:id/schema` | 적재된 테이블의 컬럼: 이름, 라벨(주석), 타입(categorical / numeric / datetime), null 허용, 고유값 수(적재 후). 등록 전이면 409 |
| data | split 개수 확인 | `POST /datasets/:id/split-count` | `{ cols, filters }` → 조합 수 (30,000개 초과 검사, 필터 적용) |
| data | 컬럼 요약 | `GET /datasets/:id/columns/:column/summary` | 필터용. 숫자·시계열은 min/max/null 수, 범주는 값별 행 수 |
| chart | 그리기 시작 | `POST /charts` | 요청: 차트 설정, item 크기, (복원 시) 키별 확대·도형·개별 색, 이어 쓸 `historyId`, `record: false`면 history에 남기지 않음(다시 보기)<br>응답: `chartId`, `jobId`, `historyId` |
| chart | 진행 상태 | `GET /jobs/:jobId?page=&pageSize=&since=` | long polling. 페이지 item 상태·단계·진행률·`{ url, width, height }`, job 전체의 상태별 item 수·시간·worker 수 |
| chart | 진행 상태 (job 전체) | `GET /jobs/:jobId?pageSize=0&since=` | item 없이 상태·하단 진행률만, job이 끝날 때까지 long polling |
| chart | 진행 상태 (item 지정) | `GET /jobs/:jobId?items=k1,k2&since=` | item 단위 다시 그리기에서 그 item 상태만 |
| chart | 취소 | `POST /jobs/:jobId/cancel` | 남은 item을 `cancelled`로 기록 |
| chart | PNG | `GET /charts/:chartId/items/:key/png?v=` | `image/png` |
| chart | metadata | `GET /charts/:chartId/items/:key/meta?size=` | 4.4 참고. `size=WxH`면 크게 보기 PNG의 metadata |
| chart | 크게 보기 | `POST /charts/:chartId/items/:key/detail` | `{ itemSize }` 그려 둔 PNG가 있으면 `{ image }`, 없으면 그 한 장만 그리는 `{ jobId }` |
| chart | 툴팁 추가 컬럼 | `POST /charts/:chartId/items/:key/tooltip` | 점의 행 id + 고른 컬럼 → 값 |
| chart | 확대/축소 | `POST /charts/:chartId/items/:key/view` | `{ type: 'zoomIn', x, y }` (데이터 범위) \| `{ type: 'zoomOut', ratio }` \| `{ type: 'reset' }` \| `{ type: 'pan', dx, dy }` |
| chart | 도형 | `POST .../items/:key/shapes`<br>`DELETE .../items/:key/shapes/last`<br>`DELETE .../items/:key/shapes` | 추가 / undo / 전체 삭제 |
| chart | 점 삭제 | `POST .../items/:key/deletions`<br>`DELETE .../items/:key/deletions/last`<br>`DELETE .../items/:key/deletions` | `{ region }` 영역 안 점 빼기 (scatter만, 아니면 409) / 되돌리기 / 모두 되돌리기 |
| chart | 선택 영역 | `PUT .../items/:key/selection` | `{ region }` (사각형 또는 자유형, 데이터 좌표), `null`이면 해제 |
| chart | 즐겨찾기 | `POST .../items/:key/favorites`<br>`DELETE .../items/:key/favorites/:name` | 지금 선택 영역을 이름 붙여 남김 / 삭제 |
| chart | 새 범례 | `POST .../items/:key/legend-groups`<br>`DELETE .../items/:key/legend-groups/:name` | 지금 선택 영역을 새 legend 항목으로 / 삭제 |
| chart | 데이터 표 | `POST .../items/:key/rows` | `{ offset, limit(≤500), sort? }` → `{ columns, rows, total, selected }` (4.7.2) |
| chart | 데이터 다운로드 | `POST .../items/:key/rows/export` | 대상 행 전체 `text/csv` |
| chart | 개별 색상 | `PATCH .../items/:key/props` | `{ color }` 또는 `{ legendColor: { value, color } }`, `null`이면 공통 색으로 |
| data | legend 값 목록 | `GET /datasets/:id/legend-values?column=` | 전체 데이터 기준 legend 값 (공통 속성 popover용) |
| chart | 공통 속성 | `PATCH /charts/:chartId/common` | 개별 속성을 덮어쓰고 전체 다시 그리기 (렌더링 중 409) |
| chart | grid 변경 | `PATCH /charts/:chartId/grid` | `{ grid, itemSize }` 전체 다시 그리기 (렌더링 중 409) |
| chart | resize | `POST /charts/:chartId/resize` | `{ itemSize, keys }` 요청한 item만 다시 그리기, history 미기록 |
| chart | history | `GET /history`, `GET /history/:id` | 목록(썸네일·이벤트 수·상태별 item 수), 상세(키별 확대·도형·개별 색·최종 상태) |
| data / chart | 상태 | `GET /health` | 인증 없음 |

---

## 7. History
- 브라우저(IndexedDB)에만 보관한다. 서버 비용은 0원이다.
- draw 한 번에 한 건이 생긴다. 그 뒤의 확대, 도형, 개별 색상, grid 변경은 같은 건에 덧붙인다. resize는 기록하지 않는다.
- 저장 내용: 데이터셋 id, 생성기 버전, 차트 설정, 공통/개별 속성, 도형, 확대 상태, item별 최종 상태(`cancelled` 포함), 썸네일.
- `history` 화면: 왼쪽 목록에서 고르면 그 차트를 다시 그려 보여준다. 설정은 보기 전용(select disabled)이고 모드는 일반(툴팁)만, item 툴바는 숨긴다. 다시 보기는 history에 기록하지 않는다.
- `gallery에서 편집`을 누르면 그 차트를 gallery로 가져가고, 이후 변경은 그 history 건에 이어서 기록한다.
- gallery와 history는 작업 상태를 따로 들고 있어 tab을 오가도 각자 보던 차트가 남는다.
- 공유는 URL에 설정을 담아서 한다. 샘플은 시드가 고정이라 같은 URL이면 같은 차트가 다시 만들어진다. 업로드한 데이터는 같은 브라우저에서만 열린다.

---

## 8. 범위 밖 (후순위)
- 색상 외 개별 속성 (원본에는 많은 개별 속성 제어가 있음)
- 도형 수정, redo
- 실패한 item 다시 시도
- 기기 간 history 동기화, 팀 공유
- 고해상도(레티나) 대응
- 업로드 데이터의 기기 간 공유, xlsx 등 CSV 외 형식

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
