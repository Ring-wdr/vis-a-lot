# 순서 다중 선택(OrderedSelect) 라이브러리 비교: Base UI vs React Aria

`split by`, `tooltip`에 쓰는 공통 selectbox를 두 라이브러리로 각각 끝까지 만들어 보고, 같은 시나리오로 실제 브라우저에서 시험한 뒤 하나를 골랐다.

- 결론: **Base UI(`@base-ui/react` Combobox) + `@tanstack/react-virtual`**
- 비교 시점: 2026-10-20, 기준 커밋 `7791e1a` (`feature/workspace-tabs`, PR #16으로 병합)
- Base UI 구현(채택): `feature/ordered-select-base-ui`를 `188fddd`에서 `feature/workspace-tabs`에 병합해 PR #16으로 들어갔다.
- React Aria 구현(보관): 태그 `archive/ordered-select-react-aria`(`d9a62bc`). `git checkout archive/ordered-select-react-aria`로 열어 `/dev/select`에서 같은 시나리오를 돌려 볼 수 있다.

## 1. 요구사항

| 요구 | 내용 |
|---|---|
| multiple | 여러 개를 고르고, **고른 순서**를 유지한다 (split 조합 a-b-c 순서) |
| 가상 스크롤 | 옵션 10,000개 이상에서도 열기·스크롤·드래그가 버벅이지 않는다 |
| 드래그 순서 선택 | 항목을 누른 채 끌면 지나간 순서대로 선택된다 |
| 기타 | 검색 필터, 키보드, 순서 번호 칩(×로 빼기), `<fieldset disabled>`(history 보기 전용) |

드래그 선택은 잘 만들면 편하지만 잘못 만들면 UX가 망가진다. 그래서 규칙을 먼저 고정하고 두 구현이 똑같이 따르게 했다.

### 드래그 규칙
1. mouse/pen 주 버튼으로 누르면 시작 후보만 기록한다. 4px 미만으로 움직이고 떼면 클릭(토글)이다.
2. 드래그 모드는 **시작 항목 기준**이다. 안 고른 항목에서 시작하면 add, 고른 항목에서 시작하면 remove. 한 드래그 안에서 둘이 섞이지 않는다.
3. add는 안 고른 항목만 방문 순서대로 끝에 붙인다(이미 고른 항목은 그대로). remove는 고른 항목만 뺀다.
4. 빠르게 움직여 건너뛴 항목도 index 사이를 채워 빠짐이 없다.
5. 시작 쪽으로 되돌아오면 지나쳤던 변경을 되돌린다. 위로 끌면 위 방향 순서로 붙는다.
6. 가장자리 24px 안이나 밖에서는 자동 스크롤하고, 스크롤로 지나간 항목도 채운다.
7. 드래그 중 Esc는 시작 전 값으로 되돌리고 팝업은 열어 둔다.
8. 포인터가 목록 좌우 밖으로 나가도 세로 위치로 판정한다.
9. touch는 드래그 선택을 하지 않는다. 끌면 스크롤, 탭하면 토글이다.

두 구현 모두 판정을 라이브러리의 press 처리에 맡기지 않았다. listbox에 pointer capture를 잡고 `clientY`로 행 index를 계산하며, 상태 계산은 순수 reducer로 분리해 단위 테스트했다. 라이브러리가 대신해 주는 것은 팝업, 접근성, 키보드, 가상화이고, 드래그는 **양쪽 모두 직접 구현**이다. 그래서 비교의 핵심은 "직접 짠 드래그와 라이브러리 내장 동작이 얼마나 덜 부딪히는가"다.

## 2. 시험 결과

같은 Playwright 스크립트를 두 구현의 `/dev/select`(옵션 10,000개 인스턴스와 실제 컬럼 인스턴스)에 돌렸다.

### 기능 시나리오 19개
클릭 토글, 아래로 드래그, 빠른 드래그(건너뛰기), 되돌아가기, 위로 드래그, 기존 선택 뒤에 붙이기, add 모드에서 이미 고른 항목 보존, remove 모드, 드래그 중 Esc, 클릭 떨림(2px), 자동 스크롤, 자동 스크롤 후 되돌아오기, 좌우 밖 판정, 텍스트 선택 없음과 팝업 유지, 검색 후 드래그, 키보드, 칩 빼기, 가상 스크롤, 컬럼 인스턴스.

| | Base UI | React Aria |
|---|---|---|
| 결과 | **19 / 19** | **19 / 19** |

### 경계 시나리오 8개
가장자리에 걸친 항목 클릭, 휠 스크롤 직후 클릭·드래그, 자동 스크롤 직후 곧바로 두 번째 드래그, 위쪽 자동 스크롤, 오른쪽 버튼 무시, 드래그 성능, 닫았다 연 뒤 순서 배지 유지.

| | Base UI | React Aria |
|---|---|---|
| 결과 | **8 / 8** | **8 / 8** |

처음 실패했던 항목(S6·S9·E3·E4)은 모두 테스트가 화면 밖이나 가장자리 밖 행을 누른 탓이었다. 테스트를 고친 뒤 두 구현 모두 통과했다.

### 성능 (production 빌드, 옵션 10,000개, 5회 측정)

| | Base UI | React Aria |
|---|---|---|
| 팝업 열기 | 66–89ms | 89–109ms |
| 열 때 50ms 넘는 long task | **없음** (0/5) | **매번 1회, 57–63ms** (5/5) |
| 자동 스크롤 드래그 1.5초 동안 long task | 없음 | 없음 |
| 렌더된 option 수 | 20 | 13 |

dev 모드에서는 React Aria의 열기 long task가 약 220ms까지 늘었다. React Aria는 가상화를 해도 열 때 10,000개 전체로 collection을 만들기 때문으로 보인다. 옵션 수가 늘수록 열기 비용이 같이 커진다.

### 구현 규모

| | Base UI | React Aria |
|---|---|---|
| 추가 의존성 | `@base-ui/react` 1.9.0, `@tanstack/react-virtual` 3.14.21 | `react-aria-components` 1.22.1 |
| 컴포넌트 + 드래그 hook | 499줄 | 312 + 205줄 |
| 순수 reducer | 159줄 | 175줄 |
| reducer 단위 테스트 | 15개 | 21개 |
| 앱(`/`) 첫 로드 JS (압축 전) | 615KB | 688KB (+73KB) |

## 3. 라이브러리 내장 동작과의 충돌

### Base UI
문서에 있는 탈출구(escape hatch)로 대부분 해결했다.

| 충돌 | 해결 |
|---|---|
| 항목 click이 곧 선택이고, 키보드 Enter도 `element.click()`으로 들어온다 | `onClick`에서 실제 포인터 클릭(`e.detail > 0`)일 때만 `preventBaseUIHandler()`를 부른다. Enter는 그대로 통과시킨다 |
| 다른 곳에서 누르고 항목 위에서 떼면 선택되는 내장 동작 | `onMouseUp`에서 `preventBaseUIHandler()` |
| 필터 중 항목을 고르면 검색어가 지워진다 | `onInputValueChange`에서 `isItemPress`면 `cancel()` (문서에 나온 방법) |
| Esc·바깥 클릭으로 닫힘 | 드래그 중에만 `onOpenChange`를 `cancel()`하고, Esc는 window capture 단계에서 받는다 |
| 칩이 늘면 트리거 높이가 바뀌어 팝업이 따라 움직이고, 드래그 중 행이 밀린다 | Positioner `disableAnchorTracking` |
| 검색 입력이 Space를 먹는다 | 키보드로 가리킨 항목이 있을 때만 Space를 토글로 쓴다 |

도움이 된 점:
- pointerdown에서 이미 preventDefault를 해서 텍스트 선택과 검색 입력 blur가 처음부터 막혀 있다.
- 값이 배열이라 고른 순서를 그대로 담는다.
- 트리거가 native `<button>`이라 `<fieldset disabled>`가 그대로 적용된다.

### React Aria
막으려면 라이브러리 구조 자체를 우회해야 하는 경우가 많았다.

| 충돌 | 해결 |
|---|---|
| option이 마우스 pointerdown에서 바로 선택을 바꾼다 | listbox의 capture 단계에서 mouse/pen pointerdown을 가로채 option까지 가지 않게 한다 |
| 스크롤 중과 끝난 뒤 300ms 동안 목록 내용에 `pointer-events: none`이 걸려 누른 대상이 바뀐다 | 대상이 아니라 좌표로 행을 판정한다(스크롤바 영역 제외) |
| `ListBox`가 Esc로 선택을 전부 지운다 | `escapeKeyBehavior="none"` |
| Autocomplete가 Space를 목록에 넘기지 않고, `aria-activedescendant`가 한 박자 늦게 갱신된다 | `[data-focused]`로 가리킨 항목을 찾고 `disableAutoFocusFirst`를 켠다 |
| 칩이 늘어 팝업이 움직인다. 위치 갱신을 끄는 옵션은 첫 위치 계산까지 막는다 | 열 때의 위치로 **숨은 기준점 요소**를 만들어 `triggerRef`로 넘긴다 |
| modal 팝업이 바깥을 inert로 막아 열린 채 칩 ×를 누를 수 없다 | **non-modal로 바꾸고** 바깥 클릭 닫기, 포커스 지키기, 트리거 재클릭 처리를 직접 짠다 |
| Button이 바깥 `<fieldset disabled>`를 확인하지 않는다 | 모든 조작에서 트리거의 `:disabled`를 직접 확인한다 |
| Select 트리거가 버튼 하나라 칩의 ×(버튼)를 넣을 수 없고, 값이 `Set`이라 순서가 없다 | DialogTrigger + Popover + Autocomplete + ListBox로 조립하고, 순서 배열을 따로 관리한다 |

도움이 된 점:
- 가상화(`Virtualizer` + `ListLayout`)가 내장이라 의존성이 하나다.
- 터치는 손대지 않아도 탭은 토글, 스와이프는 스크롤로 동작했다(Playwright 에뮬레이션으로 확인).
- 팝업이 닫히면 트리거로 포커스를 돌려주고, 공간이 모자라면 팝업을 위로 뒤집는 등 접근성 마감이 좋다.

## 4. 결론: Base UI

1. **기능은 동점(27 / 27)**: 두 구현 모두 명세의 드래그 규칙을 지킨다. 결과를 가른 것은 기능이 아니라 유지보수 위험과 성능이다.
2. **우회의 깊이**:
   - Base UI는 `preventBaseUIHandler`, `eventDetails.cancel()`, `disableAnchorTracking`처럼 **문서화된 공개 API**로 내장 동작을 하나씩 끈다.
   - React Aria는 modal을 non-modal로 바꾸고, 바깥 클릭·포커스 복귀·fieldset disabled 확인을 다시 짜고, 숨은 기준점 요소로 팝업 위치를 붙잡는다. 라이브러리가 해 주던 일을 다시 떠안는 방식이다.
   - 라이브러리를 올릴 때 깨질 지점이 React Aria 쪽에 더 많고, 그 지점이 바로 드래그 UX가 망가지는 곳이다.
3. **성능**: React Aria는 10,000개 목록을 열 때마다 60ms(production)에서 220ms(dev)의 long task가 생긴다. split 조합 대상 컬럼이 늘어나는 B2B 데이터에서는 이 비용이 그대로 체감 지연이 된다. Base UI는 측정 내내 long task가 없었다.
4. **데이터 모델**: Base UI의 `value`는 배열이라 "고른 순서"를 그대로 담는다. React Aria는 `Set` 위에 순서 배열을 따로 얹어야 한다.
5. **번들**: 앱 첫 로드 JS가 Base UI 쪽이 약 73KB 작다(압축 전).

### 남은 위험 (Base UI 채택 시)
- touch 스와이프가 "선택 없이 스크롤"로 동작하는지는 **실제 기기에서 확인하지 않았다**(탭 토글은 에뮬레이션 통과). React Aria는 이 부분이 내장이었다. 모바일 대응이 필요해지면 먼저 확인한다.
- 행 높이(28px)를 상수로 두고 index를 계산한다. 행 높이를 바꾸면 TanStack Virtual의 `estimateSize`와 함께 바꿔야 한다.
- 팝업 위치를 고정했기 때문에 칩이 여러 줄로 늘면 팝업이 필드 아래쪽 일부를 덮는다. 순서는 목록의 배지로 보인다. React Aria 구현도 같은 trade-off다.
- `preventBaseUIHandler`로 끈 내장 동작(item click, mouseup 선택)은 Base UI를 올릴 때 이름이나 동작이 바뀌지 않았는지 `/dev/select`와 이 문서의 시나리오로 다시 확인한다.

## 5. 다시 시험하는 법
- `pnpm dev` 후 `/dev/select`에서 `대량`(10,000개)과 `컬럼` 인스턴스로 직접 확인한다. 각 인스턴스 아래 `<output>`에 현재 값이 보인다.
- 드래그 규칙은 `src/shared/lib/drag-select.test.ts`가 고정한다.
