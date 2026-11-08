# 화면 구조 (모노레포 + FSD)

저장소는 pnpm workspace 모노레포다. 앱 둘, 두 앱이 함께 쓰는 FSD 패키지 하나, 개발 도구 패키지로 나뉜다. 작업 순서와 캐시는 Turborepo(`turbo.json`)가 맡는다.

| 위치 | 패키지 이름 | 두는 것 |
| --- | --- | --- |
| `apps/web` | `@vis-a-lot/web` | 시각화(`/`), 피드(`/feed/**`), 공유(`/share`), dev 화면, 브라우저 안의 서버(`server/`, MSW worker `public/`) |
| `apps/help` | `@vis-a-lot/help` | 도움말(`/help/**`): 라우트, 화면, 본문(`content/help`), MDX 설정 |
| `packages/shared` | `@vis-a-lot/shared` | FSD 패키지(`package.json`에 `"vis-a-lot": { "fsd": true }`). 두 앱이 함께 쓰는 FSD `shared` 레이어: 언어·테마(`config`, `lib`), Lingui instance, `tw`, 공통 UI(`Localized`, `StableText`, `nav`, 화면 설정 `PreferencesMenu`), 디자인 토큰 `ui/globals.css`, 도움말 경로 `config/help-routes.ts` |
| `packages/tsconfig` | `@vis-a-lot/tsconfig` | 도구 패키지. 공통 TypeScript 설정 `base.json` (`"extends": "@vis-a-lot/tsconfig/base.json"`) |
| `packages/i18n-check` | `@vis-a-lot/i18n-check` | 도구 패키지. Lingui 카탈로그 검사 bin `vis-a-lot-i18n-check` ([i18n.md](i18n.md)) |

두 앱은 같은 사이트의 경로로 나뉜다 (`/help/**`는 help, 나머지는 web). Vercel Microfrontends로 묶는데 Next의 `basePath`는 지원하지 않으므로, 도움말 앱도 `basePath` 없이 라우트를 `app/help/` 아래에 둔다. 경로 구성(`apps/web/microfrontends.json`)과 배포는 [deploy.md](deploy.md)에 있다.

- 앱은 쓰는 내부 패키지를 자기 `package.json`에 `"@vis-a-lot/shared": "workspace:*"`로 선언하고 패키지 이름으로 import한다 (`@vis-a-lot/shared/ui/nav`). 배포는 package.json의 의존 그래프로 바뀐 앱만 다시 빌드하므로, 상대 경로(`../../packages/…`)나 tsconfig paths로 우회하면 바뀐 코드가 빌드에서 빠진다.
- 앱은 다른 앱을 import하지 않는다. 두 앱이 함께 쓰는 코드는 `packages/shared`로 옮긴다. 한 앱만 쓰는 shared 코드는 그 앱의 `src/shared`에 둔다 (API client, MSW, 도움말 목차 등).
- 다른 앱의 화면으로 가는 링크(도움말 ↔ 시각화·피드)는 `next/link`가 아닌 일반 `<a>`로 쓴다. 같은 앱 안의 링크만 `next/link`로 쓴다.
- 의존성은 그 앱·패키지가 실제로 쓰는 것만 자기 `package.json`에 둔다. TypeScript도 `tsc`·`next`를 돌리는 앱·패키지마다 같은 버전으로 선언한다. 저장소 전체를 보는 개발 도구(Biome, Stylelint, turbo, husky)만 루트에 둔다.
- 앱·패키지가 함께 쓰는 설정·스크립트도 루트 파일을 상대 경로(`../../…`)로 가리키지 않고 도구 패키지(`packages/<도구>`)로 만들어 `devDependencies`에 `"workspace:*"`로 선언한다. 그래야 turbo 캐시와 배포의 의존 그래프가 그 파일이 바뀐 것을 안다. 도구 패키지에는 FSD 레이어가 없어 `scripts/check-fsd.mjs`가 레이어를 보지 않는다. 도구 패키지는 앱(`@vis-a-lot/<앱>`)을 import하지 않는다(검사한다). 앱·패키지가 도구 패키지를 import해도 레이어 검사는 하지 않고 선언했는지만 본다.
- `packages/*` 중 FSD 패키지는 `package.json`의 `"vis-a-lot": { "fsd": true }`로 고른다. 표식이 없으면 도구 패키지다. `scripts/check-fsd.mjs`와 `vis-a-lot-i18n-check`가 이 표식으로 판별하므로 FSD 패키지를 새로 만들 때 경로를 스크립트에 적지 않는다 (Biome의 `noRestrictedImports`는 `packages/*/<segment>/**`로 고른다).
- 앱·패키지 사이 순서는 turbo 태스크의 `dependsOn`으로만 적는다. 패키지 스크립트에서 `pnpm --filter <다른 패키지>`를 부르거나 다른 패키지 폴더에 파일을 쓰지 않는다. 공유 패키지의 컴파일 카탈로그는 `@vis-a-lot/shared`의 `i18n:compile`이 만들고, 앱의 태스크는 `^i18n:compile`로 그것을 먼저 돌린다. 공유 패키지의 엄격한 i18n 검사는 `build`에 있고 앱의 `build`가 `^build`로 먼저 돌린다.

