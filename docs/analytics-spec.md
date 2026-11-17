# Analytics 스펙

> 칸마다 다른 데이터·차트·필터를 두고 한 화면에서 함께 보는 서비스다. [기능 확장 후보 기획](feature-expansion-plan.md)의 A2(칸 레이아웃)와 A3(칸 연결)을 다룬다.

gallery는 데이터 하나에 설정 하나를 걸고 split 조합마다 같은 차트를 grid로 늘어놓는다. 한 탭에서는 데이터셋을 하나만 쓰고, 다른 차트 종류를 나란히 보려면 탭을 오가야 한다. analytics는 반대로 **칸마다 데이터·차트·필터가 따로**이고, 한 칸에서 고른 영역을 다른 칸이 따라 보게 잇는다. 여러 데이터를 한 화면에서 함께 쓰는 화면이라 gallery 탭의 모드가 아니라 자기 경로와 화면 틀을 갖는 별도 서비스다.

기준: vis-a-lot `develop` 0.18.2. 아래에서 '스펙 n.n'은 [prototype-spec.md](prototype-spec.md)의 절이다.

---

## 1. 범위

| 들어가는 것 | 빠지는 것 |
|---|---|
| `/analytics` 경로와 화면 틀 | 보드 여러 개, 이름 붙여 저장, 폴더 (프로젝트 기능은 폐기) |
| 칸 추가·삭제, 레이아웃 preset 17개, 끌어서 재배치, 경계 끌어 크기 조절, 칸 최대화 | 칸 안의 split by·grid·페이지 (칸 = 차트 한 장) |
| 칸마다 데이터·차트 종류·컬럼·필터·전체 설정, 칸별 draw·cancel, 모두 draw | 칸의 크게 보기(섬네일 줄). 칸 최대화로 대신한다 |
| 칸에서 툴팁·이동·확대·선택·삭제·페인트·legend 체크박스·item 속성·즐겨찾기·새 범례 | 보드 전체를 한 장으로 내보내기, 보드 공유 링크 |
| 칸 한 장의 PNG·데이터 다운로드, 데이터 테이블, 공유, 피드에 올리기 | 모든 칸 엑셀 내보내기 |
| 보드 자동 저장(사용자당 하나)과 다시 열기 | history 기록 (analytics draw는 history에 남기지 않는다) |
| 칸 연결: 한 칸의 선택 → 따르는 칸을 거르거나 강조 | 세 칸 이상으로 이어지는 전파, 강조 방식의 집계 차트 지원 |
| 다른 데이터셋끼리 연결(연결 컬럼) | SQL 데이터셋 (순서에서 빠졌다) |

---

## 2. gallery와 다른 점과 설계 결정

지금 코드에서 출발해 정한 것이다.

| 항목 | gallery (지금) | analytics | 이유 |
|---|---|---|---|
| 자리 | `/`의 view. 탭마다 차트 하나 | 경로 `/analytics`, 자체 화면 틀. 보드 하나에 칸 여러 개 | 여러 데이터를 함께 쓰는 화면이라 탭 모델에 맞지 않는다 |
| 차트 단위 | 차트 하나 = split item N개, grid와 페이지 | 칸 하나 = 차트 한 장(item 1개) | 칸마다 grid·페이지가 생기면 화면이 gallery의 반복이 된다 |
| 상태 | `TabsScope` 아래 탭마다 작업 store(`WorkspaceStore`) | 보드 store 하나 + 칸마다 작업 store | 왼쪽 패널·도구·item 조작이 이미 `WorkspaceScope` 하나를 보고 돈다. 칸을 scope로 감싸면 그대로 쓴다 |
| 저장 | draw마다 history 한 건 | 사용자당 보드 하나를 자동 저장. history에는 남기지 않는다 | 칸 여러 개를 다시 꾸미는 일이 크다. history는 차트 하나 단위라 보드를 담지 못한다 |
| 그리는 중 | 탭 전환을 잠근다 | 활성 칸을 바꿀 수 있다 | 칸마다 job이 따로라 한 칸이 다른 칸을 막을 이유가 없다 |
| 끌어 옮기기 | 없음 | `@dnd-kit/core` | 피드 보드(`widgets/post-board`)가 이미 쓴다. 라이브러리를 더하지 않는다 |
| 크기 변경 다시 그리기 | 300ms, `features/auto-resize` | 같은 것을 칸 크기에 쓴다 | 스펙 5.4와 같은 규칙 |
| 차트 사이 관계 | 없음 (item끼리 독립) | 칸이 **따를 칸** 하나를 고른다. 따를 칸의 선택이 따르는 칸만 바꾼다 | 서버가 차트 하나에 연결 범위 하나만 들면 된다. 선택마다 모든 칸을 다시 그리면 칸 9개에서 DB Worker 대기가 길다 |
| 연결 기준 | — | 같은 데이터셋은 선택된 행 조건 그대로, 다른 데이터셋은 연결 컬럼 값 | 선택 영역을 행 조건으로 바꾸는 코드(`itemRowsWhere`)가 이미 있다 |

---

## 3. 화면

### 3.1 레이아웃

