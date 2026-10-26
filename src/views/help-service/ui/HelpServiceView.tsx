import Link from "next/link";
import { HELP, type HelpService, helpArticlePath } from "@/shared/config/help";

/** 서비스 도움말 목차: 문서를 순서대로 카드로 보여 준다. 아직 문서가 없으면 준비 중 안내를 띄운다. */
export function HelpServiceView({ service }: { service: HelpService }) {
  const { label, summary, articles } = HELP[service];
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight">{label} 도움말</h1>
      <p className="mt-2 text-sm text-fg-secondary">{summary}</p>
      {articles.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-fg-secondary">
          {label} 도움말은 준비 중입니다.
        </p>
      ) : (
        <ol className="mt-6 flex flex-col gap-2">
          {articles.map((a, i) => (
            <li key={a.slug}>
              <Link
                href={helpArticlePath(service, a.slug)}
                className="group flex items-baseline gap-3 rounded-lg border border-line bg-elevated px-4 py-3 hover:border-accent-line"
              >
                <span className="w-5 shrink-0 text-right font-mono text-xs text-fg-muted">
                  {i + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold group-hover:text-accent">
                    {a.title}
                  </span>
                  <span className="text-ui text-fg-secondary">{a.summary}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
