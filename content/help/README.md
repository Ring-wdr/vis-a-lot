# 도움말 본문

`/help` 화면의 본문(MDX)이다. 서비스마다 폴더를 두고 문서 하나가 파일 하나다.

```
content/help/
  vis/<slug>.mdx      시각화 도움말 (한국어)
  vis/<slug>.en.mdx   시각화 도움말 (영어)
  vis/<slug>.ja.mdx   시각화 도움말 (일본어)
  feed/<slug>.mdx     피드 도움말 (아직 없음)
```

화면은 모든 언어 본문을 함께 그리고 `<html lang>`에 맞는 쪽만 보인다(`Localized`). 기본 언어(한국어)가 아닌 본문의 `##`·`###` 제목 id에는 언어 코드가 붙으므로, 영어 본문 안의 `#제목` 링크는 `#en-<slug>`, 일본어 본문 안에서는 `#ja-<slug>`로 적는다.

## 문서 더하기

1. `content/help/<서비스>/<slug>.mdx`와 영어 `<slug>.en.mdx`, 일본어 `<slug>.ja.mdx`를 쓴다. 제목과 한 줄 요약은 화면이 목차에서 가져와 붙이므로, 본문은 `##` 제목부터 쓴다.
2. 목차 `src/shared/config/help.ts`의 그 서비스 `articles`에 `{ slug, title: { ko, en }, summary: { ko, en } }`를 순서대로 더한다.
3. 본문 표 `src/views/help-article/config/content.ts`에 `slug: { ko: () => import("…/<slug>.mdx"), en: () => import("…/<slug>.en.mdx"), ja: () => import("…/<slug>.ja.mdx") }`를 더한다. 목차에 있는데 본문 표에 없으면 빌드가 실패한다.

피드 도움말을 시작할 때는 2·3의 `feed` 쪽에 같은 방식으로 더하면 된다. 목차가 비어 있는 동안 피드는 "준비 중"으로 보인다.

## 쓸 수 있는 것

- GitHub 표기(표, 체크 목록, 취소선)를 쓴다 (`remark-gfm`). `##`·`###` 제목에는 id가 붙어 `#제목` 링크가 된다 (`rehype-slug`).
- 요소 모양은 `src/shared/ui/mdx/mdx-components.tsx`가 정한다. 본문에서 import 없이 쓰는 컴포넌트:
  - `<Callout title="…">…</Callout>`, `<Callout tone="warn">…</Callout>`: 안내 상자
  - `<Kbd>Esc</Kbd>`: 키보드 키
- `/`로 시작하는 링크는 같은 사이트 안 이동, 그 밖의 링크는 새 탭으로 연다.
- 화면 문구(버튼·메뉴 이름)는 실제 화면과 같은 글자로 적는다.