```
┌──────────────────────────────────────────────────────────────────────────┐
│ vis-a-lot  [upload][datastore][gallery][history][analytics][shares]…사용자│
├──────────────────────────────────────────────────────────────────────────┤
│ [+ 칸][▦ 레이아웃][draw all] │ 모드 바 │ 차트 도구 │        [링크 복사][피드] [필터]│
├──────────────────┬───────────────────────────────────────────────────────┤
│ 칸 2 · Scatter    │ ┌───────────────┐┃┌───────────────────────┐          │
│ 데이터    [▼]     │ │ ⠿ 1 Bar  🔗 × ││ │ ⠿ 2 Scatter  🔗 ×      │          │
│ 차트 / 서브 차트   │ │     PNG       ││ │        PNG             │          │
│ x / y / legend   │ └───────────────┘┃└───────────────────────┘          │
│ 통계 함수         │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│ tooltip          │ ┌─────────────────────────────────────────┐          │
│ 따를 칸  [칸 1 ▼] │ │ ⠿ 3 Line   차트를 그려 주세요              │          │
│ [전체 설정]        │ └─────────────────────────────────────────┘          │
│ [draw]           │ 칸 3개 · 그리는 중 1 · Worker 4                        │
└──────────────────┴───────────────────────────────────────────────────────┘
```

- **상단 바:** gallery와 같은 `AppHeader`를 쓴다. `analytics` 항목을 더하고, 지금 경로가 `/analytics`면 그 항목을 고른 것으로 표시한다. analytics에서 gallery·history를 누르면 그 view를 고른 뒤 `/`로 간다.
- **보드 도구 줄:** 칸 추가, 레이아웃, draw all(그리는 칸이 있으면 cancel all), 모드 바, 차트 도구, 공유, 필터 토글.
- **왼쪽 패널:** 고른 칸(활성 칸)의 설정. 맨 위에 칸 번호와 차트 이름을 적는다. gallery의 `ControlPanel`에서 grid와 split by를 뺀 모양이다. 하단에 `전체 설정`과 `draw`를 고정한다.
- **보드:** 레이아웃 트리대로 칸을 놓는다. 칸을 누르거나 칸 안에 포커스가 들어오면 그 칸이 활성 칸이 되고 테두리를 강조한다.
- **오른쪽 필터 서랍:** 활성 칸의 필터. gallery처럼 보드 위에 겹쳐 연다.
- **하단 줄:** 칸 수, 그리는 중인 칸 수, 실패한 칸 수, Render Worker 수.

### 3.2 칸

- 칸은 차트 한 장이다. 서버에는 split 없는 차트 하나(item 1개, grid 1×1)로 만든다. item 크기는 칸 크기다.
- 칸마다 데이터셋을 따로 고른다. 새 칸은 활성 칸의 데이터셋으로 시작하고 차트는 scatter다.
- 칸 번호는 레이아웃 트리를 깊이 우선으로 읽은 순서(1부터)다. 옮기면 번호가 바뀐다.
- 칸 왼쪽 위에 커서를 올리거나 포커스가 들어오면 손잡이(⠿), 이름표(번호 · 차트 · 데이터셋 이름), 연결 버튼, 닫기를 띄운다. PNG는 칸 전체 크기로 그리고 줄을 따로 두지 않는다. item 툴바(축소, 확대 초기화, 설정, 최대화)는 gallery처럼 오른쪽 위다.
- 상태별 모양:

| 상태 | 모양 |
|---|---|
| 그린 적 없음 | 빈 칸. 아이콘 · "차트를 그려 주세요" · 활성 칸이면 왼쪽 패널에서 고르라는 설명 |
| 데이터 준비 중(`init`) | spinner |
| 그리는 중 | 단계와 진행률 (gallery item과 같은 표시) |
| 다 그림 | PNG + 도구 |
| 다시 그리는 중(크기, 조작, 연결) | 이전 PNG를 칸 크기에 맞춰 늘려 보이고 진행 표시 |
| 실패 | 사유 |

- 최대 9칸이다. 9칸이면 칸 추가를 막고 이유를 title로 알린다. 마지막 한 칸은 지울 수 없다.
- 칸을 지우면 그 칸의 job을 취소한다. 그린 차트가 있으면 확인 팝업을 띄운다.

### 3.3 레이아웃 트리

```ts
type LayoutNode =
  | { type: "leaf"; panelId: string }
  | { type: "split"; direction: "horizontal" | "vertical"; children: LayoutNode[]; ratios: number[] };
```

- CSS grid가 아니라 flex 트리다. split은 `flex-direction`을 정하고 자식은 `flex: <ratio> 0 0`으로 나눈다.
- 트리는 늘 정규화한다: 자식이 하나인 split은 자식으로 바꾸고, 같은 방향으로 겹친 split은 한 단계로 편다. 비율의 합은 1이다.
- **칸 추가:** 뿌리가 leaf면 세로 split으로 감싸고, 뿌리가 세로 split이면 끝에 더하고, 가로 split이면 세로 split으로 감싼다. 새 칸의 비율은 `1 / (칸 수)`이고 나머지는 같은 비율로 줄인다.
- **preset:** 17개다. 9칸까지에서 자주 쓰는 균등 격자와 '큰 칸 하나 + 작은 칸 여럿' 모양을 고른 것이다.

