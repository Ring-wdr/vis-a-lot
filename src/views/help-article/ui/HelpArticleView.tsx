import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  findHelpArticle,
  HELP,
  type HelpArticle,
  type HelpService,
  helpArticlePath,
  helpServicePath,
} from "@/shared/config/help";
import type { Locale } from "@/shared/config/locale";
import { Localized } from "@/shared/ui/Localized";
import { prefixedHeadings } from "@/shared/ui/mdx/mdx-components";
import { HELP_CONTENT } from "../config/content";

/** 영어 본문의 제목 id. 한국어 본문과 함께 그려도 id가 겹치지 않는다 (본문 안 링크도 #en-…). */
const EN_HEADINGS = prefixedHeadings("en-");

/** 언어 하나의 HelpArticle 문구. 정적 export라 언어를 요청에서 알 수 없어 두 언어를 각각 만든다. */
type HelpText = Awaited<ReturnType<typeof helpText>>;
const helpText = (locale: Locale) =>
  getTranslations({ locale, namespace: "HelpArticle" });

function Neighbor({
  service,
  article,
  dir,
  lang,
  t,
}: {
  service: HelpService;
  article: HelpArticle | undefined;
  dir: "prev" | "next";
  lang: Locale;
  t: HelpText;
}) {
  if (!article) return <span />;
  const next = dir === "next";
  return (
    <Link
      href={helpArticlePath(service, article.slug)}
      className="group flex flex-col gap-0.5 rounded-lg border border-line px-4 py-3 hover:border-accent-line data-[dir=next]:items-end data-[dir=next]:text-right"
      data-dir={dir}
    >
      <span className="text-xs text-fg-muted">{t(dir)}</span>
      <span className="flex items-center gap-1 text-sm font-semibold group-hover:text-accent">
        {!next && <ChevronLeft size={14} aria-hidden="true" />}
        {article.title[lang]}
        {next && <ChevronRight size={14} aria-hidden="true" />}
      </span>
    </Link>
  );
}

/**
 * 도움말 문서 한 편: 위치, 제목, 본문(MDX), 이전·다음 문서.
 * 정적 서버 컴포넌트라 두 언어를 함께 그리고 <html lang>에 맞는 쪽만 보인다 (Localized).
 */
export async function HelpArticleView({
  service,
  slug,
}: {
  service: HelpService;
  slug: string;
}) {
  const found = findHelpArticle(service, slug);
  const load = HELP_CONTENT[service][slug];
  // 목차와 본문 표가 어긋나면 빈 페이지 대신 빌드를 멈춘다.
  if (!found || !load) {
    throw new Error(`도움말 본문이 없습니다: ${service}/${slug}`);
  }
  const [{ default: ContentKo }, { default: ContentEn }, tKo, tEn] =
    await Promise.all([load.ko(), load.en(), helpText("ko"), helpText("en")]);
  const { article, prev, next } = found;

  return (
    <article>
      {/* aria-label도 언어마다 달라 nav를 언어마다 하나씩 두고 하나만 보인다. */}
      <Localized
        ko={
          <Breadcrumb service={service} article={article} lang="ko" t={tKo} />
        }
        en={
          <Breadcrumb service={service} article={article} lang="en" t={tEn} />
        }
      />
      <h1 className="text-xl font-bold tracking-tight">
        <Localized {...article.title} />
      </h1>
      <p className="mt-1 text-sm text-fg-secondary">
        <Localized {...article.summary} />
      </p>
      <Localized
        ko={<ContentKo />}
        en={<ContentEn components={EN_HEADINGS} />}
      />
      <Localized
        ko={
          <NeighborNav
            service={service}
            prev={prev}
            next={next}
            lang="ko"
            t={tKo}
          />
        }
        en={
          <NeighborNav
            service={service}
            prev={prev}
            next={next}
            lang="en"
            t={tEn}
          />
        }
      />
    </article>
  );
}

function Breadcrumb({
  service,
  article,
  lang,
  t,
}: {
  service: HelpService;
  article: HelpArticle;
  lang: Locale;
  t: HelpText;
}) {
  return (
    <nav aria-label={t("breadcrumb")} className="mb-3 text-xs text-fg-muted">
      <Link href={helpServicePath(service)} className="hover:text-accent">
        {HELP[service].label[lang]}
      </Link>
      <span aria-hidden="true"> / </span>
      <span>{article.title[lang]}</span>
    </nav>
  );
}

function NeighborNav({
  service,
  prev,
  next,
  lang,
  t,
}: {
  service: HelpService;
  prev: HelpArticle | undefined;
  next: HelpArticle | undefined;
  lang: Locale;
  t: HelpText;
}) {
  return (
    <nav
      aria-label={t("nav")}
      className="mt-12 grid grid-cols-2 gap-3 border-t border-line pt-6"
    >
      <Neighbor service={service} article={prev} dir="prev" lang={lang} t={t} />
      <Neighbor service={service} article={next} dir="next" lang={lang} t={t} />
    </nav>
  );
}
