# 스타일 규칙

화면 스타일은 Tailwind CSS v4 클래스로 쓴다. CSS 파일은 `app/globals.css` 하나뿐이고, 토큰(`@theme`)과 요소 기본값(`@layer base`)만 둔다. 규칙은 lint가 강제한다. 맨 아래 표에 어느 규칙을 무엇이 막는지 정리했다.

## 왜 이렇게 바꿨나

CSS Modules를 쓸 때도 클래스 이름은 겹치지 않았다. 스타일이 새어 나간 원인은 다른 데 있었다.

- 여러 기능이 파일 하나(`workspace.module.css`, 1,243줄)를 같이 import했다.
- `.modeBar button`, `.tooltip dd` 같은 자손 선택자가 안쪽 컴포넌트까지 스타일을 입혔다.

Tailwind에서는 스타일이 요소 자체에 붙으므로, 이 두 경로가 생기지 않게 막는 것이 핵심이다.

## 단위와 토큰

| 대상 | 규칙 |
|---|---|
| 글자 크기 | rem 토큰을 쓴다: `text-3xs`(10) `text-2xs`(11) `text-xs`(12) `text-ui`(13, 본문 기본) `text-sm`(14) `text-base`(16) `text-xl`(20). 크기마다 줄 높이가 짝지어 있다. 한 곳만 다르면 `text-xs/5`처럼 적는다. Tailwind와 같은 이름은 같은 값이다. |
| 간격·크기 | 기본 축척(`--spacing` = 0.25rem)을 쓰고 0.5 단계(`p-1.5`, `h-7.5`)까지만 쓴다. `p-1.25` 같은 0.25 단계는 쓰지 않는다. |
| radius | `rounded-xs`(2) `rounded-sm`(4) `rounded-md`(6) `rounded-lg`(8) `rounded-xl`(12) `rounded-full` |
| 색 | 쓰임새 이름 토큰만 쓴다: `surface` `panel` `elevated` `line` `fg` `fg-secondary` `fg-muted` `accent` `accent-soft` `accent-line` `on-accent` `danger` `overlay` `backdrop` `chart-*`, 섞은 색 `panel-subtle/hover/strong/active` `line-strong` `accent-soft-strong`. 투명도는 `bg-danger/12`처럼 적는다. 기본 팔레트(`bg-red-500`)는 꺼 두었다. |
| 그림자 | `shadow-xs` ~ `shadow-xl`, `shadow-card`, `shadow-drawer` |
| px | 1px 테두리·hairline 보정(`border`, `align-[-1px]`)에만 쓴다. |
| 임의 값 `[...]` | 축척으로 나타낼 수 없는 구조용 값에만 쓴다: grid 템플릿, `min()`/`calc()`, `ch`, `dvh`. 그 안의 길이도 rem으로 적는다(`w-[min(60rem,calc(100vw-2rem))]`). breakpoint도 rem으로 적는다. |
| 다크 모드 | `prefers-color-scheme`를 따른다. `:root`에서 같은 토큰 변수의 값을 바꾼다. |

## 구조

- 자식의 스타일은 자식 요소에 직접 단다. `*:`, `**:`, `[&_…]`는 쓰지 않는다.
- 부모의 상태에 따라 자식이 바뀌어야 하면 `group/이름` + `group-hover/이름:`을 쓴다.
- 상태는 `data-*`·`aria-*` 변형(`data-selected:`, `aria-pressed:`, `aria-current:`)으로 표시한다.
- 같은 속성을 두 상태가 함께 바꾸면 Tailwind의 변형 순서에 기대지 않는다. `data-highlighted:not-data-selected:`처럼 서로 겹치지 않게 적는다.
- 두 군데 이상에서 쓰는 모양은 `tv()` recipe로 묶고, 기능 간에 공유하면 `src/shared/ui`에 둔다.
  - 공유 recipe: `button`(primary·secondary·danger × sm·md·lg), `toolButton`, `itemButton`, `linkButton`, `selectStyles`, `segmented`, `settingsStyles`
- 클래스를 합칠 때는 `cn()`을 쓴다(`@/shared/lib/tw`). tailwind-merge가 `text-ui`를 색이 아니라 글자 크기로 읽도록 설정되어 있다.
- 클래스 이름은 완성된 문자열로 적는다. `` `grid-cols-${n}` ``처럼 조합하면 Tailwind가 찾지 못한다. 값이 몇 가지로 정해지면 표(`GRID_COLS`)나 `tv` variant로 고른다.
- 인라인 `style`은 런타임 값(가상 스크롤 위치, 좌표, 사용자가 고른 색)에만 쓴다.
- `!important`와 `@apply`는 쓰지 않는다.

## lint

| 도구 | 막는 것 |
|---|---|
| Biome `tailwind` 규칙 (`app/globals.css`를 읽는다) | 클래스 순서(`useTailwindSortedClasses`), 축약 가능한 쌍(`w-4 h-4` → `size-4`), v3 이름, 기본 팔레트 색, 조합한 클래스 문자열 |
| `biome-plugins/tailwind-classes.grit` | `[&_…]`·`*:` 변형, 토큰 밖 색(`bg-[#…]`), `!important` |
| `biome-plugins/tailwind-scale.grit` | 0.25 단계 간격, `[...]` 안의 px(1px 제외), 임의 radius·글자 크기 |
| Biome `noRestrictedImports` | `*.module.css` import |
| Stylelint (`*.css`) | 결합자·태그·전체·id 선택자, `:global`, `!important`, `globals.css` 밖의 색 값 |

`pnpm lint`가 Biome과 Stylelint를 차례로 돌린다. Biome 플러그인과 `tailwind` 규칙은 `className`, `cn()`, `tv()` 안의 문자열만 본다. 모듈 위쪽에 둔 클래스 문자열 상수는 검사하지 않는다.
