"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HELP,
  HELP_SERVICES,
  helpArticlePath,
  helpServicePath,
} from "@/shared/config/help";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { tv } from "@/shared/lib/tw";
import { Localized } from "@/shared/ui/Localized";

// 보이는 글자는 정적 HTML에서 깜빡이지 않도록 Localized로, 속성(aria-label)은 useT로 바꾼다.
const messages = defineMessages({
  ko: { toc: "도움말 목차" },
  en: { toc: "Help contents" },
});

const serviceLink = tv({
  base: "flex items-center justify-between rounded-md px-2 py-1.5 text-ui font-semibold text-fg hover:bg-panel-hover aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent",
});
const articleLink = tv({
  base: "block rounded-md py-1.5 pr-2 pl-4 text-ui text-fg-secondary hover:bg-panel-hover hover:text-fg aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent",
});

/** 도움말 목차: 서비스마다 문서를 순서대로 보여 주고 지금 보는 문서를 표시한다. 문서가 없는 서비스는 '준비 중'이다. */
export function HelpSidebar() {
  const text = useT(messages);
  const pathname = usePathname();
  // 정적 내보내기에서는 경로 끝에 /가 붙을 수 있다.
  const current = (href: string) =>
    pathname.replace(/\/$/, "") === href ? "page" : undefined;

  return (
    <nav className="flex flex-col gap-5" aria-label={text.toc}>
      {HELP_SERVICES.map((service) => {
        const { label, articles } = HELP[service];
        const href = helpServicePath(service);
        return (
          <section key={service} className="flex flex-col gap-0.5">
            <Link
              href={href}
              className={serviceLink()}
              aria-current={current(href)}
            >
              <Localized {...label} />
              {articles.length === 0 && (
                <span className="rounded-sm bg-panel-strong px-1.5 text-2xs font-normal whitespace-nowrap text-fg-muted">
                  <Localized ko="준비 중" en="Coming soon" />
                </span>
              )}
            </Link>
            {articles.map((a) => {
              const articleHref = helpArticlePath(service, a.slug);
              return (
                <Link
                  key={a.slug}
                  href={articleHref}
                  className={articleLink()}
                  aria-current={current(articleHref)}
                >
                  <Localized {...a.title} />
                </Link>
              );
            })}
          </section>
        );
      })}
    </nav>
  );
}
