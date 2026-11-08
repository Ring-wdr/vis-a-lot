"use client";

import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import { linguiFor, useLocale } from "./i18n";

/**
 * Lingui의 React context. 언어마다 따로 둔 instance를 넘겨, hydration 중에는 정적 HTML과 같은
 * 기본 언어(ko)로 그리고 그 뒤 고른 언어로 바꾼다 (useLocale과 같은 규칙).
 */
export function LinguiProvider({ children }: { children: ReactNode }) {
  return <I18nProvider i18n={linguiFor(useLocale())}>{children}</I18nProvider>;
}
