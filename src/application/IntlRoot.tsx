"use client";

import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { useLocale } from "@/shared/lib/i18n";
import { INTL_MESSAGES } from "./intl-messages";

/** 브라우저의 시간대. 정하지 않으면 next-intl이 경고한다. */
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * next-intl Provider. 언어는 i18n.ts의 저장소(localStorage + <html lang>)를 따라가므로, 옛 useT를 쓰는 화면과
 * useTranslations를 쓰는 화면이 함께 바뀐다. 정적 HTML(SSR)은 기본 언어로 그린다.
 */
export function IntlRoot({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={INTL_MESSAGES[locale]}
      timeZone={timeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
}
