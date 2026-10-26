import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  findHelpArticle,
  HELP,
  helpArticleParams,
  isHelpService,
} from "@/shared/config/help";
import { HelpArticleView } from "@/views/help-article/ui/HelpArticleView";

export const dynamicParams = false;

export function generateStaticParams() {
  return helpArticleParams();
}

export async function generateMetadata({
  params,
}: PageProps<"/help/[service]/[slug]">): Promise<Metadata> {
  const { service, slug } = await params;
  const found = isHelpService(service) && findHelpArticle(service, slug);
  if (!found) return {};
  return {
    title: `${found.article.title} · ${HELP[service].label} 도움말 · vis-a-lot`,
    description: found.article.summary,
  };
}

export default async function HelpArticlePage({
  params,
}: PageProps<"/help/[service]/[slug]">) {
  const { service, slug } = await params;
  if (!isHelpService(service)) notFound();
  return <HelpArticleView service={service} slug={slug} />;
}
