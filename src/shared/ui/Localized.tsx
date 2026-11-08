import type { ReactNode } from "react";
import { LOCALES, type Locale } from "@/shared/config/locale";

// 언어마다 <html lang>에 맞을 때만 보이는 클래스. 언어를 더하면 app/globals.css의 lang-* 변형과 함께 늘린다.
const DISPLAY: Record<Locale, string> = {
  ko: "contents lang-en:hidden lang-ja:hidden",
  en: "hidden lang-en:contents",
  ja: "hidden lang-ja:contents",
};

/**
 * 모든 언어를 함께 그리고 <html lang>에 맞는 쪽만 보인다. 훅을 쓸 수 없는 서버 컴포넌트(도움말)용이다.
 * 첫 페인트 전에 lang이 정해지므로 정적 HTML에서도 언어가 깜빡이지 않는다.
 * 감싼 요소는 display: contents라 부모의 배치에 끼어들지 않는다.
 */
export function Localized(content: Record<Locale, ReactNode>) {
  return (
    <>
      {LOCALES.map((locale) => (
        <span key={locale} lang={locale} className={DISPLAY[locale]}>
          {content[locale]}
        </span>
      ))}
    </>
  );
}
