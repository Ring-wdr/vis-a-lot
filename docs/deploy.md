# 배포 (Vercel Microfrontends)

두 앱을 Vercel 프로젝트 둘로 따로 빌드·배포하고, [Vercel Microfrontends](https://vercel.com/docs/microfrontends)로 한 도메인에 묶는다. 커밋마다 바뀐 앱만 빌드한다([skip unaffected projects](https://vercel.com/docs/monorepos#skipping-unaffected-projects)).

| Vercel 프로젝트 | Root Directory | 맡는 경로 | 산출물 |
|---|---|---|---|
| `vis-a-lot-web` (기본 앱) | `apps/web` | `/help/**`를 뺀 모든 경로 | `apps/web/out` (정적 export) |
| `vis-a-lot-help` (자식 앱) | `apps/help` | `/help`, `/help/:path*`, 자산 `/help-assets/:path*` | `apps/help/out` (정적 export) |

저장소에 들어 있는 설정은 다음과 같다.

| 파일 | 내용 |
|---|---|
| `apps/web/microfrontends.json` | 그룹 구성과 경로. 기본 앱에만 둔다 ([configuration](https://vercel.com/docs/microfrontends/configuration)) |
| `apps/*/next.config.ts` | `withMicrofrontends`로 감싼다 (`@vercel/microfrontends` 2.4.2). help는 asset prefix `/help-assets`를 받는다 |
| `apps/help/scripts/prefix-assets.mjs` | help `build`의 마지막 단계. `out/_next`를 `out/help-assets/_next`로 옮긴다 (아래 "정적 export와 asset prefix") |
| `apps/*/vercel.json` | 프로젝트마다 Framework, Install·Build Command, Output Directory |
| `apps/help/package.json`의 `"vis-a-lot".microfrontend` | help가 쓰는 앱 이름·`assetPrefix`. `microfrontends.json`과 같아야 한다 (`scripts/check-microfrontends.mjs`) |

## 1. Vercel 프로젝트 둘 만들기

같은 GitHub 저장소를 두 번 import한다 ([monorepos](https://vercel.com/docs/monorepos)).

1. **Create New → Project**에서 저장소를 고르고 **Root Directory**를 `apps/web`으로 정한다. 프로젝트 이름은 `vis-a-lot-web`.
2. 한 번 더 import해서 Root Directory `apps/help`, 이름 `vis-a-lot-help`로 만든다.
3. 두 프로젝트 모두 **Settings → Build and Deployment → Root Directory**에서
   - **Include files outside the root directory in the Build Step**을 켠다 (기본값). 앱 빌드가 `packages/*`, 루트 `turbo.json`·`pnpm-lock.yaml`을 읽고, help 빌드는 `apps/web/microfrontends.json`도 읽는다.
   - **Skip deployment**(skip unaffected projects)를 켠다.
4. 두 프로젝트 모두 **Settings → Environment Variables**에 `ENABLE_EXPERIMENTAL_COREPACK` = `1`을 모든 환경(Production, Preview, Development)에 넣는다 (아래 "pnpm 12").
5. **Node.js Version**은 22.x 이상으로 둔다 (로컬에서 확인한 버전은 Node 22, corepack 0.36).

**프로젝트 이름은 `microfrontends.json`의 `applications` 키와 같아야 한다.** Vercel은 이 키를 프로젝트 이름으로 읽는다. 다른 이름으로 만들었으면 `apps/web/microfrontends.json`의 키(`vis-a-lot-web`, `vis-a-lot-help`)를 그 이름으로 고친다. `packageName`(`@vis-a-lot/web`, `@vis-a-lot/help`)은 package.json 이름이라 그대로 둔다. 빌드와 로컬 proxy는 이 값으로 앱을 찾는다.

### skip unaffected projects의 요건

[문서](https://vercel.com/docs/monorepos#requirements)의 요건과 이 저장소의 상태:

| 요건 | 이 저장소 |
|---|---|
| GitHub 저장소에 연결한 프로젝트 | GitHub 저장소를 import한다. CLI 배포(`vercel deploy`)에는 적용되지 않는다 |
| npm·yarn·pnpm·Bun workspace | `pnpm-workspace.yaml`이 `apps/*`, `packages/*`를 선언한다 |
| workspace 패키지마다 고유한 `name` | `@vis-a-lot/web`, `@vis-a-lot/help`, `@vis-a-lot/shared`, `@vis-a-lot/tsconfig`, `@vis-a-lot/i18n-check` |
| 패키지 사이 의존을 각 `package.json`에 선언 | 앱은 `@vis-a-lot/shared`·도구 패키지를 `"workspace:*"`로 선언한다. `scripts/check-fsd.mjs`가 선언하지 않은 import와 상대 경로 우회를 막는다 ([architecture.md](architecture.md)) |

Vercel은 바뀐 파일이 속한 workspace 패키지와 그 패키지에 의존하는 프로젝트만 빌드한다. lockfile 변경은 그 변경이 영향을 주는 프로젝트만 빌드한다.

## 2. Microfrontends 그룹 만들기

[quickstart](https://vercel.com/docs/microfrontends/quickstart)를 따른다.

1. 팀 **Settings → Microfrontends → Create Group** (또는 `vercel microfrontends create-group`).
2. `vis-a-lot-web`, `vis-a-lot-help`를 넣고 **기본 앱(default application)**을 `vis-a-lot-web`으로 고른다.
3. 도메인은 `vis-a-lot-web` 프로젝트에 붙인다. help는 그 도메인의 `/help/**`로 열린다.
4. `microfrontends.json`이 들어간 커밋을 Preview로 배포해 확인한 뒤 Production으로 올린다. 그룹을 만들기만 해서는 동작이 바뀌지 않고, 기본 앱의 Production 배포에 `microfrontends.json`이 들어가야 경로가 나뉜다.

Hobby·Pro는 Microfrontends 프로젝트 2개까지 포함한다 ([limits and pricing](https://vercel.com/docs/microfrontends#limits-and-pricing)). Hobby는 Microfrontends 라우팅 요청이 월 50K까지다.

`microfrontends.json`의 `development.fallback`(`vis-a-lot-web.vercel.app`)은 로컬 proxy가 띄우지 않은 앱의 요청을 보낼 곳이다. 실제 Production 도메인으로 바꾼다.

## 3. Build·Install Command, Output Directory

`apps/*/vercel.json`에 적어 두었다 (대시보드 값보다 우선한다).

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
- turbo는 Vercel 빌드 환경에 전역으로 있고, 루트 `devDependencies`의 `turbo`(2.11.10)를 찾아 그 버전으로 돈다.
- **Framework는 Other(`null`)**, 출력은 정적 파일 `out/`이다. 두 앱 모두 `output: "export"`라 서버가 없다. Next.js 프리셋을 쓰지 않는 까닭은 아래 "정적 export와 asset prefix"에 있다. `cleanUrls`가 `/help/vis` → `help/vis.html`처럼 확장자 없는 경로를 연다. 없는 경로는 각 프로젝트 `out/404.html`이 404로 나간다.
- Install Command는 workspace 전체를 설치한다. filtered install(`pnpm install --filter "@vis-a-lot/help..."`)로도 help 빌드는 되지만, `pnpm dev`의 Microfrontends proxy는 web의 `node_modules`에서 돌기 때문에 로컬 개발에는 전체 설치가 필요하다.

## 4. pnpm 12

`package.json`의 `packageManager`는 `pnpm@12.14.0`이다. Vercel은 [lockfile로 pnpm 버전을 고르는데](https://vercel.com/docs/package-managers), `lockfileVersion: '9.0'`은 pnpm 9 또는 10으로 읽는다(지원 버전 표에는 12까지 있다). 그래서 **`ENABLE_EXPERIMENTAL_COREPACK=1`**을 두 프로젝트에 넣어 [Corepack](https://vercel.com/docs/builds/configure-a-build#corepack)이 `packageManager`의 버전을 쓰게 한다.

Corepack 없이 두면 생길 수 있는 일: pnpm 9.7 이상은 `packageManager`를 보고 pnpm 12.14.0을 내려받아 바꿔 탄다. pnpm 12 패키지의 `pnpm` bin은 자리표시자이고, 설치 스크립트(`install.js`)가 그 자리에 플랫폼별 실행 파일(`@pnpm/exe.<플랫폼>`)을 링크한다. pnpm 10은 의존 패키지의 설치 스크립트를 기본으로 막으므로 자리표시자가 남는다. 셸은 자리표시자를 셸 스크립트로 읽어 Node로 넘기니 `pnpm install`은 되지만, turbo는 태스크마다 패키지 매니저 실행 파일을 직접 exec하므로 `Exec format error`로 멈춘다. 이 저장소의 개발 샌드박스에서 실제로 그랬다. Corepack은 pnpm 11 이상을 `bin/pnpm.mjs`(Node 스크립트)로 실행하고, 그 스크립트가 첫 실행 때 실행 파일을 내려받으므로 이 문제가 없다 (corepack 0.36의 설정에서 확인). Corepack을 켜도 같은 오류가 나면 빌드 로그에서 쓰인 pnpm 버전과 경로를 보고, Install Command를 `npm i -g pnpm@12.14.0 && pnpm install --frozen-lockfile`로 바꿔 본다.

lockfile: pnpm 12의 `pnpm-lock.yaml`은 YAML 문서 두 개다. 첫 문서는 pnpm 자체(`packageManagerDependencies`), 둘째가 workspace 의존이고 둘 다 `lockfileVersion: '9.0'`이다. 설치는 pnpm 12가 하므로 문제없다. Vercel의 lockfile 기반 skip(lockfile 변경이 어느 프로젝트에 영향을 주는지 계산)이 이 형식을 읽는지는 문서에 없고 로컬에서 확인할 수 없다. 읽지 못하면 lockfile을 바꾼 커밋은 두 프로젝트를 모두 빌드하는 쪽으로 동작할 것이다 (빌드는 turbo 캐시로 빠르다).

## 5. 환경 변수와 캐시

- **Remote Cache**: Vercel 빌드의 turbo는 [Vercel Remote Cache](https://vercel.com/docs/monorepos/remote-caching)를 자동으로 쓴다. 한 프로젝트가 빌드한 `@vis-a-lot/shared#build` 같은 결과를 다른 프로젝트 빌드가 되살린다. 로컬은 `.turbo/` 로컬 캐시만 쓴다 (`turbo login`·`turbo link`를 하지 않았다).
- turbo는 strict env mode다. 태스크에는 `turbo.json`의 `env`에 적은 변수만 전달되고 그 값이 캐시 키에 들어간다. 지금 빌드가 읽는 것은 `NEXT_PUBLIC_*`뿐이다 (예: `NEXT_PUBLIC_ACCESS_TTL_SEC`, `NEXT_PUBLIC_REFRESH_TTL_SEC`를 web 프로젝트 환경 변수로 줄 수 있다).
- **빌드에서 `VERCEL_*`(시스템 환경 변수)나 `NEXT_PUBLIC_`이 아닌 변수를 새로 읽으면 그 태스크의 `env`(캐시에 영향이 없으면 `passThroughEnv`)에 더한다.** 더하지 않으면 Vercel에 값을 넣어도 빌드에 전달되지 않고, 전달되더라도 캐시가 다른 환경의 결과를 되살릴 수 있다.
- `withMicrofrontends`는 앱 이름을 `VERCEL_PROJECT_NAME` → package.json `name` 순서로 찾는다. strict mode라 `VERCEL_PROJECT_NAME`이 전달되지 않아도 `packageName`으로 같은 앱을 찾는다.
- Vercel의 Microfrontends가 빌드 때 넣는 변수(`VC_MICROFRONTENDS_CONFIG` 등)는 monorepo에서는 쓰지 않는다. `microfrontends.json`은 저장소에서 찾는다.

## 6. 무엇이 언제 배포되나

| 바꾼 것 | Vercel이 빌드하는 프로젝트 | 빌드 안에서 |
|---|---|---|
| `apps/help/**` (도움말 본문 오타 등) | help만 | shared 태스크는 Remote Cache로 되살리고 help만 빌드 |
| `apps/web/**` | web만 | |
| `apps/web/microfrontends.json` | web만 (help의 의존이 아니다) | 경로는 기본 앱(web) 배포가 정하므로 web 배포로 반영된다. help의 앱 이름·`assetPrefix`를 바꾸려면 `apps/help/package.json`도 함께 고쳐야 lint를 통과하므로 help도 다시 빌드된다 |
| `packages/shared/**`, `packages/i18n-check/**`, `packages/tsconfig/**` | 둘 다 | |
| `pnpm-lock.yaml` | 영향받는 프로젝트 (위 "pnpm 12"의 단서) | |
| 루트 파일: `turbo.json`, `pnpm-workspace.yaml`, 루트 `package.json`, `biome.json`, `scripts/**`, `docs/**`, README 등 | 둘 다 (workspace 밖 변경은 전체 변경으로 본다) | 앱 태스크 입력이 그대로면 turbo가 캐시로 끝낸다 (`FULL TURBO`) |

예: 도움말 본문의 오타를 고쳐 develop으로 PR을 열면

1. Vercel이 help 프로젝트만 Preview로 빌드하고 web은 건너뛴다 (Skipped).
2. help의 브랜치 URL에서 `/help/**`는 그 Preview를, 나머지 경로는 web의 [fallback 환경](https://vercel.com/docs/microfrontends/routing#how-deployment-routing-works)(기본: Production) 배포를 쓴다.
3. 병합 뒤 main으로 릴리스하면 help만 새 Production 배포가 생기고, 도메인의 `/help/**`가 그 배포로 바뀐다. web Production 배포는 그대로다.

help의 asset prefix를 바꿀 때는 `microfrontends.json`의 `assetPrefix`와 `apps/help/package.json`의 `"vis-a-lot".microfrontend.assetPrefix`를 함께 고친다. 하나만 고치면 `pnpm lint`(`lint:mfe`)가 멈춘다. 두 파일이 함께 바뀌므로 Vercel과 turbo 모두 help를 바뀐 프로젝트로 잡는다. 또 prefix 변경은 앞뒤 호환이 되지 않는다. 새 prefix 경로를 `routing`에 먼저 넣어 배포한 다음 `assetPrefix`를 바꾼다 ([asset prefix](https://vercel.com/docs/microfrontends/path-routing#configure-an-asset-prefix)).

## 정적 export와 asset prefix

두 앱의 `out/`은 `/_next/static/**`, `/404.html`, `/_not-found*`, `/favicon.ico`가 같은 경로다. 그대로 한 도메인에 붙이면 help 페이지의 JS·CSS 요청(`/_next/…`)이 web으로 가서 404가 난다. Microfrontends는 자식 앱 자산에 앱마다 다른 경로(asset prefix)를 붙여 이를 피한다. Next 앱은 `withMicrofrontends`가 `assetPrefix`를 정한다. Next의 `basePath`는 지원하지 않으므로([quickstart](https://vercel.com/docs/microfrontends/quickstart)) help는 basePath 없이 라우트를 `app/help/` 아래에 둔다.

- `microfrontends.json`에서 help의 `assetPrefix`를 `help-assets`로 정하고 `/help-assets/:path*`를 help 경로에 넣었다 (자동 이름 `vc-ap-<hash>` 대신 읽을 수 있는 이름. 사용자 지정 prefix는 `routing`에 그 경로가 있어야 한다).
- `next build`는 HTML·JS가 `/help-assets/_next/…`를 가리키게 만들지만, 정적 export는 파일을 여전히 `out/_next`에 쓴다. Next 서버라면 `withMicrofrontends`와 Next가 넣는 rewrite(`/help-assets/_next/:path+` → `/_next/:path+`)가 이를 잇지만, 정적 export에는 rewrites가 없다 (Next 문서 static exports의 Unsupported Features).
- 그래서 help `build`의 마지막 단계 `scripts/prefix-assets.mjs`가 `out/_next`를 `out/help-assets/_next`로 옮기고, prefix 없는 `/_next/`를 가리키는 HTML이 남았으면 실패한다. 다른 framework에 대한 Vercel 안내("자산을 asset prefix 폴더 아래로 옮긴다")와 같은 방식이다. build 때는 `withMicrofrontends`의 rewrites 변환을 빼서(`skipTransforms`) export 경고도 없앤다. dev에서는 `next dev`가 rewrites를 처리하므로 그대로 둔다.
- Vercel 프로젝트의 Framework를 Next.js 프리셋이 아닌 Other로 두는 까닭: Next.js 프리셋은 Next 빌드 산출물(routes manifest)의 rewrite를 배포에 적용할 수 있는데, 그러면 `/help-assets/_next/…`가 옮겨서 없어진 `/_next/…`로 다시 돌아간다. Other는 로컬에서 확인한 `out/` 파일을 그대로 내보낸다.
- web은 기본 앱이라 prefix가 없고, 브라우저 안의 MSW + Worker 구조라 정적 export를 그대로 쓴다.
- 남는 같은 경로(`/404.html`, `/_not-found*`, `/favicon.ico`)는 경로가 `/help/**`가 아니라 늘 web이 내보낸다. help의 `404.html`은 `/help/…` 아래 없는 경로에 help 배포가 돌려주는 404 페이지로만 쓰인다. favicon은 두 앱이 같은 파일이고, 도메인에서는 늘 web의 파일이 쓰인다. help의 `app/favicon.ico`를 바꿔도 보이지 않는다.
- 클라이언트 탐색의 RSC 요청은 `/help/…/__next.*.txt`나 `<경로>.txt`로 간다. `/help` 자체의 payload `/help.txt`는 `/help/:path*`에 들지 않으므로 `routing`에 따로 넣었다.

## 로컬 개발

```bash
pnpm dev         # web(:3000)·help(:3001)와 Microfrontends proxy를 함께 띄운다 → http://localhost:3024
pnpm dev:help    # help만 띄운다. proxy의 나머지 경로는 fallback(Production)으로 간다
pnpm dev:web     # web만 띄운다. /help/**는 fallback으로 간다
```

- `turbo run dev`는 `@vercel/microfrontends`가 설치된 것을 보고 그 proxy(`@vis-a-lot/web#proxy`)를 함께 띄운다 ([local development](https://vercel.com/docs/microfrontends/local-development)). 앱 포트는 `microfrontends.json`의 `development.local`(3000, 3001)이고, proxy 포트는 `options.localProxyPort`(3024)다.
- **http://localhost:3024** 한 포트에서 `/`, `/feed`, `/help/**`가 모두 열리고 앱 사이 링크(상단 바의 help, 도움말의 시각화·피드)도 이어진다. 앱 포트(3000, 3001)로 바로 들어가면 proxy로 redirect된다. 앱 포트를 바로 보려면 `MFE_DISABLE_LOCAL_PROXY_REWRITE=1 pnpm dev`.
- dev 로그의 `Specified "rewrites"/"redirects" will not automatically work with "output: export"` 경고는 dev에서만 붙는 proxy redirect·asset rewrite 때문이다. `next dev`는 이것을 처리하고, build에는 붙지 않는다.
- 경로가 이상하면 `MFE_DEBUG=1 pnpm dev`로 proxy가 요청을 어느 앱으로 보냈는지 본다.
- Production처럼 정적 산출물로 확인하려면 `pnpm build` 뒤 `apps/web/out`을 3000, `apps/help/out`을 3001에 확장자 없는 경로를 `.html`로 여는 정적 서버로 띄우고 `apps/web`에서 `pnpm exec microfrontends proxy microfrontends.json --local-apps vis-a-lot-web vis-a-lot-help`를 돌린다.

## 바꿀 때

- 경로를 새로 help로 보내려면 `apps/web/microfrontends.json`의 help `routing`에 더한다. 겹치는 경로를 두 앱에 두지 않는다. help 쪽이 그 경로를 내보낼 수 있게 먼저 배포한 뒤 바꾼다 (두 앱은 함께 배포되지 않는다).
- 앱을 새로 나누면 Vercel 프로젝트, `microfrontends.json`, 이 문서, [architecture.md](architecture.md)를 함께 바꾼다. Hobby·Pro 기본 포함은 2개다.