| 칸 수 | preset |
|---|---|
| 1 | 1×1 |
| 2 | 1×2, 2×1 |
| 3 | 1×3, 3×1, 왼쪽 큰 + 오른쪽 2, 오른쪽 큰 + 왼쪽 2, 위 큰 + 아래 2, 아래 큰 + 위 2 |
| 4 | 2×2, 1×4, 4×1 |
| 5 이상 | 2×3, 3×2, 3×2 왼쪽 큰, 2×3 위 큰, 3×3 |

  - 레이아웃 popover에서 작은 그림으로 고른다. preset의 칸 수에 맞춰 모자라면 빈 칸을 더하고, 남으면 뒤 번호 칸부터 지운다.
  - 그린 칸이 지워지면 "마지막 칸 N개가 지워집니다" 확인 팝업을 먼저 띄운다. 지워지는 칸을 따르던 연결은 푼다.
- **재배치:** 손잡이를 끌어 다른 칸 위에 놓는다. 놓는 자리는 대상 칸의 가장 가까운 변(위·아래·왼쪽·오른쪽)이다. 끄는 동안 놓을 변을 반투명으로 칠하고 바뀔 레이아웃을 미리 보인다. 놓으면 원래 자리에서 빼 대상 옆에 넣고 정규화한다 (같은 방향이면 형제로, 다른 방향이면 대상을 split으로 감싼다).
  - 키보드: 손잡이에 포커스를 두고 Space로 집고 화살표로 대상과 변을 고른다(`@dnd-kit/core`의 `KeyboardSensor`).
- **크기 조절:** split의 이웃 사이에 손잡이를 둔다. 끄는 동안에는 React 상태를 바꾸지 않고 두 칸의 `flex`만 DOM에서 바꾸며, 놓으면 비율을 store에 쓴다. 한 칸의 최소 비율은 0.05다. 손잡이는 `role="separator"`이고 화살표 키로 0.02씩 옮긴다.
- **최대화:** item 툴바의 최대화 버튼이나 칸 더블 클릭으로 그 칸만 보드 전체에 보인다. 다시 누르거나 Esc로 돌아온다. 다른 칸을 고르거나 레이아웃을 바꾸면 풀린다. 최대화한 동안 다른 칸은 다시 그리지 않는다.
- 그리는 칸이 하나라도 있거나 연결 다시 그리기가 진행 중이면 재배치·크기 조절·preset·칸 추가/삭제를 막는다 (PNG 크기가 진행 중인 job과 어긋난다). 막힌 이유를 title로 알린다.

### 3.4 왼쪽 패널과 필터

- 활성 칸의 draft를 고친다. 다른 칸을 고르면 패널이 그 칸의 draft로 바뀐다. 고치던 값은 칸마다 남는다.
- 필드: 데이터, 차트, 서브 차트, x, y, z, legend, 통계 함수, tooltip, (연결 PR부터) 따를 칸. grid·split by는 없다.
- 데이터 select는 gallery와 같이 등록한 데이터셋만 보인다. 데이터셋을 바꾸면 스키마에 맞지 않는 설정을 기본값으로 바로잡는 규칙도 같다(스펙 3.3).
- `전체 설정`은 그 칸의 공통 속성이다. 칸이 item 하나라 item 속성 팝업(⚙)과 대상이 같지만, 저장 위치와 합치는 순서는 gallery와 같게 둔다.
- 필터 서랍은 활성 칸의 필터다. draw할 때만 적용하고, 반영되지 않은 변경을 알리는 규칙도 같다(스펙 4.9).

### 3.5 draw와 진행

- `draw`는 활성 칸만 그린다. 버튼 상태는 gallery와 같다(draw → pending → cancel).
- `draw all`은 설정이 유효한 모든 칸을 번호 순으로 요청한다. 설정이 유효하지 않은 칸은 건너뛰고 개수를 알린다.
- 칸마다 job이 하나다. Render Worker는 모든 job이 함께 쓰는 FIFO 대기열 하나(`RenderPool`, 최대 4개)이고 DB Worker는 하나다. 칸이 item 하나라 9칸을 한꺼번에 그려도 렌더 작업은 9개다. 순서를 당기는 우선순위는 두지 않는다.
- gallery는 그리는 동안 탭 전환을 잠근다. analytics는 그리는 중에도 활성 칸을 바꿀 수 있다. 다른 칸의 draft를 고치고 draw를 눌러도 된다.
- 그리는 칸이 있는 채로 `/analytics`를 떠나도 job은 계속 돈다. 돌아오면 보드 store가 남아 있어 이어서 보인다.
- 칸 크기가 바뀌면(창 크기, 경계 끌기, 재배치, preset, 최대화, 배율, 테마) 멈춘 뒤 300ms에 PNG 크기가 칸과 다른 칸만 다시 그린다(`POST /charts/:id/resize`). 그리는 중인 칸은 끝난 뒤에 확인한다.

### 3.6 도구

