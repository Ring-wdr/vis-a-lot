import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { HELP, HELP_SERVICES, helpServicePath } from "@/shared/config/help";

/** 도움말 첫 화면: 서비스를 고른다. */
export function HelpHomeView() {
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight">도움말</h1>
      <p className="mt-2 text-sm text-fg-secondary">
        vis-a-lot의 서비스별 사용 방법입니다. 보고 싶은 서비스를 고르세요.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {HELP_SERVICES.map((service) => {
          const { label, summary, articles } = HELP[service];
          const ready = articles.length > 0;
          return (
            <li key={service}>
              <Link
                href={helpServicePath(service)}
                className="group flex h-full flex-col gap-1.5 rounded-lg border border-line bg-elevated p-4 shadow-xs hover:border-accent-line"
              >
                <span className="flex items-center gap-2 text-base font-semibold group-hover:text-accent">
                  {label}
                  {ready ? (
                    <ChevronRight size={16} aria-hidden="true" />
                  ) : (
                    <span className="rounded-sm bg-panel-strong px-1.5 text-2xs font-normal text-fg-muted">
                      준비 중
                    </span>
                  )}
                </span>
                <span className="text-ui text-fg-secondary">{summary}</span>
                {ready && (
                  <span className="mt-auto pt-2 text-xs text-fg-muted">
                    문서 {articles.length}개
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
