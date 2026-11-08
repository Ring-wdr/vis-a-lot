// 도움말 목차. 서비스마다 문서를 순서대로 적는다. 본문은 content/help/<서비스>/<slug>.mdx(영어는 <slug>.en.mdx)이고,
// 화면(views/help-article)이 slug로 본문을 찾는다. 새 문서는 여기와 본문 표에 한 줄씩 더한다.
// 도움말은 정적 서버 컴포넌트라 문구를 두 언어로 함께 두고, 화면이 Localized로 <html lang>에 맞는 쪽을 보인다.

import type { Locale } from "@/shared/config/locale";

export const HELP_ROOT = "/help";

export const HELP_SERVICES = ["vis", "feed"] as const;
export type HelpService = (typeof HELP_SERVICES)[number];

/** 언어별 문구. `<Localized {...text} />`로 그린다. */
export type HelpText = Readonly<Record<Locale, string>>;

export type HelpArticle = {
  slug: string;
  title: HelpText;
  /** 목록 카드와 페이지 description에 쓰는 한 줄 */
  summary: HelpText;
};

export type HelpServiceInfo = {
  label: HelpText;
  summary: HelpText;
  /** 비어 있으면 '준비 중'으로 보인다 */
  articles: readonly HelpArticle[];
};

export const HELP: Record<HelpService, HelpServiceInfo> = {
  vis: {
    label: { ko: "시각화", en: "Visualization" },
    summary: {
      ko: "데이터를 올리고 차트를 그려 살펴보고, 기록을 다시 보고 공유하는 방법",
      en: "Upload data, draw and explore charts, revisit your history and share",
    },
    articles: [
      {
        slug: "getting-started",
        title: { ko: "시작하기", en: "Getting started" },
        summary: {
          ko: "로그인과 화면 구성",
          en: "Signing in and the screen layout",
        },
      },
      {
        slug: "data",
        title: { ko: "데이터 준비", en: "Preparing data" },
        summary: {
          ko: "샘플 데이터 등록, CSV·zip 올리기, 데이터스토어",
          en: "Registering samples, uploading CSV·zip, the datastore",
        },
      },
      {
        slug: "draw",
        title: { ko: "차트 그리기", en: "Drawing charts" },
        summary: {
          ko: "컬럼 고르기, split by와 grid, draw와 진행 상황",
          en: "Picking columns, split by and grid, draw and progress",
        },
      },
      {
        slug: "chart-types",
        title: { ko: "차트 종류", en: "Chart types" },
        summary: {
          ko: "14가지 차트와 서브 차트, 차트마다 고르는 컬럼",
          en: "14 charts, sub charts and the columns each one uses",
        },
      },
      {
        slug: "filter",
        title: { ko: "필터", en: "Filters" },
        summary: {
          ko: "컬럼별 범위·값 필터와 적용 시점",
          en: "Range and value filters per column, and when they apply",
        },
      },
      {
        slug: "explore",
        title: { ko: "차트 살펴보기", en: "Exploring charts" },
        summary: {
          ko: "툴팁, 모드(이동·확대·선택·삭제·페인트), 크게 보기",
          en: "Tooltips, modes (pan, zoom, select, delete, paint), detail view",
        },
      },
      {
        slug: "customize",
        title: { ko: "꾸미기", en: "Customizing" },
        summary: {
          ko: "전체 설정, legend 색·위치, item 개별 속성",
          en: "Global settings, legend colors and position, per-item settings",
        },
      },
      {
        slug: "export-share",
        title: { ko: "내보내기와 공유", en: "Export and share" },
        summary: {
          ko: "다운로드, 데이터 테이블, 링크 복사, 피드에 올리기",
          en: "Downloads, data table, copying links, posting to the feed",
        },
      },
      {
        slug: "history",
        title: { ko: "history", en: "history" },
        summary: {
          ko: "그린 차트를 다시 보고 이어서 편집하기",
          en: "Revisit charts you drew and keep editing",
        },
      },
      {
        slug: "faq",
        title: { ko: "알아 두기", en: "Good to know" },
        summary: {
          ko: "데이터 보관 위치, 한도, 자주 묻는 질문",
          en: "Where data is stored, limits, FAQ",
        },
      },
    ],
  },
  feed: {
    label: { ko: "피드", en: "Feed" },
    summary: {
      ko: "차트·이미지·코드를 게시물로 올리고 이슈로 다루는 방법",
      en: "Post charts, images and code, and track them as issues",
    },
    articles: [],
  },
};

export const helpServicePath = (service: HelpService) =>
  `${HELP_ROOT}/${service}`;

export const helpArticlePath = (service: HelpService, slug: string) =>
  `${HELP_ROOT}/${service}/${slug}`;

export function isHelpService(value: string): value is HelpService {
  return (HELP_SERVICES as readonly string[]).includes(value);
}

export function findHelpArticle(service: HelpService, slug: string) {
  const { articles } = HELP[service];
  const index = articles.findIndex((a) => a.slug === slug);
  if (index < 0) return undefined;
  return {
    article: articles[index],
    prev: articles[index - 1] as HelpArticle | undefined,
    next: articles[index + 1] as HelpArticle | undefined,
  };
}

/** 정적 내보내기에서 미리 만들 문서 경로 */
export function helpArticleParams() {
  return HELP_SERVICES.flatMap((service) =>
    HELP[service].articles.map(({ slug }) => ({ service, slug })),
  );
}
