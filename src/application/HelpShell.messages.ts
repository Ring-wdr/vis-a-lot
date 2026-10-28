import { defineIntlMessages } from "@/shared/lib/intl-messages";

/** next-intl 네임스페이스 HelpShell (intl-messages.ts에 등록) */
export const helpShellMessages = defineIntlMessages({
  ko: {
    title: "vis-a-lot 도움말",
    openToc: "목차 열기",
    closeToc: "목차 닫기",
    services: "서비스",
    vis: "시각화",
    feed: "피드",
  },
  en: {
    title: "vis-a-lot Help",
    openToc: "Open contents",
    closeToc: "Close contents",
    services: "Services",
    vis: "Charts",
    feed: "Feed",
  },
});
