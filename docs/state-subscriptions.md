# zustand 구독 점검

작업 상태는 zustand store 두 종류에 있다. 탭 목록과 탭 사이 상태는 탭 store(`entities/workspace/model/tabs-store.ts`, `TabsScope`/`useTabs`)에, 탭 하나의 작업 상태는 작업 store(`workspace-store.ts`, `WorkspaceScope`/`useWorkspace`)에 있다. 이번 점검에서는 store를 누가 구독하는지 정리하고, 렌더 횟수를 잰 뒤 구독 구조를 고쳤다. 상태를 어디서 넘겨주는지에 대한 기준은 [architecture.md](architecture.md#상태-위임)에 적었다.

## 감사

반환 표기: **원시값**(boolean·number·string), **참조**(state 안의 객체·배열을 그대로 돌려준다. 그 필드가 바뀔 때만 참조가 바뀐다), **함수**(action. store를 만들 때 정해져 바뀌지 않는다), **새 참조**(selector가 부를 때마다 새 객체·배열을 만든다. `useShallow` 없이 쓰면 store가 바뀔 때마다 다시 그리고, React가 무한 렌더로 본다).

| 컴포넌트·hook | 레이어 | 고르는 값 | 반환 | 순수 UI여야 하나 | 조치 |
| --- | --- | --- | --- | --- | --- |
| `Workspace` | views | `view`, 보는 탭(`find`), `emptyHistory`, **`filterPanelOpen`** | 원시값·참조 | 아니요 (조합) | 필터 패널 열림은 `FilterDrawer`만 구독 |
| `useOpenSharedLink`, `TabNotices`, `DrawLock`, `HistorySidebar` | views | `gridArea`, store, `readOnly`, `current !== undefined` | 참조·원시값 | 아니요 | 그대로 |
| `AppHeader` | widgets | `view`, `locked`, `setView`(getState) | 원시값 | 아니요 | 그대로 |
| `TabBar` | widgets | **전: `tabs` 배열 전체**, `active[view]`, `locked` | 참조 | 아니요 | 이 view의 탭 id만 `useShallow`로 고른다 |
| `TabLabel` | widgets | 그 탭 store의 `current?.spec`, `draft.dataset` | 참조·원시값 | 아니요 | `memo` |
| `TabItem` (새로 나눔) | widgets | id로 자기 탭, `activate`, `close` | 참조·함수 | 아니요 | `memo`, 자기 데이터를 직접 고른다 |
| `FilterToggle` | widgets | `filterPanelOpen`, `toggleFilterPanel`, `draft.filters?.length` | 원시값·함수 | 아니요 | 그대로 |
| `ChartGrid` | widgets | `current`, `readOnly`, `opening`, `draft.grid`, `page`, `focus`, `gridArea`, action | 참조·원시값·함수 | 아니요 | `useAutoResize`를 떼어 냄, `displaySize` memo, item을 `GridItem`(memo)으로 |
| `useAutoResize` | features | **`itemJobs` 전체**, `setItemJob` | 참조 | — | `ChartGrid` 본문 밖 `AutoResize` 컴포넌트에서 부른다 |
| `DrawnItem` (`ChartItemCard`) | widgets | `mode`, `paintTool`, `readOnly`, `itemJobs[key]`, `selectedItem === key`, `undoCounts[key]`, 차트 종류·legend 위치 (구독 11개) | 원시값·함수 | 아니요 (item 컨테이너) | 원시값 9개를 `useShallow` selector 하나로, action은 getState. 체크박스 표시·페인트 도구를 골라 아래로 넘긴다 |
| `DetailView` | widgets | **`itemJobs` 전체**, `setFocus` | 참조 | 아니요 | 보는 item의 `itemJobs[key] !== undefined`만 고른다 |
| `ItemSettingsDialog` | widgets | `readOnly`, `current?.spec.common`, 차트 종류 | 원시값·참조 | 아니요 | 다시 그리는 중(`busy`)도 골라 팝업에 넘긴다 |
| `ControlPanel` | widgets | **`draft` 전체**, `updateDraft`, `readOnly` | 참조 | 아니요 | 보여주는 필드 10개만 `useShallow`로, 스키마 맞춤(`FitDraftToSchema`)은 따로 |
| `FilterPanel`, `HistoryList`, `HomeLanding` | widgets | 필터·데이터셋·action 등 | 원시값·참조·함수 | 아니요 | 그대로 |
| `ItemOptionsDialog` | features | 차트 종류, `readOnly`, `itemJobs[key]` | 원시값 | **예** | store 호출을 빼고 props로 받는다 |
| `ColorSettings`, `SplitSettings`, `LegendSettings` | features | **`draft` 전체** | 참조 | **예** (설정 팝업의 구역) | store 호출을 빼고 `draft` prop으로 받는다 |
| `TooltipSettings`, `CommonOptionSettings` | features | `draft.chartType` | 원시값 | **예** | store 호출을 빼고 `draft`·`defaults` prop으로 받는다 |
| `SettingsDialog` (`SettingsBody`) | features | `draft`, `readOnly`, action | 참조·함수 | 아니요 (팝업 컨테이너) | 구역들에 값을 내려 준다 |
| `PaintToolbar` | features | `paintTool`, `setPaintTool` | 원시값·함수 | **예** (item 도구) | `tool`·`onToolChange` props |
| `LegendCheckboxes` | features | `showLegendCheckboxes && supports(...)` | 원시값 | **예** (item 도구) | `shown` prop |
| `GridPicker` | features | **`draft` 전체**, `current`, **`page`**, **`gridArea`**, action | 참조 | 아니요 | `draft.grid`만 구독, `page`·`gridArea`는 누를 때 getState |
| `DrawButton` | features | **`draft` 전체**, **`gridArea`**, `current`, action | 참조 | 아니요 | 데이터셋·x/y 선택 여부·job id만 구독, 그릴 설정과 크기는 누를 때 getState |
| `useDrawState`, `GridPicker`, `ChartGrid`의 `useJobProgress` | features·widgets | 진행률 응답 전체 | 참조(응답마다 새 값) | — | `select`로 쓰는 값(상태·개수·오류)만 고르고, 조건 앞에서 늘 읽는다 |
| `useDatasetStatus` → `useDatasetState` (`DrawButton`, `ColorSettings`, `useDatasetSchema`, `useSchemaState`) | shared | 목록에서 이 데이터셋 항목 전체 | 참조 | — | 상태(state)만 `select`. `DrawButton`은 핸들러에서만 읽어 목록을 다시 받을 때마다 다시 그렸다 |
| `GallerySidebar` | views | 공유 링크 열기(mutation 상태, `gridArea`) | 참조 | 아니요 | `OpenSharedLink`(아무것도 그리지 않음)로 떼어 설정 패널·draw 버튼으로 번지지 않게 |
| `ModeBar`, `ShareButton`, `FeedPostButton`, `EditInGalleryButton`, `ColumnFilter`, `DatastoreDialog` | features | 원자 단위 값, `current`, action | 원시값·참조·함수 | 아니요 (동작 하나) | 그대로 |
| `ChartActionBar` | features | 원자 단위 값, `current`, `draft.chartType`, `draft.subType`, action | 원시값·참조·함수 | 아니요 (동작 하나) | 그대로. 관리선 버튼이 다음 draw의 차트를 보느라 `draft.chartType`·`draft.subType`을 따로 고른다 (draft 전체는 구독하지 않는다) |
| `ItemTooltip` | features | 데이터셋, `showNearest`, `current?.spec`, `draft.tooltip` | 원시값·참조 | 아니요 | 그대로 |
| `useItemAction`, `useItemDetail`, `useDrawState`, `useOpenChart`, `useWorkspaceMutationKey` | features·entities model | action, `current`, `opening`, `id` | 함수·참조·원시값 | — | 그대로 |
| `ShareView` | views | 탭 store(getState) | — | 아니요 | 그대로 |

정리:

- `shared/ui`와 `entities/*/ui`에는 store를 부르는 컴포넌트가 없었다. 재사용하기 어려웠던 것은 `features`의 표현 컴포넌트(설정 팝업의 구역, item 속성 팝업, item 도구)였고, 모두 props로 받게 바꿨다.
- 고치기 전에는 매번 **새 참조**를 돌려주는 selector가 없었다. 문제는 넓은 구독(`itemJobs` 전체, `draft` 전체, `tabs` 전체)과 memo하지 않은 목록이었다. 이번에 처음 생긴 새 참조 selector(`TabBar`의 탭 id 목록)는 `useShallow`로 감쌌다.

## 렌더 횟수 (전 → 후)

테스트: `src/widgets/chart-grid/ui/ChartGrid.render.test.tsx`, `src/widgets/tab-bar/ui/TabBar.render.test.tsx`, `src/widgets/control-panel/ui/ControlPanel.render.test.tsx`. query layer를 mock하고, 컴포넌트가 렌더마다 한 번 부르는 hook(`useJob` = ChartGrid, `useJobItem` = 각 item, `useJobRange` = DetailView, `useColumns` = 각 탭 이름, `useSchemaState` = ControlPanel)으로 렌더 횟수를 센다. 진행률(`useJobProgress`)만은 mock하지 않고 실제 react-query cache에 응답을 넣어 `select`와 구조 공유까지 확인한다. grid는 item 9개, 탭 줄은 탭 3개다.

| 바꾼 것 | 전 | 후 |
| --- | --- | --- |
| item 하나 선택 | grid 0 · item 1 | grid 0 · item 1 |
| 다른 item 선택 | item 2 (전·새) | item 2 |
| item 하나 다시 그리기 시작(`setItemJob`) | **grid 1 · item 9** | grid 0 · item 1 |
| job 진행률 응답 | **grid 1 · item 9** | grid 0 · item 0 (하단 상태 줄만 1) |
| job이 끝남 (상태 바뀜) | — | grid 1 · item 0 |
| 같은 크기로 grid 영역 다시 잡힘 | **grid 1 · item 9** | grid 0 · item 0 |
| grid 영역 크기 바뀜 | grid 1 · item 9 | grid 1 · item 9 (모두 새 크기라 맞다) |
| 상관없는 draft 값 · 알림 | 0 | 0 |
| 크게 보는 중 다른 item 다시 그리기 | **grid 1 · detail 1** | grid 0 · detail 0 |
| 다른 탭으로 가기 | **탭 이름 3** | 0 |
| 탭 잠금 | **탭 이름 3** | 0 |
| 새 탭 열기 | **탭 이름 4** | 1 (새 탭만) |
| 탭 하나의 데이터 바꿈 | 1 | 1 |
| 필터·grid·공통 속성 바꿈 → `ControlPanel` | **1씩** | 0 |
| 패널이 보여주는 값(y) 바꿈 → `ControlPanel` | 1 | 1 |
| 다른 탭의 상관없는 값 · 필터 패널 열고 닫기 | 0 | 0 |

진행률 응답이 올 때마다 item 9개를 모두 다시 그리던 것이 가장 컸다. 그리는 동안 long polling 응답마다 한 번씩 일어난다. 지금은 react-query가 바뀌지 않은 item의 참조를 그대로 두므로(구조 공유) 상태가 바뀐 item만 다시 그리고, 진행률(완료 수·속도)은 하단 상태 줄(`JobProgressBar`)만 구독한다.

## 실제 앱에서 잰 렌더 횟수

위 테스트는 query layer를 mock한다. 실제 long polling 타이밍에서도 같은지 `next dev`로 띄운 앱을 Playwright로 조작해 쟀다. React DevTools hook 자리에 stub을 넣어 커밋마다 실제로 렌더 함수가 돈 컴포넌트(fiber의 PerformedWork)를 이름별로 센다. 처음 마운트는 세지 않고 **다시 그린 횟수**만 센다. 시나리오: 로그인 → IoT 10만 행 등록 → 적재가 끝난 뒤 hash 공유 링크로 scatter를 공장×라인 split(12개, 3×3 grid 첫 페이지 item 9개)으로 연다. 전은 develop, 후는 이 브랜치이고 각각 두세 번 돌렸다 (범위로 적는다).

| 구간 | 컴포넌트 | 전 (develop) | 1차 (구독 정리) | 후 (react-query까지) |
| --- | --- | --- | --- | --- |
| 차트를 열어 다 그릴 때까지 (약 5초) | item 본문 `DrawnItem` | 37–42 | 0 | 0 |
| | item 툴팁 `ItemTooltip` | 40–42 | 0 | 0 |
| | `ChartItemCard` (자리 표시 포함) | 135–144 | 39–72 | 39–46 |
| | memo 감싸개 `GridItem` (item 상태가 바뀔 때만) | — | 21–28 | 19–21 |
| | `ChartGrid` | 19–20 | 12–16 | 11–13 |
| | `DrawButton` | 21 | 16–21 | **8** |
| | `ControlPanel` | 5–6 | 6–10 | **3** |
| | `GridPicker` | 15 | 9–13 | **6** |
| | `DatasetSelect` | — | 6–7 | **3** |
| | 커밋 수 | 67–68 | 69–87 | **53–58** |
| 필터 패널 열기 | `DrawnItem` / `ItemTooltip` | 9 / 9–11 | 0 / 1 | 0 / 1 |
| | `ChartGrid`, `ControlPanel`, `GridPicker`, `TabBar` | 1씩 | 0 | 0 |
| | `DrawButton` | 3 | 2 | **0** |
| 다른 탭을 열었다가 돌아오기 | `DrawnItem` / `ItemTooltip` | 18 / 18 | 0 / 0 | 0 / 0 |
| item 하나 선택 / 다른 item 선택 | `DrawnItem` | 1 / 2 | 1 / 2 | 1 / 2 |

"후"의 `DrawButton` 8회는 모두 실제로 바뀐 값 때문이다: 차트를 여는 중(`opening`) 켜고 끔, 그린 차트(`current`)가 정해짐, mutation 시작과 끝, 스키마를 받음. `ChartGrid`는 페이지 item 상태(`useJob`)가 바뀔 때 다시 그린다.

### react-query에서 찾은 것

stub hook을 넓혀 다시 그린 까닭을 나눴다. props 객체가 그대로면 부모 때문이 아니라 자기 구독 때문이고, 그때 hook 목록에서 값이 바뀐 자리를 적는다. 두 가지가 나왔다.

- **렌더 중에 읽지 않은 query는 다시 받을 때마다 다시 그린다.** react-query는 렌더 중에 읽은 필드(`data`, `isError` 등)만 지켜보고, 하나도 읽지 않은 observer는 모든 변경을 알린다. 이때 `fetchStatus`(idle ↔ fetching)도 변경이다. `DrawButton`은 데이터셋 상태를 누를 때(`mutationFn`)만 읽었고, `useDrawState`·`GridPicker`는 진행률을 `opening ||`, `current &&` 뒤에서만 읽었다. 그래서 데이터셋 목록이나 진행률을 다시 받을 때마다 다시 그렸다. 데이터셋 목록은 그것을 쓰는 컴포넌트(item 툴팁 등)가 마운트될 때마다 다시 받는다. 지금은 고른 값을 조건 앞에서 늘 읽는다. `src/features/draw-chart/model/draw-state.render.test.tsx`가 이를 잡는다: 차트를 여는 동안 200ms에 진행률을 열 번 넘게 다시 받을 때, 고치기 전 57회 → 0회.
- **사이드바가 mutation을 들고 있었다.** `GallerySidebar`가 공유 링크 열기(`useOpenChart`의 mutation 상태, `gridArea`)를 직접 불러, 그 상태가 바뀔 때마다 설정 패널·draw 버튼·grid 고르기가 함께 다시 그려졌다.

hash 링크로 연 차트를 draw 버튼으로 다시 그려도 item 9개가 그대로 그려지고, 페이지 오류는 없었다.

## 바꾼 위임 구조

```
SettingsBody (features/chart-settings, 컨테이너: draft·readOnly·action 구독)
  ├─ CommonOptionSettings  ← defaults, readOnly
  └─ Color/Split/Legend/TooltipSettings  ← draft, readOnly

Workspace (views: view·보는 탭만)
  └─ FilterDrawer  (filterPanelOpen 구독은 여기만)

ControlPanel (widgets: 보여주는 draft 필드만 useShallow)
  └─ FitDraftToSchema  (draft 전체 구독은 여기만, 스키마에 맞게 바로잡기)

ChartGrid (widgets, 컨테이너: current·page·focus·gridArea, 진행률은 select로 개수·상태·오류만)
  ├─ AutoResize  (itemJobs 구독은 여기만)
  ├─ JobProgressBar  (진행률 전체 구독은 여기만)
  └─ GridItem (memo) ← item, index, displaySize(memo), onOpen=setFocus
       └─ DrawnItem (item 컨테이너: 자기 key로 고른 원시값 9개를 useShallow selector 하나로)
            ├─ PaintToolbar  ← tool, onToolChange
            ├─ LegendCheckboxes  ← shown
            └─ ItemSettingsDialog (widgets) ── ItemOptionsDialog  ← chartType, readOnly, busy

TabBar (widgets: 이 view의 탭 id[]를 useShallow로)
  └─ TabItem (memo, id로 자기 탭) ── TabLabel (memo, 그 탭 store만)
```

그 밖에 `setGridArea`는 크기가 같으면 state를 바꾸지 않는다 (ResizeObserver가 같은 크기로 알려도 구독자가 다시 그리지 않는다).

## analytics 보드

analytics(`/analytics`)는 보드 store(`entities/workspace/model/board-store.ts`, `BoardScope`/`useBoard`) 하나와 칸마다 작업 store(`createWorkspaceStore({ kind: "panel" })`)를 든다. 칸 안과 왼쪽 패널·도구 줄은 gallery 컴포넌트를 그대로 쓰므로, 칸은 `PanelScope`, 고른 칸은 `ActivePanelScope`로 감싸 `useWorkspace`가 그 칸을 보게 한다. 보드 위젯(`widgets/analytics-board`)은 칸 내용을 `renderPanel(panelId)`로 받는다(모듈에 고정한 함수라 참조가 바뀌지 않는다). 기준은 [analytics-spec.md](analytics-spec.md) 6장.

| 컴포넌트·hook | 레이어 | 고르는 값 | 반환 | 순수 UI여야 하나 | 조치 |
| --- | --- | --- | --- | --- | --- |
| `AnalyticsBoard` | widgets | 보드 `layout`, `panelIds`, `maximizedPanelId`, 잠금 까닭(`layoutBlock`), action | 참조·원시값·함수 | 아니요 (보드 컨테이너) | 칸의 draft·진행률은 고르지 않는다. 끄는 칸·놓을 자리는 자기 state. 경계를 끄는 동안에는 store를 쓰지 않고 DOM의 칸 자리만 바꾼다 |
| `PanelSlot` (칸 틀) | widgets | `selectPanelNumber(id)`, `selectIsActive(id)`, `selectIsMaximized(id)`, 옮기기·지우기 까닭, action | 원시값·함수 | 아니요 (목록 아이템) | `memo`. 부모는 칸 id·놓을 변만 넘긴다. 칸 내용은 `useMemo(() => renderPanel(id))`로 한 번 만들어 번호·활성 표시가 바뀌어도 다시 그리지 않는다 |
| `PanelFrame`, `DropZone`, `DragHandle`, `ResizeHandle`, `DropPreview`, `LayoutThumb` | widgets·features | — (props) | — | **예** | store를 부르지 않는다. 경계 끌기는 `onPreview`·`onCommit` 콜백, 끄는 동안 칸 크기 쓰기는 `shared/lib/size-hold`로 미룬다 |
| `PanelContent` | views | `selectIsActive(id)` | 원시값 | 아니요 | `memo`. 칸 id로 `PanelScope`를 열고 `PanelChart`를 그린다 |
| `PanelChart` | widgets | 칸 store `current.chartId`·`jobId`·`spec`, `opening`, `gridArea`, `setGridArea` | 원시값·참조·함수 | 아니요 (칸 컨테이너) | 진행률은 `select`로 상태·오류만(`panelProgress`). 크기 맞춤은 `PanelAutoResize`(`itemJobs` 구독)로 떼어 냄. item은 gallery의 `DrawnItem`(자기 key로 고른 원시값) |
| `PanelLabelText` | views | 칸 store `(current?.spec ?? draft)`의 차트 종류·서브 차트·데이터셋, 데이터셋 이름 | 원시값 | 아니요 | 칸 이름표만 다시 그린다 |
| `PanelJobs` → `PanelJobSync` | views | 보드 `panelIds`(`useShallow`) → 칸마다 그리는 중(`useDrawState`, `itemJobs` 비었는지), job 실패(`select`) | 참조·원시값 | 아니요 (`return null`) | 칸 job 상태를 보드 `busy`와 화면 store `failed`에 boolean으로 옮긴다. 보드·하단 줄은 그 boolean의 개수만 고른다 |
| `BoardStatusBar` | views | 칸 수, `busy` 개수, `failed` 개수, Render Worker 수 | 원시값 | 아니요 | 진행률 응답은 `ActiveProgress`(고른 칸의 `JobStatusBar`)만 구독한다 |
| `PanelHeading`, `ControlPanel`, `DrawButton`, `SettingsButton`, `FilterPanel` | views·widgets·features | 고른 칸 store의 값 (gallery와 같다) | 원시값·참조 | 아니요 | `ActivePanelScope`가 칸 id를 key로 다시 마운트해 이전 칸의 입력 중 값·mutation 결과가 새 칸에 남지 않는다 |
| `AnalyticsToolbar`의 `BoardModeBar`, `FilterToggle` | widgets | 보드 `mode`·`setMode` / 탭 store `filterPanelOpen`, 고른 칸의 필터 수 | 원시값·함수 | 아니요 | `ModeBar`는 보드 모드를 props로 받는다 |
| `DrawAllButton` | features | 잠금(`selectLayoutLocked`) | 원시값 | 아니요 | 그릴 칸·데이터셋 목록은 누를 때 `getState`·`getQueryData`로 읽는다 |
| `AddPanelButton`, `LayoutPresetButton`, `ClearBoardButton` | features | 막힌 까닭(`addPanelBlock`, `layoutBlock`) | 원시값 | 아니요 (동작 하나) | preset 비교용 레이아웃은 popover를 열 때 `getState`로 읽는다 |
| `BoardAutosave` | views | `hydrated` | 원시값 | 아니요 (`return null`) | 저장할 변경은 store `subscribe`로 듣고(`watchBoard`) 렌더하지 않는다 |
| `BoardGate` (`useBoardHydrate`) | views | `hydrated`, 보드 query | 원시값·참조 | 아니요 | 받은 뒤에는 children만 그린다 |
| `PanelSlot`의 연결 표시 | widgets | `selectLinkPeer(id)` (연결 버튼에 커서를 올린 칸과 이어져 있는지) | 원시값 | 아니요 | 연결 버튼은 `renderLink(panelId)`로 받아 `useMemo`로 한 번 만든다. 커서가 오가도 이어진 두 칸의 틀만 다시 그린다 |
| `PanelLinkButton` (이름표 연결 버튼) | features | `selectPanelNumber(id)`, `selectFollowNumber(id)`, `selectFollowerNumbers(id)`(`useShallow`), `linkErrors[id]`, 칸 store, 걸린 범위(`useItemLink`), 따를 칸 실패(`useFollowFailed`) | 원시값·참조 | 아니요 (동작 하나) | `memo`. 칸 id만 받는다. 범위·실패는 react-query `select`로 고른 값이라 진행률 응답에는 다시 그리지 않는다 |
| `LinkField` (왼쪽 패널 `따를 칸`) | features | 보드 `activePanelId`와 위와 같은 값 | 원시값·참조 | 아니요 | 고른 칸이 바뀔 때만 다른 칸 것으로 바뀐다 |
| `useItemLink` | features | 칸 store `current?.jobId` → draw job item 상태의 `link` | 원시값·참조 | — | 칸 차트(`PanelChart`)와 같은 페이지 크기(1)의 `useJob` query를 함께 쓴다 |
| `useFollowFailed` | features | 보드 `links[id].follow`의 칸 store → 그 칸 `current?.jobId`(`useSyncExternalStore`) → 진행률 query의 실패 여부(`select`) | 원시값 | — | 따를 칸의 draw가 실패하면 연결 버튼·창에 까닭을 보인다. `PanelJobSync`와 같은 query를 함께 쓴다 |
| `LinkPopover` → `LinkPopoverBody` | features | 보드 `links[id]`, `linkErrors[id]`, 칸 store, 이 칸 draft의 데이터셋·차트 종류·서브 차트(`useShallow`), 모든 칸의 차트 종류·데이터셋(`usePanelKinds`, 한 줄 글자로 견준다) | 원시값·참조 | 아니요 (팝업 컨테이너) | 본문은 열린 동안만 그려 모든 칸 store 구독도 그동안만 건다. 바뀐 것이 없으면 같은 글자라 다시 그리지 않는다 |
| `LinkSettings` | features | — (props) | — | **예** | store를 부르지 않는다. 따를 칸 목록·방식·연결 컬럼·상태 글자를 props로 받는다 |
| `LinkSync` → `LinkFit` → `FitLink` | features | 보드 `links`의 키 목록(`useShallow`) → 칸마다 `links[id].follow`, 두 칸 store → 따를 칸 데이터셋, 이 칸 draft의 데이터셋·차트 종류·서브 차트(`useShallow`), 두 스키마 | 원시값·참조 | 아니요 (`return null`) | 연결 맞추기(방식·연결 컬럼)만 한다. 연결 전파(`createLinkPropagation`)는 렌더 없이 보드·칸 store를 `subscribe`해 돌린다 |

렌더 횟수는 `src/widgets/analytics-board/ui/AnalyticsBoard.render.test.tsx`(칸 9개, 칸 내용을 색 상자로)와 `src/widgets/chart-grid/ui/PanelChart.render.test.tsx`(칸 둘)가 잡는다.

| 바꾼 것 | 보드 (`AnalyticsBoard`) | 칸 내용 |
| --- | --- | --- |
| 처음 그림 (3×3) | — | 칸마다 1 |
| 다른 칸 고름 | 다시 그리지 않음 (칸 틀 둘만) | 0 |
| 한 칸의 draft | 다시 그리지 않음 | 그 값을 고른 그 칸만 1 |
| 한 칸의 job 진행률 응답 | 다시 그리지 않음 | 0 |
| 한 칸의 item 다시 그리기 시작 | 다시 그리지 않음 | 그 칸의 item만 1 |
| 한 칸의 job이 끝남 | 다시 그리지 않음 | 그 칸만 |
| 경계를 끄는 동안 | 0 (커밋 없음) | 0, 칸 크기도 쓰지 않는다 |
| 경계를 놓음 · 화살표 키 | 다시 그림 (비율) | 0. 크기가 달라진 칸만 300ms 뒤 PNG를 다시 받는다 |
| 칸 옮기기(번호가 바뀜) · 칸 지우기 · 트리 모양 바뀜 | 다시 그림 | 0, 다시 마운트하지 않는다 |
| 최대화·되돌리기 | 다시 그림 | 0 (다른 칸은 크기를 둔 채 감춘다) |
| 그리는 칸이 생겨 잠김 | 다시 그림 (잠금 표시) | 0 |

`next dev`로 띄운 화면에서도 칸 추가·옮기기·최대화·경계 끌기·좁은 폭 전환 때 칸의 `<img>` 요소가 그대로이고(다시 마운트 없음), `POST /charts/:id/resize`가 크기가 달라진 칸에만 한 번씩 나가는 것을 확인했다.

## 남은 이슈

처음 점검에서 남긴 네 가지와 react-query 재렌더를 모두 처리했다.

- 데이터셋 목록 query는 `staleTime`이 0이라, 그것을 쓰는 컴포넌트가 새로 마운트될 때마다 다시 받는다 (그리는 동안 item이 그려질 때 등). 이제 다시 받아도 다시 그리지는 않지만 요청은 나간다. 목록은 바뀔 때 mutation이 무효화하고 적재 중에는 따로 polling하므로 `staleTime`을 늘려도 될 것 같다. 다만 동작(언제 새로 받는지)이 바뀌는 일이라 이번에는 하지 않았다.
- 모드·페인트 도구처럼 모든 item이 함께 쓰는 값이 바뀌면 item이 전부 다시 그려진다. 모든 item이 그 값을 보여야 하므로 맞는 동작이다.
- 실제 앱 측정은 저장소에 스크립트로 넣지 않았다 (Playwright가 의존성이 아니다). 방법은 위에 적었다.
