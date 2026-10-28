import { defineIntlMessages } from "@/shared/lib/intl-messages";

/** next-intl 네임스페이스 HelpArticle (application/intl-messages.ts에 등록). 서버에서 getTranslations로 읽는다. */
export const helpArticleMessages = defineIntlMessages({
  ko: { prev: "이전", next: "다음", nav: "이전·다음 문서", breadcrumb: "위치" },
  en: {
    prev: "Previous",
    next: "Next",
    nav: "Previous and next",
    breadcrumb: "Breadcrumb",
  },
});
