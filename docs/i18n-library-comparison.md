# 화면 언어(i18n) 라이브러리 비교: 직접 구현 vs Paraglide vs next-intl vs Lingui

한국어·영어 화면을 직접 만든 층(`src/shared/lib/i18n.ts`)으로 구현한 뒤, 같은 대표 화면을 세 라이브러리로 각각 옮겨 보고 같은 기준으로 재고 실제 브라우저에서 확인했다.

- 결론: **직접 구현 유지**. 라이브러리로 옮긴다면 **Lingui**가 1순위다.
- 비교 시점: 2026-10-28, 기준 커밋 `20f8d08` (`feat/i18n`, PR #67)
- 실험 구현(보관): 태그 `archive/i18n-paraglide`(`c32afa4`), `archive/i18n-next-intl`(`c678bfb`), `archive/i18n-lingui`(`a0c5fae`). `git checkout archive/i18n-lingui`로 열어 볼 수 있다.

## 1. 요구사항

| 요구 | 내용 |
|---|---|
| 정적 export | `output: "export"`. 서버가 요청마다 언어를 알 수 없다 |
| URL 유지 | `/en/...` 같은 접두사 없이, 고른 언어를 localStorage(`vis-a-lot:locale`)에 둔다 |
| 깜빡임 없음 | 도움말처럼 미리 그린 정적 HTML도 첫 페인트부터 고른 언어로 보인다 |
| 레이아웃 유지 | 언어를 바꿔도 상단 바·탭·버튼의 높이와 자리가 바뀌지 않는다 |
| 즉시 전환 | 새로 고침 없이 열린 화면 전체가 바뀐다 |
| FSD | 문구는 쓰는 slice 근처에 둔다. 같은 레이어의 다른 slice를 import하지 않는다 |
| 컴포넌트 밖 사용 | 라벨 표, 활동 문장, 상대 시각처럼 훅을 못 쓰는 코드에서도 읽는다 |
| 한국어 조사 | 을/를, 으로/로처럼 앞 낱말의 받침에 따라 바뀌는 조사 |

## 2. 시험 방법

세 라이브러리 모두 같은 10개 파일만 옮기고, 나머지 화면은 직접 구현 층에 그대로 두어 두 방식이 함께 돈다(언어 값은 공유).

- 옮긴 파일: `LocaleSelect`, `ThemeSelect`, `UserMenu`, `PreferencesMenu`, `shared/lib/time.ts`, `entities/post/lib/labels.ts`·`event-text.ts`, `HelpShell`, `HelpArticleView`, `views/feed-home/ui/HomeView.tsx`
- 크기: `pnpm build` 뒤 `node scripts/measure-route-js.mjs`. 화면 HTML이 불러오는 JS를 gzip(level 9)으로 더한다
- 브라우저: Playwright로 (1) 언어를 en으로 두고 JS 없이 `/help/vis/draw`의 첫 페인트, (2) `/`에서 팝오버로 언어를 바꾼 전후 상단 바 요소의 위치·크기를 비교
- 타입 검사: en 키 하나를 지우고, en 문구의 변수 이름을 바꿔 tsc·빌드가 잡는지 본다

네 구현 모두 lint, tsc, 테스트(595~596개), 정적 빌드를 통과했고, 도움말 깜빡임과 언어 전환 때의 레이아웃 변화가 없었다.

## 3. 결과

### 크기 (gzip KB, 두 방식이 함께 든 상태)

| 화면 | 직접 구현 | Paraglide 2.29.2 | next-intl 4.14.9 | Lingui 6.10.1 |
|---|---|---|---|---|
| `/` | 406.7 | 407.8 (+1.1) | 419.6 (+12.9) | 410.1 (+3.4) |
| `/feed` | 219.3 | 220.2 (+0.9) | 232.6 (+13.3) | 225.1 (+5.8) |
| `/help/vis/draw` | 236.3 | 237.9 (+1.6) | 249.3 (+13.0) | 240.1 (+3.8) |
| `/share` | 266.3 | 267.4 (+1.1) | 279.2 (+12.9) | 269.7 (+3.4) |
| out/ 전체 JS | 2156.6 | 2183.3 | 2176.3 | 2185.3 |

- 라이브러리 자체: Paraglide 런타임 1.2KB(문구는 함수로 컴파일된다), next-intl 11.7KB(use-intl + ICU 파서, 모든 화면), Lingui 3.3KB(core + react)
- 빌드 시간은 넷 다 비슷했다 (Paraglide 컴파일 +2.3초, Lingui CLI +1.5초)

### 구조와 검사

| | 직접 구현 | Paraglide | next-intl | Lingui |
|---|---|---|---|---|
| 문구 위치 | slice 안 TS 표 | slice마다 JSON, 키는 전역이라 접두사(`feed_home_retry`). slice마다 설정에 한 줄 | 문구는 slice에 두지만 **중앙 등록 파일 필수** | slice마다 `.po` + 등록 import |
| 화면이 받는 문구 | 그 화면 것만 | 그 화면 것만 | **모든 화면이 전체** | 그 화면 것만 (원문 한국어 카탈로그도 받는다) |
| 추가로 필요한 것 | 없음 | 문구 컴파일(Turbopack 플러그인 없음), 생성 파일 | Provider, Next 플러그인, `@swc/core` 등 무거운 의존성 | SWC 플러그인, extract·compile, vitest 설정 |
| en 키 누락 | tsc 오류 | 못 잡음 (영어 화면에 한국어) | 직접 만든 보조 타입으로 tsc 오류 | `compile --strict`로 빌드 실패 |
| en 문구의 변수 이름 실수 | tsc 오류 | 못 잡음 | 못 잡음 | 못 잡음 (빈 문자열) |
| 한국어 조사 | 문구 함수 안에서 `josa()` | 코드에서 조사를 계산해 입력으로 넘김 | 같음 (ICU `select`) | 받침 종류를 ICU `select`로 (한국어 원문이 길어진다) |
| 복수형·ICU | 직접 작성 | 있음 | 있음 | 있음 |
| 번역가 도구 | 없음 | inlang 편집기·VS Code 확장 | 추출기(실험 단계) | 표준 `.po` |
| 메시지 ID | 표의 키 | 키 | 키 | 한국어 원문에서 생성 |

직접 구현의 타입 검사에도 빈틈이 하나 있다. en 함수가 인자를 덜 받으면(`() => "m ago"`) TypeScript가 허용한다.

## 4. 라이브러리마다 부딪힌 것

### Paraglide
- 문서대로 `import { m } from ".../messages.js"`(`export * as m`)로 쓰면 Turbopack이 tree-shaking을 못 해 화면마다 문구 대부분(약 +7KB)이 실렸다. `import * as m from ".../messages/_index.js"`로 바꿔 해결했다.
- 기본 `setLocale`은 페이지를 새로 고친다. `overwriteGetLocale`·`overwriteSetLocale`로 기존 store에 연결해야 즉시 바뀐다.
- 정적으로 그린 클라이언트 컴포넌트는 `m.key({}, { locale })`로 언어를 넘겨야 hydration 값이 맞는다.
- 문구에 함수를 둘 수 없고, 입력 타입이 `NonNullable<unknown>`이라 선택 값은 키를 나눠야 한다.

### next-intl
- 서버 쪽은 요청 언어만 안다. 정적 export에서는 클라이언트 Provider로 언어를 정하고, 도움말은 `getTranslations({ locale: "ko" | "en" })`을 둘 다 불러 함께 그린다. 설정에서 `requestLocale`을 await하면 정적 렌더가 깨진다.
- 기본 요청 설정 위치(`src/i18n/request.ts`)는 FSD 규칙에 어긋나 경로를 바꿨다.
- 날짜 포매터에 `timeZone`을 주지 않으면 매번 경고한다. `'`는 ICU escape라 `''`로 써야 한다.
- 4.x 설치에 추출기용 `@swc/core`(11MB 네이티브)와 `@parcel/watcher`가 따라와 `pnpm-workspace.yaml`에 `allowBuilds` 설정이 필요했다.

### Lingui
- 공식 스킬(`npx skills add lingui/skills`)은 도구 설정(SWC 플러그인 버전 고정과 `[name, {}]` 형식, `check sync`·`compile --strict` 빌드 검사)에는 정확했다. Next.js 구성은 `[locale]` URL과 미들웨어, 중앙 카탈로그를 전제로 해 쓰지 못했다. 원문이 영어가 아닌 경우, localStorage 언어의 hydration은 다루지 않는다.
- 메시지 ID가 한국어 원문이라 같은 글자가 다른 뜻이면 충돌한다("취소" = 상태 Cancelled / 버튼 Cancel). `context`로 나눴지만 잡아 주는 도구는 없다. 한국어 문구를 고치면 번역을 다시 이어야 한다.
- slice마다 카탈로그 등록 import(`import "../config/messages"`)가 필요하고, 빠뜨려도 아무것도 알려 주지 않는다.
- production 매크로가 원문을 지우므로 한국어 카탈로그도 함께 내려간다.

## 5. 결론: 직접 구현 유지

1. **요구사항을 모두 만족한다.** 정적 export, URL 유지, 깜빡임·레이아웃 변화 없음, slice별 분할을 의존성과 빌드 단계 없이 약 190줄로 한다.
2. **타입 검사가 가장 강하다.** en 키 누락과 문구 함수의 인자 타입을 tsc가 잡는다. 세 라이브러리는 en 문구의 변수 이름 실수를 잡지 못했다.
3. **한국어 조사를 문구 안에서 바로 쓴다.** 라이브러리들은 조사를 코드에서 계산해 넘겨야 했다.
4. 깜빡임 없는 정적 페이지(`Localized`, `StableText`)는 어느 라이브러리를 써도 따로 필요했다.

### 라이브러리로 옮길 때 (Lingui)
- 언어가 셋 이상이 되거나 외부 번역가와 `.po` 파일을 주고받아야 할 때 옮긴다.
- slice별 카탈로그, 작은 런타임, 빌드에서 잡히는 번역 누락, 표준 형식이 장점이다.
- 옮길 때 en·ja 문구의 변수 이름을 원문과 비교하는 검사 스크립트를 함께 둔다.
- 남은 파일(약 146개, 함수형 문구 약 200개): `{ko, en}` 표를 매크로와 `.po`로 바꾸는 변환 스크립트를 쓰면 3~5일, 손으로 하면 1.5~2주.
- 옮기기와 새 언어 추가는 나눠서 한다.

## 6. 다시 시험하는 법

```bash
git checkout archive/i18n-lingui   # 또는 archive/i18n-paraglide, archive/i18n-next-intl
pnpm install
pnpm build
node scripts/measure-route-js.mjs
```

태그 시점에는 `scripts/measure-route-js.mjs`가 없으므로 `feat/i18n` 이후 커밋에서 파일만 가져와 쓴다 (`git show <커밋>:scripts/measure-route-js.mjs > /tmp/measure.mjs`).
