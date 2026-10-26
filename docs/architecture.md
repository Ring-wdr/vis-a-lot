# 화면 구조 (FSD)

`src`는 [Feature-Sliced Design](https://feature-sliced.design) 레이어로만 나눈다. Next의 `app/`·`pages/`와 겹치지 않게 FSD의 `app`은 `application`, `pages`는 `views`로 이름만 바꿨다.

`scripts/check-fsd.mjs`가 아래 규칙을 검사한다. `pnpm lint`, husky `pre-commit`, Claude Code 훅(`.claude/hooks/check-fsd.mjs`)이 이 스크립트를 쓴다.

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

## 어디에 둘지

- 도메인마다 `src/<도메인>/` 아래 자체 레이어를 만들지 않는다 (예: `src/feed/{views,ui,api}`). 역할별로 각 레이어의 slice에 나눠 넣는다. 피드는 `views/feed-*`, `widgets/post-detail`, `features/create-post`, `entities/post`, `shared/api/feed`처럼 흩어져 있다.
- 한 페이지에서만 쓰는 코드는 그 view slice 안에 둔다 (`views/feed-new-post/model/payload.ts`).
- 두 slice가 함께 쓰는 코드는 아래 레이어로 내린다. view 둘이 쓰는 skeleton은 entity·widget으로, entity 둘이 쓰는 정적 표는 `shared/config`로 간다 (`shared/config/chart-kinds.ts`).
- 서로 다른 slice를 엮는 일은 위 레이어가 한다. widget이 다른 widget을 넣어야 하면 `application`이나 view에서 조합한다.
- API 요청과 query는 `shared/api`에 둔다 (`shared/api/queries.ts`, `shared/api/feed/*`).

## 계획·스펙 문서

스펙이나 계획에 화면 코드 위치를 적을 때는 위 레이어 위치로 적는다. 병렬 작업이 편하다는 이유로 도메인 폴더를 만들지 않는다.
