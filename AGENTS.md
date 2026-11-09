<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->

## 화면 구조는 모노레포 + FSD

pnpm workspace + Turborepo 모노레포다. `apps/web`(`@vis-a-lot/web`: 시각화·피드·공유·dev, 브라우저 안의 서버), `apps/help`(`@vis-a-lot/help`: `/help/**` 도움말), `packages/shared`(`@vis-a-lot/shared`: 두 앱이 함께 쓰는 shared 레이어, package.json의 `"vis-a-lot": { "fsd": true }`가 FSD 패키지 표식), 도구 패키지 `packages/tsconfig`·`packages/i18n-check`(FSD 밖, 앱을 import하지 않는다)로 나뉜다. 각 앱의 `src`는 FSD 레이어(`application`, `views`, `widgets`, `features`, `entities`, `shared`)로만 나눈다. 규칙과 배치 기준은 `docs/architecture.md`에 있다. 코드를 쓰기 전에, 그리고 스펙·계획 문서에 화면 위치를 적기 전에 읽는다.

- `src/<도메인>/` 같은 자체 폴더를 만들지 않는다. 역할별로 각 레이어의 slice에 나눠 넣는다.
- 위 레이어에서 아래 레이어로만 import한다. 같은 레이어의 다른 slice는 import하지 않는다.
- 앱은 다른 앱을 import하지 않는다. 두 앱이 함께 쓰는 코드는 `packages/shared`에 두고, 앱 `package.json`에 `"workspace:*"`로 선언한 패키지 이름(`@vis-a-lot/shared/…`)으로만 import한다. 상대 경로나 tsconfig paths로 우회하지 않는다.
- 다른 앱 화면으로 가는 링크(도움말 ↔ 시각화·피드)는 `next/link`가 아닌 `<a>`로 쓴다.
- `scripts/check-fsd.mjs`가 검사한다 (`pnpm lint`, husky pre-commit, Claude Code 훅). 막히면 우회하지 말고 위치나 import를 고친다. `--no-verify`, `HUSKY=0`은 쓰지 않는다.
- 명령은 루트에서 `pnpm build`·`pnpm lint`·`pnpm test`·`pnpm typecheck`(모두 `turbo run …`, 모든 앱·패키지), 앱 하나는 `pnpm exec turbo run <태스크> --filter=@vis-a-lot/web`(또는 `pnpm build:web`), 띄우기는 `pnpm dev`(web :3000, help :3001/help를 함께 띄운다)·`pnpm dev:web`·`pnpm dev:help`로 돌린다. 앱의 패키지 스크립트를 `pnpm --filter`로 바로 부르면 카탈로그(`i18n:compile`) 같은 선행 태스크가 돌지 않는다(앱 `build`는 "컴파일한 카탈로그가 없다"로 멈춘다). 순서는 `turbo.json`의 `dependsOn`에 적고, 패키지 스크립트에서 다른 패키지를 부르지 않는다 (`README.md`의 Turborepo).
- 바뀐 것만 돌릴 때는 `pnpm check:affected`를 쓴다. 루트 검사(`//#lint:fsd`·`//#lint:biome`·`//#lint:css`)는 `--affected`를 붙이면 루트 파일이 바뀔 때만 돌아 앱 파일 위반을 놓치므로 늘 전체로(캐시로 충분하다), 패키지 태스크만 `--affected`로 돌린다. 기준은 PR이 향하는 브랜치다: 작업 브랜치는 `TURBO_SCM_BASE=origin/develop`(`check:affected`의 기본값), `release/<버전>`은 `TURBO_SCM_BASE=origin/main`. 기준 없는 `--affected`(로컬 `main`)는 쓰지 않는다 (`docs/git-flow.md`).
- 번역 누락은 `build`에서만 멈춘다(`lingui check missing`). dev·test·typecheck는 엄격하지 않게 컴파일한 카탈로그로 돈다 (`docs/i18n.md`).
- 배포는 Vercel 프로젝트 둘(web·help)이다. web 프로젝트의 `vercel.json`이 `/help/**`를 help 프로젝트로 rewrite하고, help는 basePath 없이 `app/help/` 아래 라우트와 `assetPrefix: "/help"`를 쓴다. 프로젝트 설정은 `apps/*/vercel.json`, Build Command는 반드시 `turbo run build`다. 빌드가 `VERCEL_*`나 `NEXT_PUBLIC_`이 아닌 환경 변수를 새로 읽으면 `turbo.json`의 `env`에 더한다. 자세한 내용은 `docs/deploy.md`.
