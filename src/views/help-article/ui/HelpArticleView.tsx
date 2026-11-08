import { t } from "@lingui/core/macro";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MDXContent } from "mdx/types";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  findHelpArticle,
  HELP,
  type HelpArticle,
  type HelpService,
  helpArticlePath,
  helpServicePath,
} from "@/shared/config/help";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/shared/config/locale";
import { linguiFor } from "@/shared/lib/lingui";
import { Localized } from "@/shared/ui/Localized";
import { prefixedHeadings } from "@/shared/ui/mdx/mdx-components";
import { HELP_CONTENT } from "../config/content";
import "../config/messages";

/**
 * 기본 언어가 아닌 본문의 제목 id에 언어를 붙인다. 여러 언어 본문을 함께 그려도 id가 겹치지 않는다
 * (본문 안 링크도 #en-…, #ja-…).
 */
const HEADINGS = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    locale === DEFAULT_LOCALE ? undefined : prefixedHeadings(`${locale}-`),
  ]),
) as Record<Locale, ReturnType<typeof prefixedHeadings> | undefined>;

/** 언어마다 하나씩 그린다. Localized에 넘긴다. */
function perLocale(
  render: (lang: Locale) => ReactNode,
): Record<Locale, ReactNode> {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, render(locale)]),
  ) as Record<Locale, ReactNode>;
}

function Neighbor({
  service,
  article,
  dir,
  lang,
}: {
  service: HelpService;
  article: HelpArticle | undefined;
  dir: "prev" | "next";
  lang: Locale;
}) {
  if (!article) return <span />;
  const next = dir === "next";
  return (
    <Link
      href={helpArticlePath(service, article.slug)}
      className="group flex flex-col gap-0.5 rounded-lg border border-line px-4 py-3 hover:border-accent-line data-[dir=next]:items-end data-[dir=next]:text-right"
      data-dir={dir}
    >
      <span className="text-xs text-fg-muted">
        {next
          ? t(linguiFor(lang))({
              message: "다음",
              context: "next help article",
            })
          : t(linguiFor(lang))({
              message: "이전",
              context: "previous help article",
            })}
      </span>
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
 * 정적 서버 컴포넌트라 모든 언어를 함께 그리고 <html lang>에 맞는 쪽만 보인다 (Localized).
 * 서버 컴포넌트는 Lingui context가 없어 언어별 instance로 번역한다 (t(linguiFor(lang))``).
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
  const bodies = await Promise.all(LOCALES.map((locale) => load[locale]()));
  const Content = Object.fromEntries(
    LOCALES.map((locale, i) => [locale, bodies[i].default]),
  ) as Record<Locale, MDXContent>;
  const { article, prev, next } = found;

  return (
    <article>
      {/* aria-label도 언어마다 달라 nav를 언어마다 하나씩 두고 하나만 보인다. */}
      <Localized
        {...perLocale((lang) => (
          <Breadcrumb service={service} article={article} lang={lang} />
        ))}
      />
      <h1 className="text-xl font-bold tracking-tight">
        <Localized {...article.title} />
      </h1>
      <p className="mt-1 text-sm text-fg-secondary">
        <Localized {...article.summary} />
      </p>
      <Localized
        {...perLocale((lang) => {
          const Body = Content[lang];
          return <Body components={HEADINGS[lang]} />;
        })}
      />
      <Localized
        {...perLocale((lang) => (
          <NeighborNav service={service} prev={prev} next={next} lang={lang} />
        ))}
      />
    </article>
  );
}

function Breadcrumb({
  service,
  article,
  lang,
}: {
  service: HelpService;
  article: HelpArticle;
  lang: Locale;
}) {
  return (
    <nav
      aria-label={t(linguiFor(lang))`위치`}
      className="mb-3 text-xs text-fg-muted"
    >
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
}: {
  service: HelpService;
  prev: HelpArticle | undefined;
  next: HelpArticle | undefined;
  lang: Locale;
}) {
  return (
    <nav
      aria-label={t(linguiFor(lang))`이전·다음 문서`}
      className="mt-12 grid grid-cols-2 gap-3 border-t border-line pt-6"
    >
      <Neighbor service={service} article={prev} dir="prev" lang={lang} />
      <Neighbor service={service} article={next} dir="next" lang={lang} />
    </nav>
  );
}
