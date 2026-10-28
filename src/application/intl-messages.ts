// next-intl Provider와 서버 getTranslations에 넘기는 전체 문구. 문구 자체는 각 slice의 config/messages.ts에 두고,
// 여기서는 네임스페이스 이름으로 모으기만 한다. 새 slice가 useTranslations를 쓰면 여기에 한 줄 더한다.
// (next-intl의 Provider는 문구 객체 하나만 받으므로 모으는 곳이 하나는 있어야 한다.)

import { userMenuMessages } from "@/features/auth/config/messages";
import { localeSelectMessages } from "@/features/switch-locale/config/messages";
import { themeSelectMessages } from "@/features/switch-theme/config/messages";
import type { Locale } from "@/shared/config/locale";
import { feedHomeMessages } from "@/views/feed-home/config/messages";
import { helpArticleMessages } from "@/views/help-article/config/messages";
import { helpShellMessages } from "./HelpShell.messages";
import { preferencesMenuMessages } from "./PreferencesMenu.messages";

const pick = (locale: Locale) => ({
  LocaleSelect: localeSelectMessages[locale],
  ThemeSelect: themeSelectMessages[locale],
  UserMenu: userMenuMessages[locale],
  PreferencesMenu: preferencesMenuMessages[locale],
  HelpShell: helpShellMessages[locale],
  HelpArticle: helpArticleMessages[locale],
  FeedHome: feedHomeMessages[locale],
});

export type IntlMessages = ReturnType<typeof pick>;

export const INTL_MESSAGES: Readonly<Record<Locale, IntlMessages>> = {
  ko: pick("ko"),
  en: pick("en"),
};

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: IntlMessages;
  }
}