- **모드 바:** 보드에 하나다. 고른 모드를 모든 칸에 적용한다. 그 칸의 차트가 지원하지 않는 모드면 그 칸만 기본 모드로 둔다. 모드 버튼은 활성 칸의 차트가 지원하지 않으면 비활성이다.
- **차트 도구:** 활성 칸이 대상이다. 체크박스 표시(보드 전체 토글), 차트 다운로드, 데이터 다운로드, 데이터 테이블, 전체 데이터 테이블. 모든 차트 엑셀 다운로드는 두지 않는다.
- **공유·피드에 올리기:** 활성 칸 차트 하나를 공유한다. 공유 페이지의 `gallery에서 열기`는 그대로 gallery 탭으로 연다.
- 칸 안의 조작(툴팁, 확대·이동, 도형, 선택, 점 삭제, legend 색·체크박스, 우클릭 메뉴)은 gallery item과 같다.

### 3.7 다른 화면과 오가는 길

| 어디서 | 무엇 | 동작 |
|---|---|---|
| 상단 바 | analytics | `/analytics`로 간다 (`next/link`) |
| 시작 화면 | 카드 "여러 차트 함께 보기" | `/analytics` |
| datastore 팝업 | `analytics에서 열기` | 빈 칸이 있으면 그 칸에, 없으면 새 칸에 그 데이터를 넣고 `/analytics`로 간다. 9칸이면 활성 칸의 데이터를 바꿀지 묻는다 |
| gallery 탭 도구 줄 | `analytics 칸으로` | 고른 item의 설정(split 조합은 필터로 바꾼다)과 item 상태로 새 칸을 만든다 |
| analytics 칸 우클릭 | `gallery에서 열기` | 그 칸의 설정으로 새 gallery 탭을 열고 `/`로 간다 |
| history | — | analytics draw는 history에 없다 |

### 3.8 저장과 다시 열기

- 보드는 사용자당 하나다. 서버(chart 서비스, PGlite)에 자동 저장한다.
- 저장하는 것: 레이아웃 트리, 활성 칸, 칸마다 draft, 마지막으로 그린 설정, 그린 item 상태(확대·도형·선택·지운 영역·즐겨찾기·새 범례·개별 속성: history의 `ItemRestore`와 같은 모양), 따를 칸과 연결 설정.
- 저장 시점: 레이아웃·칸 구성·연결이 바뀔 때, 칸의 draw나 item 다시 그리기가 끝날 때. 마지막 변경 뒤 1초에 한 번 보낸다. draft만 고친 것도 저장한다.
- `/analytics`를 처음 열면 저장된 보드를 받아 칸을 만들고, 그린 적이 있는 칸은 저장한 설정과 item 상태로 다시 그린다(`opening` 상태, history에서 여는 것과 같은 길). 저장된 보드가 없으면 빈 칸 하나다.
- 지운 업로드 데이터셋을 쓰던 칸은 사유와 함께 실패 상태로 열린다. 샘플이 없으면 생성부터 한다.
- 세션 안에서 `/`와 `/analytics`를 오가는 동안에는 보드 store가 메모리에 남아 다시 받지 않는다. 로그아웃하면 사라진다.
- 도구 줄의 `보드 비우기`는 확인 뒤 빈 칸 하나로 되돌린다.

### 3.9 반응형

| 폭 | 모양 |
|---|---|
| 64rem 이상 | 위 레이아웃 |
| 48rem ~ 64rem | 왼쪽 패널을 서랍으로 접는다(도구 줄의 설정 버튼). 보드는 전체 폭 |
| 48rem 미만 | 레이아웃 트리를 쓰지 않고 칸을 번호 순으로 한 줄로 쌓아 세로 스크롤한다. 칸 비율은 4:3. 재배치·크기 조절·preset은 숨기고 칸 추가·삭제만 둔다. 저장된 트리는 건드리지 않는다 |

---

## 4. 칸 연결

### 4.1 규칙

- 칸은 **따를 칸**을 하나 고른다(없음 가능). 한 칸을 여러 칸이 따를 수 있다. 자기 자신은 고를 수 없다.
- 따를 칸에서 영역을 선택하면(사각형·자유형) 그 선택의 **행 범위**가 따르는 칸에 걸리고, 따르는 칸을 다시 그린다. 선택을 풀면 범위도 풀린다.
- 전파는 한 단계다. 칸 3이 칸 2를, 칸 2가 칸 1을 따를 때 칸 1의 선택은 칸 2만 바꾼다. 칸 3은 칸 2 자신의 선택만 따른다. 그래서 서로 따르는 것(1 ↔ 2)도 된다.
- 행 범위는 선택한 순간의 값으로 서버가 고정한다. 그 뒤 따를 칸을 확대하거나 색을 바꿔도 바뀌지 않는다. 따를 칸의 선택이 바뀌거나, 따를 칸을 새로 draw하면(선택이 사라진다) 다시 정한다.
- 따를 칸이 될 수 있는 차트는 선택 필드를 지원하는 차트다: scatter, line(분포 서브 차트 제외), bar, boxplot, histogram, waterfall. 나머지 차트의 선택은 행으로 바꿀 수 없어 따를 칸 목록에서 비활성이고 이유를 적는다.
- 행 범위 = 따를 칸의 draw 필터 + 끈 legend 값 + 지운 영역 + 선택 영역 (`server/charts/item-scope.ts`의 `itemRowsScope`, 데이터 테이블의 '선택된 행'과 같다).

### 4.2 데이터셋이 다를 때

