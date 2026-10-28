import { t } from "@lingui/core/macro";
import Link from "next/link";
import { HELP, type HelpService, helpArticlePath } from "@/shared/config/help";
import { LOCALES, type Locale } from "@/shared/config/locale";
import { linguiFor } from "@/shared/lib/lingui";
import { Localized } from "@/shared/ui/Localized";
import "../config/messages";

/** 언어마다 만든 문구. 서비스 이름처럼 값도 언어마다 달라 inAllLocales 대신 쓴다. */
function perLocale(make: (lang: Locale) => string): Record<Locale, string> {
  return Object.fromEntries(
    LOCALES.map((lang) => [lang, make(lang)]),
  ) as Record<Locale, string>;
}

/**
 * 서비스 도움말 목차: 문서를 순서대로 카드로 보여 준다. 아직 문서가 없으면 준비 중 안내를 띄운다.
 * 정적 서버 컴포넌트라 모든 언어를 함께 그린다 (Localized). Lingui context가 없어 언어별 instance로 번역한다.
 */
export function HelpServiceView({ service }: { service: HelpService }) {
  const { label, summary, articles } = HELP[service];
  const title = perLocale((lang) => {
    const name = label[lang];
    return t(linguiFor(lang))({
      message: `${name} 도움말`,
      comment: "name은 서비스 이름 (시각화, 피드)",
    });
  });
  const comingSoon = perLocale((lang) => {
    const name = label[lang];
    return t(linguiFor(lang))({
      message: `${name} 도움말은 준비 중입니다.`,
      comment: "name은 서비스 이름 (시각화, 피드)",
    });
  });
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight">
        <Localized {...title} />
      </h1>
      <p className="mt-2 text-sm text-fg-secondary">
        <Localized {...summary} />
      </p>
      {articles.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-fg-secondary">
          <Localized {...comingSoon} />
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
                    <Localized {...a.title} />
                  </span>
                  <span className="text-ui text-fg-secondary">
                    <Localized {...a.summary} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
