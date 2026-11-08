import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { HELP, HELP_SERVICES, helpServicePath } from "@/shared/config/help";
import { Localized } from "@/shared/ui/Localized";

/** 도움말 첫 화면: 서비스를 고른다. 정적 서버 컴포넌트라 두 언어를 함께 그린다 (Localized). */
export function HelpHomeView() {
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight">
        <Localized ko="도움말" en="Help" />
      </h1>
      <p className="mt-2 text-sm text-fg-secondary">
        <Localized
          ko="vis-a-lot의 서비스별 사용 방법입니다. 보고 싶은 서비스를 고르세요."
          en="How to use each vis-a-lot service. Pick the one you want to read about."
        />
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {HELP_SERVICES.map((service) => {
          const { label, summary, articles } = HELP[service];
          const ready = articles.length > 0;
          const count = articles.length;
          return (
            <li key={service}>
              <Link
                href={helpServicePath(service)}
                className="group flex h-full flex-col gap-1.5 rounded-lg border border-line bg-elevated p-4 shadow-xs hover:border-accent-line"
              >
                <span className="flex items-center gap-2 text-base font-semibold group-hover:text-accent">
                  <Localized {...label} />
                  {ready ? (
                    <ChevronRight size={16} aria-hidden="true" />
                  ) : (
                    <span className="rounded-sm bg-panel-strong px-1.5 text-2xs font-normal whitespace-nowrap text-fg-muted">
                      <Localized ko="준비 중" en="Coming soon" />
                    </span>
                  )}
                </span>
                <span className="text-ui text-fg-secondary">
                  <Localized {...summary} />
                </span>
                {ready && (
                  <span className="mt-auto pt-2 text-xs text-fg-muted">
                    <Localized
                      ko={`문서 ${count}개`}
                      en={`${count} ${count === 1 ? "article" : "articles"}`}
                    />
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