- 같은 데이터셋이면 연결 컬럼이 필요 없다. 따를 칸의 행 조건을 같은 테이블에 그대로 건다.
- 다른 데이터셋이면 **연결 컬럼** 한 쌍(따를 칸 쪽 컬럼, 이 칸 쪽 컬럼)을 고른다. 따르는 칸은 `이 칸 컬럼 in (선택된 행의 따를 칸 컬럼 값)`으로 걸린다. 값은 글자로 비교한다.
  - 기본값: 두 데이터셋에 이름과 타입이 같은 범주 컬럼이 있으면 스키마 순서로 첫 컬럼. 없으면 고를 때까지 연결이 걸리지 않는다고 알린다.
  - 샘플끼리(`iot-100k` ↔ `iot-1m`)는 컬럼이 같아 `factory`가 기본이다. 설비 단위로 보려면 `machine`으로 바꾼다.
- 어느 쪽이든 데이터셋을 바꾸면 연결 컬럼을 기본값으로 다시 정한다.

### 4.3 방식

| 방식 | 그림 | 쓸 수 있는 차트 |
|---|---|---|
| 거르기 | 범위 안의 행만으로 그린다. 축 범위·집계·legend 값도 그 행 기준이다 | 14종 모두 |
| 강조 | 모든 행을 그리고 범위 밖 점을 흐리게 한다(모양 › 선택 밖 진하기). 축 범위는 전체 그대로다 | scatter, line(분포 서브 차트 제외) |

- 기본값은 강조를 쓸 수 있는 차트면 강조, 아니면 거르기다. 차트 종류를 바꿔 강조를 쓸 수 없게 되면 거르기로 바꾼다.
- 걸린 범위는 PNG 제목 줄 요약에 적는다 (예: `칸 1 선택 1,204행`). 범위에 맞는 행이 없으면 빈 차트에 그 사실을 적는다.
- 거르기일 때 데이터 테이블·데이터 다운로드는 걸린 범위 안의 행만 담는다. 강조일 때는 그린 행 전부다.
- 따르는 칸 자신의 선택·확대·도형은 그대로 둔다. 거르기로 점이 줄어도 선택 영역은 데이터 좌표라 남는다.

### 4.4 화면

- 칸 이름표의 연결 버튼(🔗)과 왼쪽 패널의 `따를 칸`이 같은 popover를 연다: 따를 칸 목록(번호 · 차트 · 데이터셋), 방식, 연결 컬럼(데이터셋이 다를 때만), 연결 풀기.
- 따르는 칸은 이름표에 `← 1`, 따를 칸은 `→ 2, 3`을 적는다. 연결 버튼에 커서를 올리면 상대 칸 테두리를 강조한다.
- 따를 칸에서 선택이 끝나면(선택 다시 그리기 job이 끝나면) 따르는 칸을 다시 그린다. 따르는 칸이 그리는 중이면 끝나기를 기다렸다가 마지막 선택만 보낸다.
- 따르는 칸이 다시 그리는 동안 이전 PNG 위에 진행 표시를 얹는다.
- 따를 칸을 지우거나 preset으로 지워지면 연결을 풀고 범위도 푼다.

---

## 5. API와 서버

경로는 chart 서비스(`/api/chart`) 아래다. 정확한 모양은 `pnpm gen:api` 뒤의 `public/openapi/chart.json`이 기준이다.

### 5.1 보드 (첫 PR)

| 용도 | 요청 | 응답 / 설명 |
|---|---|---|
| 보드 받기 | `GET /analytics/board` | `{ layout, activePanelId, panels: [{ id, draft, drawn?: { spec, restore }, link? }], updatedAt }`. 없으면 404 (화면은 빈 칸 하나로 시작) |
| 보드 저장 | `PUT /analytics/board` | `{ layout, activePanelId, panels: [{ id, draft, chartId?, link? }] }` → 204. `chartId`가 있으면 서버가 그 차트의 지금 설정과 item 상태(`chartRestore`)를 `drawn`으로 고정한다. 모르는 `chartId`면 그 칸의 이전 `drawn`을 그대로 둔다 |
| 보드 비우기 | `DELETE /analytics/board` | 204 |

- 저장소: PGlite 고정 테이블 `analytics_boards(user_id primary key, body jsonb, updated_at)` (`server/db/database.ts`에 타입, 공유 테이블과 같은 방식으로 연다). 사용자 id는 토큰의 `sub`다. scope는 `chart:read` / `chart:write`.
- 검증: 트리의 leaf와 `panels`의 id가 1:1, 칸 1~9개, 비율 합 1(오차 허용), `link.follow`는 있는 칸.
- 칸의 draw는 지금 API 그대로다: `POST /charts`에 `grid 1×1`, `splitBy: []`, `record: false`, 다시 열 때는 `restore`. item 키는 split 없는 차트의 키 하나다.
- 차트 레코드는 지금처럼 서버 메모리에 있다. 새로고침하면 사라지므로 다시 열 때 새로 그린다.

### 5.2 연결 (둘째 PR)

