// 도움말 목차. 서비스마다 문서를 순서대로 적는다. 본문은 content/help/<서비스>/<slug>.mdx이고,
// 화면(views/help-article)이 slug로 본문을 찾는다. 새 문서는 여기와 본문 표에 한 줄씩 더한다.

export const HELP_ROOT = "/help";

export const HELP_SERVICES = ["vis", "feed"] as const;
export type HelpService = (typeof HELP_SERVICES)[number];

export type HelpArticle = {
  slug: string;
  title: string;
  /** 목록 카드와 페이지 description에 쓰는 한 줄 */
  summary: string;
};

export type HelpServiceInfo = {
  label: string;
  summary: string;
  /** 비어 있으면 '준비 중'으로 보인다 */
  articles: readonly HelpArticle[];
};

export const HELP: Record<HelpService, HelpServiceInfo> = {
  vis: {
    label: "시각화",
    summary:
      "데이터를 올리고 차트를 그려 살펴보고, 기록을 다시 보고 공유하는 방법",
    articles: [
      {
        slug: "getting-started",
        title: "시작하기",
        summary: "로그인과 화면 구성",
      },
      {
        slug: "data",
        title: "데이터 준비",
        summary: "샘플 데이터 등록, CSV·zip 올리기, 데이터스토어",
      },
      {
        slug: "draw",
        title: "차트 그리기",
        summary: "컬럼 고르기, split by와 grid, draw와 진행 상황",
      },
      {
        slug: "chart-types",
        title: "차트 종류",
        summary: "14가지 차트와 서브 차트, 차트마다 고르는 컬럼",
      },
      {
        slug: "filter",
        title: "필터",
        summary: "컬럼별 범위·값 필터와 적용 시점",
      },
      {
        slug: "explore",
        title: "차트 살펴보기",
        summary: "툴팁, 모드(이동·확대·선택·삭제·페인트), 크게 보기",
      },
      {
        slug: "customize",
        title: "꾸미기",
        summary: "전체 설정, legend 색·위치, item 개별 속성",
      },
      {
        slug: "export-share",
        title: "내보내기와 공유",
        summary: "다운로드, 데이터 테이블, 링크 복사, 피드에 올리기",
      },
      {
        slug: "history",
        title: "history",
        summary: "그린 차트를 다시 보고 이어서 편집하기",
      },
      {
        slug: "faq",
        title: "알아 두기",
        summary: "데이터 보관 위치, 한도, 자주 묻는 질문",
      },
    ],
  },
  feed: {
    label: "피드",
    summary: "차트·이미지·코드를 게시물로 올리고 이슈로 다루는 방법",
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
