// 화면 언어를 저장하는 키와 첫 페인트 전에 <html lang>을 정하는 스크립트. 서버 컴포넌트(app/layout.tsx)와
// 화면 코드(shared/lib/i18n.ts)가 함께 쓰므로 "use client" 없이 둔다.

export const LOCALES = ["ko", "en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

/** 고른 값이 없거나 읽을 수 없으면 쓰는 언어. 정적 HTML(SSR)도 이 언어로 그린다. */
export const DEFAULT_LOCALE: Locale = "ko";
export const LOCALE_STORAGE_KEY = "vis-a-lot:locale";

/** 언어 선택에 보이는 이름. 언어마다 자기 언어로 적고, 화면 언어가 바뀌어도 그대로 둔다. */
export const LOCALE_NAMES: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
};

/** <head>에서 바로 실행해 <html lang>을 고른 언어로 맞춘다 (i18n.ts의 readLocale과 같은 규칙). */
export const LOCALE_INIT_SCRIPT = `(function(){var l;try{l=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)})}catch(e){}document.documentElement.lang=${JSON.stringify(LOCALES)}.indexOf(l)>=0?l:${JSON.stringify(DEFAULT_LOCALE)}})()`;