| 용도 | 요청 | 응답 / 설명 |
|---|---|---|
| 연결 범위 걸기 | `PUT /charts/{chartId}/link` | `{ source: { chartId, itemKey }, mode: 'filter' \| 'highlight', on?: { source, target } } \| null` → `{ jobId }` (전체 다시 그리기). 서버가 source item의 지금 행 범위를 고정해 이 차트에 저장한다. source에 선택이 없으면 범위를 지운다. 범위가 그대로면 다시 그리지 않고 `{ jobId: null }` |
| | 오류 | 그리는 중 409. source 차트·item을 모르면 404. source가 선택 필드를 지원하지 않거나, 강조를 쓸 수 없는 차트에 `highlight`거나, 데이터셋이 다른데 `on`이 없거나 컬럼이 스키마에 없으면 422와 사유 |
| 그릴 때 함께 걸기 | `POST /charts`의 `link?` | 위와 같은 모양. 따르는 칸을 새로 draw할 때 따를 칸에 선택이 있으면 한 번에 건다 |

- `ChartRecord.link = { scope: ItemRowsScope, sourceDataset, on?, mode, rows }`. `rows`는 범위 안 행 수(요약 글자용)다.
- **거르기:** `server/data/filters.ts`의 필터 종류에 서버 내부용 '행 범위' 하나를 더하고 `filterSql`이 풀어 쓴다. 차트별 데이터 모듈(`*-data.ts`)은 모두 `filterSql`을 거치므로 고치지 않는다. API 스키마(`spec.filters`)에는 넣지 않는다.
  - 같은 데이터셋: `itemRowsWhere(schema, scope)` 조건을 그대로 더한다.
  - 다른 데이터셋: `<target 컬럼>::text in (select distinct <source 컬럼>::text from <source 테이블> where <itemRowsWhere(source 스키마, scope)>)`.
  - 컬럼 이름은 스키마로 확인하고 인용한다. 값은 바인딩 파라미터다.
- **강조:** 점 차트 데이터 조회(`chartData`)가 조건을 where가 아니라 행마다 참·거짓 열로 받아 `Uint8Array`로 넘긴다. Render Worker는 범위 밖 점을 먼저 '선택 밖 진하기'로, 범위 안 점을 그 위에 그린다. line은 범위 안에서 이어지는 구간만 진하게 그린다(선택 영역의 규칙과 같다). metadata의 점 줄이기는 범위 안 점을 먼저 남긴다.
- 연결 범위가 바뀌면 그 차트의 데이터 캐시(`cacheChartData`)를 버린다.
- 데이터 표·다운로드(`itemRowsScope`)는 거르기일 때 연결 범위를 함께 건다.
- `ItemMeta`(또는 item 상태)에 `link: { rows, mode }`를 더해 화면이 요약을 읽는다. 제목 줄 요약 글자는 서버가 PNG에 그린다.
- 보드 저장 모양의 `link`: `{ follow: panelId, mode, on? }`. 다시 열 때 따를 칸을 먼저 그리고(선택이 `restore`로 되살아난다) 따르는 칸은 `POST /charts`의 `link`로 건다.
- history·공유: analytics 차트는 history에 없다. 공유 스냅숏은 연결 범위를 담지 않는다(공유를 gallery에서 열면 범위 없는 차트다). 스펙에 그렇게 적는다.

---

## 6. 화면 위치

`apps/web` 기준이다. `src/analytics/` 같은 도메인 폴더는 만들지 않는다.

| 위치 | 두는 것 |
|---|---|
| `app/(session)/analytics/page.tsx` | 라우트. `views/analytics`만 그린다. 로그인·차트 기본값·팝업은 `(session)` layout(`ClientApp`)이 맡는다 |
| `src/application/SessionScope.tsx` | `BoardScope`를 `TabsScope` 옆에 둔다. `/`와 `/analytics`를 오가도 보드가 남는다 |
| `src/views/analytics/ui/AnalyticsView.tsx` | 화면 틀 조합: 상단 바, 도구 줄, 왼쪽 패널, 보드, 필터 서랍, 하단 줄. 활성 칸의 `WorkspaceScope`로 패널·도구를 감싼다. 보드 위젯의 칸 자리에 칸 차트 위젯을 끼운다 |
| `src/views/analytics/model/` | 이 화면만 쓰는 것: 보드 받기·자동 저장, 다시 열기 순서 |
| `src/entities/workspace/model/board-store.ts`, `board-scope.tsx` | 보드 store(레이아웃 트리, 칸 목록, 활성 칸, 최대화, 연결). 칸마다 `createWorkspaceStore`로 만든 store를 든다. `useBoard(selector)` |
| `src/entities/workspace/lib/layout-tree.ts`, `layout-presets.ts` | 트리 순수 함수(찾기, 넣기, 빼기, 옮기기, 정규화, 비율)와 preset 17개 |
| `src/entities/workspace/model/workspace-store.ts` | 칸용 생성 옵션(grid 1×1 고정) |
| `src/widgets/analytics-board/ui/` | `AnalyticsBoard`(DnD, flex 트리, 미리보기), `PanelSlot`(손잡이, 이름표, 닫기, 놓는 변), `ResizeHandle`. 칸 내용은 render prop(`renderPanel(panelId)`)으로 받는다 (widget은 다른 widget을 import하지 않는다) |
| `src/widgets/chart-grid/ui/PanelChart.tsx` | 차트 한 장을 칸 크기로 그린다. `ChartItemCard`와 `useAutoResize`를 쓴다. 페이지 스크롤·하단 job 바·크게 보기는 없다 |
| `src/widgets/analytics-toolbar/ui/` | 보드 도구 줄 |
| `src/widgets/control-panel/ui/ControlPanel.tsx` | grid·split by를 감추는 props |
| `src/widgets/app-header`, `home-landing` | analytics 항목, 카드 |
| `src/features/arrange-panels/ui/` | 칸 추가 버튼, 레이아웃 popover, 보드 비우기 |
| `src/features/draw-chart/ui/DrawAllButton.tsx` | 모두 draw / 모두 cancel. 칸 draw는 `DrawButton` 그대로 |
| `src/features/select-mode/ui/ModeBar.tsx` | 보드에서는 고른 모드를 모든 칸에 적용하는 콜백을 props로 받는다 |
| `src/features/open-chart`, `register-dataset` | `analytics 칸으로`, `gallery에서 열기`, `analytics에서 열기` |
| `src/features/link-panel/ui/`, `model/` | (둘째 PR) 연결 popover, 선택이 끝나면 따르는 칸에 범위를 거는 일 |
| `src/shared/api` | 보드·연결 요청과 query. 타입은 생성물만 쓴다 |
| `server/services/chart/{schemas,routes,app}.ts`, `server/charts/board-store.ts` | 보드 API와 저장 |
| `server/charts/chart-store.ts`, `item-scope.ts`, `server/data/filters.ts`, `chart-data.ts`, `server/render/scatter.ts`, `line.ts`, `server/jobs/job-manager.ts` | (둘째 PR) 연결 범위 |