각 앱의 `src`는 [Feature-Sliced Design](https://feature-sliced.design) 레이어로만 나눈다. Next의 `app/`·`pages/`와 겹치지 않게 FSD의 `app`은 `application`, `pages`는 `views`로 이름만 바꿨다. `@/*`는 그 앱의 `src/*`다.

`scripts/check-fsd.mjs`가 모든 앱의 `src`·`app`과 FSD 패키지(`packages/shared`)에 아래 규칙을 검사한다(도구 패키지는 앱 import와 선언만 본다). `pnpm lint`(turbo 루트 태스크 `//#lint:fsd`), husky `pre-commit`, Claude Code 훅(`.claude/hooks/check-fsd.mjs`)이 이 스크립트를 쓴다.

## 레이어

위에서 아래로만 import한다. 같은 레이어의 다른 slice는 import하지 않는다.

| 레이어        | 두는 것                                                                         | 나누는 방법                  |
| ------------- | ------------------------------------------------------------------------------- | ---------------------------- |
| `application` | 진입(`*-root.tsx`, `*-client-app.tsx`), Provider, 세션·부팅 게이트, 화면 틀(셸) | slice 없이 파일만            |
| `views`       | 라우트 페이지 하나                                                              | `views/<페이지>/<segment>/`  |
| `widgets`     | 여러 feature·entity를 조합한 큰 블록 (상세 패널, 보드, 팔레트)                  | `widgets/<블록>/<segment>/`  |
| `features`    | 사용자 동작 하나 (게시물 만들기, 필터, 사용자 전환)                             | `features/<동작>/<segment>/` |
| `entities`    | 업무 대상 (post, user, chart)과 그 표시·규칙                                    | `entities/<대상>/<segment>/` |
| `shared`      | 업무와 무관한 코드, API client·query, 정적 설정 표                              | `shared/<segment>/`          |

segment는 `ui`, `model`, `api`, `lib`, `config` 중 하나다.

`app/`(Next 라우트)은 얇게 둔다. `application`, `views`, `shared`만 import한다.

### 공유 패키지 (`packages/shared`)

`packages/shared`는 두 앱의 `shared` 레이어다. 앱에서 `@vis-a-lot/shared/<segment>/…`를 import하면 검사는 `shared` 레이어로 본다. 그래서 어느 레이어(와 `app/`)에서든 import할 수 있다.

- 패키지 바로 아래 폴더가 segment다 (`packages/shared/ui/nav.ts`). 패키지 바로 아래에는 설정 파일(`package.json`, `lingui.config.ts` 등)만 둔다.
- 패키지 안은 상대 경로로 import한다. 앱의 별칭 `@/`, 패키지 이름(`@vis-a-lot/…`), 패키지 밖을 가리키는 상대 경로는 쓰지 않는다. 패키지는 앱을 모른다.
- 화면 설정(`PreferencesMenu`, `ThemeSelect`, `LocaleSelect`)은 업무와 무관하고 두 앱이 함께 쓰므로 feature가 아닌 `packages/shared/ui`에 둔다.
- 문구는 패키지의 카탈로그 하나(`packages/shared/config/locales`)에 둔다 ([i18n.md](i18n.md)).

## 어디에 둘지

- 도메인마다 `src/<도메인>/` 아래 자체 레이어를 만들지 않는다 (예: `apps/web/src/feed/{views,ui,api}`). 역할별로 각 레이어의 slice에 나눠 넣는다. 피드는 `apps/web/src`의 `views/feed-*`, `widgets/post-detail`, `features/create-post`, `entities/post`, `shared/api/feed`처럼 흩어져 있다.
- 새 화면은 그 경로를 내보내는 앱에 둔다. `/help/**`는 `apps/help`, 그 밖은 `apps/web`이다. 앱을 새로 나누는 일은 이 문서와 배포 설정을 함께 바꾸는 별도 작업이다.
- 두 앱이 함께 쓰게 된 shared 코드는 `packages/shared`로 옮긴다. shared보다 위 레이어(entities, features 등)를 두 앱이 함께 쓰게 되면 패키지로 올리기 전에 먼저 구조를 상의한다.
- 한 페이지에서만 쓰는 코드는 그 view slice 안에 둔다 (`views/feed-new-post/model/payload.ts`).
- 두 slice가 함께 쓰는 코드는 아래 레이어로 내린다. view 둘이 쓰는 skeleton은 entity·widget으로, entity 둘이 쓰는 정적 표는 `shared/config`로 간다 (`apps/web/src/shared/config/chart-kinds.ts`).
- 서로 다른 slice를 엮는 일은 위 레이어가 한다. widget이 다른 widget을 넣어야 하면 `application`이나 view에서 조합한다.
- API 요청과 query는 `shared/api`에 둔다 (`shared/api/queries.ts`, `shared/api/feed/*`).

## 계획·스펙 문서

스펙이나 계획에 화면 코드 위치를 적을 때는 앱과 위 레이어 위치로 적는다 (`apps/web/src/views/feed-board`). 병렬 작업이 편하다는 이유로 도메인 폴더를 만들지 않는다.

## 상태 위임

zustand store(`useWorkspace`, `useTabs`)는 컨테이너가 구독한다. 컨테이너는 views, widgets, features의 컴포넌트 중 상태를 모아 화면을 꾸리는 쪽이다 (`ChartGrid`, `DrawnItem`, `SettingsBody`). 표현만 하는 컴포넌트는 store를 부르지 않는다. `shared/ui`, `entities/*/ui`, 그리고 features 안의 표현 컴포넌트(설정 팝업의 구역, item 도구 줄)가 여기에 든다. 이런 컴포넌트는 값과 콜백을 props로 받는다. 그래야 다른 scope나 테스트에서 그대로 쓸 수 있고, 값이 어디서 오는지 컨테이너만 보면 알 수 있다.

selector는 원자 단위로 고른다. 필요한 필드나 boolean을 고르고(`s.itemJobs[key] !== undefined`), 렌더에 쓰지 않는 값은 핸들러 안에서 `store.getState()`로 읽는다. selector가 `filter`·`map`·객체 리터럴로 새 참조를 만들면 `useShallow`(`zustand/react/shallow`)로 감싼다. action은 `useWorkspace((s) => s.setX)`로 꺼내면 참조가 바뀌지 않는다. 응답마다 바뀌는 react-query 값(job 진행률)도 같다. 쓰는 값만 `select`로 고르고, 응답 전체가 필요한 표시는 작은 컴포넌트로 떼어 그것만 구독하게 한다. react-query 결과는 렌더 중에, 조건(`&&`·`||`) 앞에서 읽는다. 렌더 중에 하나도 읽지 않은 query는 쓰는 필드를 알 수 없어 다시 받을 때마다(fetchStatus가 바뀔 때마다) 다시 그린다. mutation이나 query를 들고 있을 뿐 그리지 않는 일은 `return null` 컴포넌트로 떼어, 그 상태가 바뀌어도 형제 컴포넌트가 다시 그려지지 않게 한다. 목록은 부모가 id(또는 react-query가 참조를 지켜 주는 item)만 넘기고, `memo`한 아이템이 자기 상태를 직접 고른다. 렌더 횟수 회귀는 `*.render.test.tsx`가 잡는다 ([state-subscriptions.md](state-subscriptions.md)).
