# zustand 구독 점검

작업 상태는 zustand store 두 종류에 있다. 탭 목록과 탭 사이 상태는 탭 store(`entities/workspace/model/tabs-store.ts`, `TabsScope`/`useTabs`)에, 탭 하나의 작업 상태는 작업 store(`workspace-store.ts`, `WorkspaceScope`/`useWorkspace`)에 있다. 이번 점검에서는 store를 누가 구독하는지 정리하고, 렌더 횟수를 잰 뒤 구독 구조를 고쳤다. 상태를 어디서 넘겨주는지에 대한 기준은 [architecture.md](architecture.md#상태-위임)에 적었다.

## 감사

반환 표기: **원시값**(boolean·number·string), **참조**(state 안의 객체·배열을 그대로 돌려준다. 그 필드가 바뀔 때만 참조가 바뀐다), **함수**(action. store를 만들 때 정해져 바뀌지 않는다), **새 참조**(selector가 부를 때마다 새 객체·배열을 만든다. `useShallow` 없이 쓰면 store가 바뀔 때마다 다시 그리고, React가 무한 렌더로 본다).

| 컴포넌트·hook | 레이어 | 고르는 값 | 반환 | 순수 UI여야 하나 | 조치 |
| --- | --- | --- | --- | --- | --- |
| `Workspace` | views | `view`, 보는 탭(`find`), `emptyHistory`, `filterPanelOpen` | 원시값·참조 | 아니요 (조합) | 그대로 |
| `useOpenSharedLink`, `TabNotices`, `DrawLock`, `HistorySidebar` | views | `gridArea`, store, `readOnly`, `current !== undefined` | 참조·원시값 | 아니요 | 그대로 |
| `AppHeader` | widgets | `view`, `locked`, `setView`(getState) | 원시값 | 아니요 | 그대로 |
| `TabBar` | widgets | **전: `tabs` 배열 전체**, `active[view]`, `locked` | 참조 | 아니요 | 이 view의 탭 id만 `useShallow`로 고른다 |
| `TabLabel` | widgets | 그 탭 store의 `current?.spec`, `draft.dataset` | 참조·원시값 | 아니요 | `memo` |
| `TabItem` (새로 나눔) | widgets | id로 자기 탭, `activate`, `close` | 참조·함수 | 아니요 | `memo`, 자기 데이터를 직접 고른다 |
| `FilterToggle` | widgets | `filterPanelOpen`, `toggleFilterPanel`, `draft.filters?.length` | 원시값·함수 | 아니요 | 그대로 |
| `ChartGrid` | widgets | `current`, `readOnly`, `opening`, `draft.grid`, `page`, `focus`, `gridArea`, action | 참조·원시값·함수 | 아니요 | `useAutoResize`를 떼어 냄, `displaySize` memo, item을 `GridItem`(memo)으로 |
| `useAutoResize` | features | **`itemJobs` 전체**, `setItemJob` | 참조 | — | `ChartGrid` 본문 밖 `AutoResize` 컴포넌트에서 부른다 |
| `DrawnItem` (`ChartItemCard`) | widgets | `mode`, `paintTool`, `readOnly`, `itemJobs[key]`, `selectedItem === key`, `undoCounts[key]`, 차트 종류·legend 위치 | 원시값·함수 | 아니요 (item 컨테이너) | 체크박스 표시·페인트 도구를 골라 아래로 넘긴다 |
| `DetailView` | widgets | **`itemJobs` 전체**, `setFocus` | 참조 | 아니요 | 보는 item의 `itemJobs[key] !== undefined`만 고른다 |
| `ItemSettingsDialog` | widgets | `readOnly`, `current?.spec.common`, 차트 종류 | 원시값·참조 | 아니요 | 다시 그리는 중(`busy`)도 골라 팝업에 넘긴다 |
| `ControlPanel` | widgets | `draft`, `updateDraft`, `readOnly` | 참조 | 아니요 (설정 전부를 편집) | 그대로 |
| `FilterPanel`, `HistoryList`, `HomeLanding` | widgets | 필터·데이터셋·action 등 | 원시값·참조·함수 | 아니요 | 그대로 |
| `ItemOptionsDialog` | features | 차트 종류, `readOnly`, `itemJobs[key]` | 원시값 | **예** | store 호출을 빼고 props로 받는다 |
| `ColorSettings`, `SplitSettings`, `LegendSettings` | features | **`draft` 전체** | 참조 | **예** (설정 팝업의 구역) | store 호출을 빼고 `draft` prop으로 받는다 |
| `TooltipSettings`, `CommonOptionSettings` | features | `draft.chartType` | 원시값 | **예** | store 호출을 빼고 `draft`·`defaults` prop으로 받는다 |
| `SettingsDialog` (`SettingsBody`) | features | `draft`, `readOnly`, action | 참조·함수 | 아니요 (팝업 컨테이너) | 구역들에 값을 내려 준다 |
| `PaintToolbar` | features | `paintTool`, `setPaintTool` | 원시값·함수 | **예** (item 도구) | `tool`·`onToolChange` props |
| `LegendCheckboxes` | features | `showLegendCheckboxes && supports(...)` | 원시값 | **예** (item 도구) | `shown` prop |
| `GridPicker` | features | **`draft` 전체**, `current`, **`page`**, **`gridArea`**, action | 참조 | 아니요 | `draft.grid`만 구독, `page`·`gridArea`는 누를 때 getState |
| `DrawButton` | features | `draft`, **`gridArea`**, `current`, action | 참조 | 아니요 | `gridArea`는 boolean으로, 크기는 누를 때 getState |
| `ModeBar`, `ChartActionBar`, `ShareButton`, `FeedPostButton`, `EditInGalleryButton`, `ColumnFilter`, `DatastoreDialog` | features | 원자 단위 값, `current`, action | 원시값·참조·함수 | 아니요 (동작 하나) | 그대로 |
| `ItemTooltip` | features | 데이터셋, `showNearest`, `current?.spec` | 원시값·참조 | 아니요 | 그대로 |
| `useItemAction`, `useItemDetail`, `useDrawState`, `useOpenChart`, `useWorkspaceMutationKey` | features·entities model | action, `current`, `opening`, `id` | 함수·참조·원시값 | — | 그대로 |
| `ShareView` | views | 탭 store(getState) | — | 아니요 | 그대로 |

정리:

- `shared/ui`와 `entities/*/ui`에는 store를 부르는 컴포넌트가 없었다. 재사용하기 어려웠던 것은 `features`의 표현 컴포넌트(설정 팝업의 구역, item 속성 팝업, item 도구)였고, 모두 props로 받게 바꿨다.
- 고치기 전에는 매번 **새 참조**를 돌려주는 selector가 없었다. 문제는 넓은 구독(`itemJobs` 전체, `draft` 전체, `tabs` 전체)과 memo하지 않은 목록이었다. 이번에 처음 생긴 새 참조 selector(`TabBar`의 탭 id 목록)는 `useShallow`로 감쌌다.

## 렌더 횟수 (전 → 후)

테스트: `src/widgets/chart-grid/ui/ChartGrid.render.test.tsx`, `src/widgets/tab-bar/ui/TabBar.render.test.tsx`. query layer를 mock하고, 컴포넌트가 렌더마다 한 번 부르는 hook(`useJob` = ChartGrid, `useJobItem` = 각 item, `useJobRange` = DetailView, `useColumns` = 각 탭 이름)으로 렌더 횟수를 센다. grid는 item 9개, 탭 줄은 탭 3개다.

| 바꾼 것 | 전 | 후 |
| --- | --- | --- |
| item 하나 선택 | grid 0 · item 1 | grid 0 · item 1 |
| 다른 item 선택 | item 2 (전·새) | item 2 |
| item 하나 다시 그리기 시작(`setItemJob`) | **grid 1 · item 9** | grid 0 · item 1 |
| job 진행률 응답 | **grid 1 · item 9** | grid 1 · item 0 |
| 같은 크기로 grid 영역 다시 잡힘 | **grid 1 · item 9** | grid 0 · item 0 |
| grid 영역 크기 바뀜 | grid 1 · item 9 | grid 1 · item 9 (모두 새 크기라 맞다) |
| 상관없는 draft 값 · 알림 | 0 | 0 |
| 크게 보는 중 다른 item 다시 그리기 | **grid 1 · detail 1** | grid 0 · detail 0 |
| 다른 탭으로 가기 | **탭 이름 3** | 0 |
| 탭 잠금 | **탭 이름 3** | 0 |
| 새 탭 열기 | **탭 이름 4** | 1 (새 탭만) |
| 탭 하나의 데이터 바꿈 | 1 | 1 |
| 다른 탭의 상관없는 값 · 필터 패널 열고 닫기 | 0 | 0 |

진행률 응답이 올 때마다 item 9개를 모두 다시 그리던 것이 가장 컸다. 그리는 동안 long polling 응답마다 한 번씩 일어난다. 지금은 react-query가 바뀌지 않은 item의 참조를 그대로 두므로(구조 공유) 상태가 바뀐 item만 다시 그린다.

## 바꾼 위임 구조

```
SettingsBody (features/chart-settings, 컨테이너: draft·readOnly·action 구독)
  ├─ CommonOptionSettings  ← defaults, readOnly
  └─ Color/Split/Legend/TooltipSettings  ← draft, readOnly

ChartGrid (widgets, 컨테이너: current·page·focus·gridArea 구독)
  ├─ AutoResize  (itemJobs 구독은 여기만)
  └─ GridItem (memo) ← item, index, displaySize(memo), onOpen=setFocus
       └─ DrawnItem (item 컨테이너: 자기 key로 itemJobs[key]·selected·undoCounts[key] 구독)
            ├─ PaintToolbar  ← tool, onToolChange
            ├─ LegendCheckboxes  ← shown
            └─ ItemSettingsDialog (widgets) ── ItemOptionsDialog  ← chartType, readOnly, busy

TabBar (widgets: 이 view의 탭 id[]를 useShallow로)
  └─ TabItem (memo, id로 자기 탭) ── TabLabel (memo, 그 탭 store만)
```

그 밖에 `setGridArea`는 크기가 같으면 state를 바꾸지 않는다 (ResizeObserver가 같은 크기로 알려도 구독자가 다시 그리지 않는다).

## 남은 이슈

- `ControlPanel`은 `draft` 전체를 구독한다. 설정 전부를 편집하는 폼이라 필요하지만, 필드마다 나누면 입력할 때 다시 그리는 범위를 더 줄일 수 있다.
- `ChartGrid`는 진행률 응답마다 다시 그려진다 (하단 상태 줄·페이지 수가 그 값을 쓴다). item은 memo로 막았다. 상태 줄을 별도 구독 컴포넌트로 떼면 grid 본문도 다시 그리지 않는다.
- `DrawnItem`은 `useWorkspace`를 10번 넘게 부른다. 각각 원자 단위라 정확하지만, 모드·도구처럼 모든 item이 함께 쓰는 값은 바뀔 때 item 전체가 다시 그려진다 (그 값을 보여야 하므로 맞는 동작이다).
- 렌더 테스트는 query layer를 mock한다. 실제 long polling 타이밍은 앱에서 확인해야 한다.