상태 구독은 [state-subscriptions.md](state-subscriptions.md)를 따른다.

- 보드 위젯은 레이아웃 트리와 칸 id 목록만 구독한다. 칸의 draft·진행률이 바뀌어도 보드가 다시 그려지지 않는다.
- 칸은 `memo`하고 자기 store에서 필요한 값만 고른다. 부모는 칸 id만 넘긴다.
- 크기 조절 중에는 store를 쓰지 않는다. 놓을 때 한 번 쓴다.
- 자동 저장, 연결 전파처럼 그리지 않는 일은 `return null` 컴포넌트로 뗀다.
- '그리는 칸이 있는지'는 칸마다 작은 컴포넌트가 자기 job 상태를 읽어 보드 store의 칸별 boolean에 옮긴다. 보드는 그 boolean만 구독한다.

---

## 7. PR과 작업 단위

PR을 둘로 나눈다. 첫 PR만으로 화면이 완결되고, 둘째 PR은 서버 렌더와 데이터 조회를 건드려 검토 대상이 다르다. 한 PR로 묶으라면 아래 단위를 그대로 이어 붙인다.

### PR 1 — `feat/analytics-board` (A2)

| 단위 | 맡는 것 | 주로 고치는 곳 | 앞선 단위 |
|---|---|---|---|
| 1. 모델과 저장 | 레이아웃 트리 함수·preset과 테스트, 보드 store·scope, 칸용 작업 store 옵션, 보드 API(스키마·라우트·저장·`gen:api`), `shared/api` 요청 | `entities/workspace`, `server/services/chart`, `server/charts/board-store.ts`, `server/db`, `shared/api` | — |
| 2. 보드 위젯 | flex 트리 렌더, 재배치(미리보기, 키보드), 크기 조절, 최대화, 칸 틀(손잡이·이름표·닫기), 레이아웃 popover, 칸 추가·삭제·비우기, 좁은 폭의 한 줄 쌓기 | `widgets/analytics-board`, `features/arrange-panels` | 1 |
| 3. 칸 차트와 화면 틀 | `PanelChart`, `ControlPanel` props, 라우트·view·`SessionScope`, 도구 줄(모드 전체 적용, draw all), 하단 줄, 필터 서랍, 자동 저장과 다시 열기, 상단 바·시작 화면·datastore·gallery와 오가는 길 | `widgets/chart-grid`, `widgets/control-panel`, `widgets/analytics-toolbar`, `views/analytics`, `application`, `features/draw-chart`, `features/select-mode`, `features/open-chart`, `features/register-dataset`, `widgets/app-header`, `widgets/home-landing` | 1 |
| 4. 마무리 | 3개 언어 카탈로그, 렌더 횟수 테스트, 도움말, CHANGELOG, `prototype-spec.md` 연결, 전체 검사 | 각 slice `config/locales`, `apps/help`, `docs` | 2, 3 |

- 단위 1이 끝나면 2와 3은 함께 돌 수 있다. 둘이 만나는 곳은 보드 store의 action 이름과 `renderPanel(panelId)` 하나다. 단위 1이 이 둘을 먼저 확정한다.
- 단위 2는 차트 없이 색 상자를 끼워 만들고 테스트한다.

### PR 2 — `feat/analytics-link` (A3)

