import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  findHelpArticle,
  HELP,
  type HelpArticle,
  type HelpService,
  helpArticlePath,
  helpServicePath,
} from "@/shared/config/help";
import { HELP_CONTENT } from "../config/content";

function Neighbor({
  service,
  article,
  dir,
}: {
  service: HelpService;
  article: HelpArticle | undefined;
  dir: "prev" | "next";
}) {
  if (!article) return <span />;
  const next = dir === "next";
  return (
    <Link
      href={helpArticlePath(service, article.slug)}
      className="group flex flex-col gap-0.5 rounded-lg border border-line px-4 py-3 hover:border-accent-line data-[dir=next]:items-end data-[dir=next]:text-right"
      data-dir={dir}
    >
      <span className="text-xs text-fg-muted">{next ? "다음" : "이전"}</span>
      <span className="flex items-center gap-1 text-sm font-semibold group-hover:text-accent">
        {!next && <ChevronLeft size={14} aria-hidden="true" />}
        {article.title}
        {next && <ChevronRight size={14} aria-hidden="true" />}
      </span>
    </Link>
  );
}

/** 도움말 문서 한 편: 위치, 제목, 본문(MDX), 이전·다음 문서. */
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
  const { default: Content } = await load();
  const { article, prev, next } = found;

  return (
    <article>
      <nav aria-label="위치" className="mb-3 text-xs text-fg-muted">
        <Link href={helpServicePath(service)} className="hover:text-accent">
          {HELP[service].label}
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{article.title}</span>
      </nav>
      <h1 className="text-xl font-bold tracking-tight">{article.title}</h1>
      <p className="mt-1 text-sm text-fg-secondary">{article.summary}</p>
      <Content />
      <nav
        aria-label="이전·다음 문서"
        className="mt-12 grid grid-cols-2 gap-3 border-t border-line pt-6"
      >
        <Neighbor service={service} article={prev} dir="prev" />
        <Neighbor service={service} article={next} dir="next" />
      </nav>
    </article>
  );
}
