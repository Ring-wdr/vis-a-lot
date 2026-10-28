// next-intl 플러그인이 읽는 서버 설정 (next.config.ts의 requestConfig). 정적 export라 요청마다 언어를 알 수 없으므로,
// 서버 컴포넌트는 getTranslations({ locale })로 언어를 직접 넘긴다. 넘기지 않으면 기본 언어로 그린다.
// requestLocale(미들웨어가 정한 언어)은 읽지 않는다. 읽으면 헤더를 보게 되어 정적 렌더가 깨진다.

import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/shared/config/locale";
import { INTL_MESSAGES } from "./intl-messages";

const isLocale = (v: unknown): v is Locale =>
  (LOCALES as readonly unknown[]).includes(v);

export default getRequestConfig(({ locale }) => {
  const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return {
    locale: resolved,
    messages: INTL_MESSAGES[resolved],
    // 도움말은 날짜를 그리지 않지만, 정하지 않으면 next-intl이 경고한다.
    timeZone: "Asia/Seoul",
  };
});