| 단위 | 맡는 것 | 주로 고치는 곳 | 앞선 단위 |
|---|---|---|---|
| 1. 서버 | 연결 API, 범위 고정, `filterSql`의 행 범위(같은·다른 데이터셋), 강조 열과 scatter·line 렌더, 캐시 버리기, 데이터 표 범위, 요약 글자, 테스트 | `server/**` | PR 1 |
| 2. 화면 | 보드 store의 연결 상태와 저장, 연결 popover, 이름표 표시, 선택 → 따르는 칸 전파(대기·마지막 것만), 다시 열기 순서, 왼쪽 패널 `따를 칸` | `entities/workspace`, `features/link-panel`, `widgets/analytics-board`, `views/analytics`, `shared/api` | 1의 API 모양 |
| 3. 마무리 | 카탈로그, 도움말, CHANGELOG, 검사 | | 1, 2 |

---

## 8. 완료 기준

### PR 1

- 9칸 preset(3×3)에서 서로 다른 데이터셋 둘 이상으로 `draw all`이 끝난다. 그리는 중에 다른 칸을 고르고 draft를 고칠 수 있다.
- 칸을 끌어 옮기거나 경계를 끌면 PNG 크기가 달라진 칸만 한 번 다시 그린다.
- 새로고침하면 레이아웃·설정·item 상태(확대, 도형, 선택, 개별 색)가 돌아온다. `/`에 다녀와도 다시 받지 않는다.
- analytics에서 그린 것이 history 목록에 없다.
- 테스트
  - `layout-tree.test.ts`: 넣기·빼기·옮기기·정규화·비율, preset 17개의 칸 수.
  - `board-store.test.ts`: 칸 추가·삭제, preset으로 줄이고 늘리기, 활성 칸 넘기기, 9칸 한도.
  - 서버: 보드 저장·받기·검증 실패(트리와 칸 불일치, 10칸).
  - `AnalyticsBoard.render.test.tsx`: 한 칸의 draft·진행률이 바뀔 때 다른 칸과 보드가 다시 그려지지 않는다. 경계를 끄는 동안 렌더가 0회다.
  - `ResizeHandle`: 최소 비율, 키보드.
- `pnpm lint`(FSD·Biome·Stylelint), `pnpm typecheck`, `pnpm test`, `pnpm build`(번역 누락 검사 포함), `pnpm gen:api:check`가 통과한다.
- 문구는 ko·en·ja 카탈로그에 있다. 인라인 스타일은 런타임 값(`flex` 비율)만 쓴다.
- 도움말: `apps/help`에 analytics 문서(시작하기, 레이아웃, 칸 그리기)와 목차. 상단 바에서 간다.
- `CHANGELOG.md` 항목, `prototype-spec.md`의 상단 바·범위 밖 절에 이 문서 링크.

### PR 2

- scatter 칸에서 고른 영역이 같은 데이터셋의 bar 칸(거르기)과 scatter 칸(강조)에 걸린다. 선택을 풀면 원래대로 돌아온다.
- `iot-100k` 칸의 선택이 `iot-1m` 칸에 `machine` 컬럼으로 걸린다.
- 따르는 칸이 그리는 중에 선택을 세 번 바꾸면 마지막 선택으로 한 번만 다시 그린다.
- 테스트
  - `filters.test.ts`: 행 범위(같은 데이터셋, 다른 데이터셋, 공백·한글 컬럼 이름).
  - 서버: 연결 API의 409·404·422, 선택 없음 → 범위 지움, 범위가 같으면 다시 그리지 않음, 데이터 표가 거르기 범위를 따름.
  - 렌더: scatter·line 강조(범위 밖 점의 진하기, line 구간).
  - 화면: 전파 순서(한 단계만), 따를 칸을 지우면 연결이 풀림.
- 나머지 검사·문구·도움말(연결 문서)·CHANGELOG는 PR 1과 같다.

---

## 9. 정해야 할 것

1. **PR 수.** 위는 둘(보드 / 연결)로 나눴다. 기능마다 PR 하나라는 원칙대로 하나로 묶을 수도 있다.
2. **보드 저장.** 사용자당 하나를 서버에 자동 저장한다고 적었다. 세션 동안만 두면(새로고침하면 빈 보드) 보드 API와 다시 열기가 빠져 단위 1·3이 줄어든다.
3. **history.** analytics draw를 history에 남기지 않는다고 적었다. 남기면 history에서 열 때 어느 화면으로 갈지도 정해야 한다.
4. **칸 안의 split by.** 뺐다. 넣으면 칸 안에 grid·페이지가 생겨 gallery와 같은 것이 칸마다 들어간다.
5. **선택이 미치는 범위.** 선택이 따르는 칸만 바꾼다고 적었다. 다른 길은 연결하지 않은 칸까지 모두 강조하는 것이다. 연결을 고르지 않아도 칸끼리 반응하지만 선택마다 모든 칸을 다시 그린다.
6. **강조의 범위.** scatter·line만이다. bar·histogram(합계·개수)에서 전체 막대 위에 범위 안 막대를 겹치는 것은 뒤로 미뤘다.
7. **e2e.** 저장소에 브라우저 e2e가 없다(vitest만). 끌어 옮기기·크기 조절은 단위 테스트로 다 잡히지 않는다. PR 1에 Playwright smoke 묶음을 넣을지 정한다.
8. **모바일.** 48rem 미만은 한 줄 쌓기로 보기만 되게 했다. 빼도 된다.
