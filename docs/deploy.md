# 배포 (Vercel 프로젝트 둘 + rewrite)

두 앱을 Vercel 프로젝트 둘로 따로 빌드·배포한다. 사용자가 여는 도메인은 web 프로젝트에 붙이고, web 프로젝트가 `/help/**`를 help 프로젝트로 [rewrite](https://vercel.com/docs/rewrites)해 같은 도메인에서 도움말을 연다. 커밋마다 바뀐 앱만 빌드한다([skip unaffected projects](https://vercel.com/docs/monorepos#skipping-unaffected-projects)).

| Vercel 프로젝트 | Root Directory | 맡는 경로 | 산출물 |
|---|---|---|---|
| `vis-a-lot-web` | `apps/web` | 도메인 전체. `/help`, `/help.txt`, `/help/**`는 help 프로젝트로 rewrite | `apps/web/out` (정적 export) |
| `vis-a-lot-help` | `apps/help` | `/help/**`. 자산은 `/help/_next/**` | `apps/help/out` (정적 export) |

저장소에 들어 있는 설정:

| 파일 | 내용 |
|---|---|
| `apps/web/vercel.json` | Install·Build Command, Output Directory, `cleanUrls`, `/help/**` → help 프로젝트 rewrite |
| `apps/help/vercel.json` | Install·Build Command, Output Directory, `cleanUrls`, `/help/_next/**` → `/_next/**` rewrite |
| `apps/help/next.config.ts` | `assetPrefix: "/help"`. 라우트는 basePath 없이 `app/help/` 아래에 둔다 |

## 1. Vercel 프로젝트 둘 만들기

같은 GitHub 저장소를 두 번 import한다 ([monorepos](https://vercel.com/docs/monorepos)).

1. 기존 프로젝트(저장소 루트를 Root Directory로 쓰던 것)는 web 프로젝트로 쓴다. **Settings → Build and Deployment → Root Directory**를 `apps/web`으로 바꾼다. 새로 만든다면 이름은 `vis-a-lot-web`.
2. **Create New → Project**에서 같은 저장소를 한 번 더 import해 Root Directory `apps/help`, 이름 `vis-a-lot-help`로 만든다.
3. 두 프로젝트 모두 **Settings → Build and Deployment**에서
   - Framework Preset, Build·Install Command, Output Directory는 대시보드에서 덮어쓰지 않는다(Override 끔). `apps/*/vercel.json`이 정한다.
   - **Root Directory → Include files outside the root directory in the Build Step**을 켠다 (기본값). 앱 빌드가 `packages/*`, 루트 `turbo.json`·`pnpm-lock.yaml`을 읽는다.
   - **Root Directory → Skip deployment**(skip unaffected projects)를 켠다.
4. 두 프로젝트 모두 **Settings → Environment Variables**에 `ENABLE_EXPERIMENTAL_COREPACK` = `1`을 모든 환경에 넣는다 (아래 "pnpm 12").
5. **Node.js Version**은 22.x 이상으로 둔다.
6. 도메인은 web 프로젝트에만 붙인다. help 프로젝트는 `vis-a-lot-help.vercel.app`(Production)만 쓴다.

**web의 rewrite 대상은 help 프로젝트의 Production 도메인이다.** `apps/web/vercel.json`의 `https://vis-a-lot-help.vercel.app`는 help 프로젝트 이름이 `vis-a-lot-help`일 때의 기본 도메인이다. 다른 이름으로 만들었거나 help에 다른 도메인을 붙였으면 세 rewrite의 도메인을 그 값으로 바꾼다.

### skip unaffected projects의 요건

[문서](https://vercel.com/docs/monorepos#requirements)의 요건과 이 저장소의 상태:

| 요건 | 이 저장소 |
|---|---|
| GitHub 저장소에 연결한 프로젝트 | GitHub 저장소를 import한다. CLI 배포(`vercel deploy`)에는 적용되지 않는다 |
| npm·yarn·pnpm·Bun workspace | `pnpm-workspace.yaml`이 `apps/*`, `packages/*`를 선언한다 |
| workspace 패키지마다 고유한 `name` | `@vis-a-lot/web`, `@vis-a-lot/help`, `@vis-a-lot/shared`, `@vis-a-lot/tsconfig`, `@vis-a-lot/i18n-check` |
| 패키지 사이 의존을 각 `package.json`에 선언 | 앱은 `@vis-a-lot/shared`·도구 패키지를 `"workspace:*"`로 선언한다. `scripts/check-fsd.mjs`가 선언하지 않은 import와 상대 경로 우회를 막는다 ([architecture.md](architecture.md)) |

Vercel은 바뀐 파일이 속한 workspace 패키지와 그 패키지에 의존하는 프로젝트만 빌드한다. 두 앱은 서로의 파일을 읽지 않는다 (web은 help의 도메인만 알고, help는 web을 모른다).

## 2. Build·Install Command, Output Directory

`apps/*/vercel.json`:

```json
{
  "framework": null,
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "turbo run build",
  "outputDirectory": "out",
  "cleanUrls": true
}
```

- **Build Command는 반드시 `turbo run build`다.** Root Directory(앱 폴더)에서 돌리면 turbo가 그 앱과 의존 패키지만 고른다 ([Turborepo on Vercel](https://vercel.com/docs/monorepos/turborepo)). 앱의 `build` 스크립트(`pnpm run build`, `next build`)를 바로 부르면 Lingui 카탈로그를 만드는 `i18n:compile`(앱·`@vis-a-lot/shared`)과 shared의 엄격한 i18n 검사가 돌지 않는다. 이때 앱 `build`는 `vis-a-lot-i18n-check . --compiled`에서 "컴파일한 카탈로그가 없다 … turbo run build로 돌린다"로 멈춘다.
- turbo는 루트 `devDependencies`의 `turbo`(2.11.10)를 찾아 그 버전으로 돈다.
- **Framework는 Other(`null`)**, 출력은 정적 파일 `out/`이다. 두 앱 모두 `output: "export"`라 서버가 없다. Next.js 프리셋은 Next 빌드 산출물(routes manifest)을 해석해 배포를 꾸미는데, 정적 export에는 쓸 것이 없고 rewrite를 `vercel.json`에 모아 두는 편이 읽기 쉽다. `cleanUrls`가 `/help/vis` → `help/vis.html`처럼 확장자 없는 경로를 연다. 없는 경로는 각 프로젝트 `out/404.html`이 404로 나간다.
- Install Command는 workspace 전체를 설치한다.

## 3. pnpm 12

`package.json`의 `packageManager`는 `pnpm@12.14.0`이다. Vercel은 [lockfile로 pnpm 버전을 고르는데](https://vercel.com/docs/package-managers), `lockfileVersion: '9.0'`은 pnpm 9 또는 10으로 읽는다. 그래서 **`ENABLE_EXPERIMENTAL_COREPACK=1`**을 두 프로젝트에 넣어 [Corepack](https://vercel.com/docs/builds/configure-a-build#corepack)이 `packageManager`의 버전을 쓰게 한다.

Corepack 없이 두면 생길 수 있는 일: pnpm 9.7 이상은 `packageManager`를 보고 pnpm 12.14.0을 내려받아 바꿔 탄다. pnpm 12 패키지의 `pnpm` bin은 자리표시자이고, 설치 스크립트(`install.js`)가 그 자리에 플랫폼별 실행 파일을 링크한다. pnpm 10은 의존 패키지의 설치 스크립트를 기본으로 막으므로 자리표시자가 남는다. 셸은 자리표시자를 셸 스크립트로 읽어 `pnpm install`은 되지만, turbo는 태스크마다 패키지 매니저 실행 파일을 직접 exec하므로 `Exec format error`로 멈춘다. 이 저장소의 개발 샌드박스에서 실제로 그랬다. Corepack은 pnpm 11 이상을 Node 스크립트로 실행하고 첫 실행 때 실행 파일을 내려받으므로 이 문제가 없다. Corepack을 켜도 같은 오류가 나면 Install Command를 `npm i -g pnpm@12.14.0 && pnpm install --frozen-lockfile`로 바꿔 본다.

lockfile: pnpm 12의 `pnpm-lock.yaml`은 YAML 문서 두 개다(pnpm 자체, workspace 의존). Vercel의 lockfile 기반 skip이 이 형식을 읽는지는 문서에 없다. 읽지 못하면 lockfile을 바꾼 커밋은 두 프로젝트를 모두 빌드하는 쪽으로 동작할 것이다 (빌드는 turbo 캐시로 빠르다).

## 4. 환경 변수와 캐시

- **Remote Cache**: Vercel 빌드의 turbo는 [Vercel Remote Cache](https://vercel.com/docs/monorepos/remote-caching)를 자동으로 쓴다. 한 프로젝트가 빌드한 `@vis-a-lot/shared#build` 같은 결과를 다른 프로젝트 빌드가 되살린다. 로컬은 `.turbo/` 로컬 캐시만 쓴다.
- turbo는 strict env mode다. 태스크에는 `turbo.json`의 `env`에 적은 변수만 전달되고 그 값이 캐시 키에 들어간다. 지금 빌드가 읽는 것은 `NEXT_PUBLIC_*`뿐이다 (예: `NEXT_PUBLIC_ACCESS_TTL_SEC`, `NEXT_PUBLIC_REFRESH_TTL_SEC`를 web 프로젝트 환경 변수로 줄 수 있다).
- **빌드에서 `VERCEL_*`(시스템 환경 변수)나 `NEXT_PUBLIC_`이 아닌 변수를 새로 읽으면 그 태스크의 `env`(캐시에 영향이 없으면 `passThroughEnv`)에 더한다.** 더하지 않으면 Vercel에 값을 넣어도 빌드에 전달되지 않고, 전달되더라도 캐시가 다른 환경의 결과를 되살릴 수 있다.

## 5. 무엇이 언제 배포되나

| 바꾼 것 | Vercel이 빌드하는 프로젝트 | 빌드 안에서 |
|---|---|---|
| `apps/help/**` (도움말 본문 오타 등) | help만 | shared 태스크는 Remote Cache로 되살리고 help만 빌드 |
| `apps/web/**` (`apps/web/vercel.json`의 rewrite 포함) | web만 | |
| `packages/shared/**`, `packages/i18n-check/**`, `packages/tsconfig/**` | 둘 다 | |
| `pnpm-lock.yaml` | 영향받는 프로젝트 (위 "pnpm 12"의 단서) | |
| 루트 파일: `turbo.json`, `pnpm-workspace.yaml`, 루트 `package.json`, `biome.json`, `scripts/**`, `docs/**`, README 등 | 둘 다 (workspace 밖 변경은 전체 변경으로 본다) | 앱 태스크 입력이 그대로면 turbo가 캐시로 끝낸다 (`FULL TURBO`) |

예: 도움말 본문의 오타를 고쳐 develop으로 PR을 열면

1. Vercel이 help 프로젝트만 Preview로 빌드하고 web은 건너뛴다 (Skipped).
2. help Preview는 그 배포 URL의 `/help`에서 바로 확인한다 (`https://<help Preview URL>/help/vis`). web 도메인의 `/help/**`는 help **Production**으로 rewrite되므로 Preview 변경은 보이지 않는다.
3. 병합 뒤 main으로 릴리스하면 help만 새 Production 배포가 생기고, web 도메인의 `/help/**`도 바로 그 내용을 보인다. web 배포는 그대로다.

## 경로와 자산

- 도움말 라우트는 basePath 없이 `app/help/` 아래에 있어 페이지 경로가 처음부터 `/help/**`다. 그래서 web의 rewrite는 경로를 바꾸지 않고(`/help/:path*` → `<help 도메인>/help/:path*`) 그대로 넘긴다. 클라이언트 탐색의 RSC payload(`/help/vis.txt`, `/help/__next.*.txt`)도 `/help/**`이고, `/help` 자체의 payload `/help.txt`만 따로 rewrite한다.
- 두 앱의 Next 자산은 모두 `/_next/**`에 생긴다. help는 `assetPrefix: "/help"`로 HTML·JS가 `/help/_next/**`를 가리키게 해 web 도메인에서도 rewrite를 타게 한다. 정적 export는 파일을 여전히 `out/_next`에 쓰므로, help 프로젝트의 `vercel.json`이 `/help/_next/:path*` → `/_next/:path*`로 잇는다. `next dev`는 assetPrefix 경로를 스스로 처리한다.
- web의 `/_next/**`, `/favicon.ico`, `/404.html` 등은 rewrite 대상이 아니라 늘 web이 내보낸다. help 페이지의 favicon(`/favicon.ico`)도 web의 파일이 쓰인다 (두 앱이 같은 파일).
- web의 MSW worker(scope `/`)는 web 도메인의 `/help/**` 페이지도 control하지만, 도움말 페이지는 MSW를 켜지 않은 클라이언트라 요청이 그대로 통과한다.

## 로컬 개발

```bash
pnpm dev         # web(:3000)·help(:3001)를 함께 띄운다
pnpm dev:web     # http://localhost:3000
pnpm dev:help    # http://localhost:3001/help
```

로컬에는 rewrite가 없다. web(:3000)의 상단 바 도움말 링크(`/help`)는 404가 나고, 도움말(:3001)의 시각화·피드 링크(`/`, `/feed`)는 help 앱 안의 없는 경로로 간다. 각 앱은 자기 포트에서 확인한다.
