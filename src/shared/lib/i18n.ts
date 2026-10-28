import type { I18n } from "@lingui/core";
import { useLayoutEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  LOCALES,
  type Locale,
} from "@/shared/config/locale";
import { activateGlobal, linguiFor as linguiForLocale } from "./lingui";

// 화면 언어. 사용자가 고른 값을 localStorage에 두고 <html lang>에 적는다 (color-scheme.ts와 같은 방식).
// 문구는 Lingui 매크로로 쓴다 (docs/i18n.md).
// 여기서 고른 언어가 Lingui 전역 i18n(lingui.ts)도 바꾼다.
// 컴포넌트 밖의 t``는 지금 언어를 읽기만 하므로, 그 문구를 그리는 컴포넌트는 useLocale(또는 useLingui)로 언어 변경을 구독한다.

export type { Locale } from "@/shared/config/locale";

/** 같은 탭 안에서 고른 값이 바뀌었음을 알린다 (storage 이벤트는 다른 탭에만 온다). */
const CHANGE_EVENT = "vis-a-lot:locale-change";

function isLocale(v: unknown): v is Locale {
  return (LOCALES as readonly unknown[]).includes(v);
}

function readLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

let current: Locale | undefined;

function applyLocale(locale: Locale) {
  current = locale;
  activateGlobal(locale);
}

/** 지금 화면 언어. 서버 렌더(SSR)와 테스트에서는 DEFAULT_LOCALE */
export function getLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  if (current === undefined) applyLocale(readLocale());
  return current as Locale;
}
// 컴포넌트 밖의 t``가 처음 불리기 전에 전역 i18n을 고른 언어로 맞춘다.
getLocale();

/** 지금(또는 넘긴) 언어의 Lingui instance. 컴포넌트 밖 표(labels.ts)가 언어별로 번역할 때 쓴다. */
export function linguiFor(locale: Locale = getLocale()): I18n {
  return linguiForLocale(locale);
}

export function setLocale(locale: Locale) {
  try {
    if (locale === DEFAULT_LOCALE) localStorage.removeItem(LOCALE_STORAGE_KEY);
    else localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // 저장소를 못 쓰면 이번 페이지에서만 바뀐다.
  }
  applyLocale(locale);
  document.documentElement.lang = locale;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** 고른 값이나 다른 탭에서 고른 값이 바뀌면 알린다. */
function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LOCALE_STORAGE_KEY) return;
    const next = readLocale();
    applyLocale(next);
    document.documentElement.lang = next;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** 지금 화면 언어. 바뀌면 다시 렌더한다. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE);
}

/**
 * <html lang>을 지킨다. 첫 페인트 전에는 LOCALE_INIT_SCRIPT(shared/config/locale.ts)가 적고,
 * 개발 모드의 Strict Mode remount가 지우면 다시 적는다. 앱 root에서 한 번 쓴다.
 */
export function useApplyLocale() {
  const locale = useLocale();
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
}

/** Intl API에 넘기는 locale 태그 */
export const INTL_LOCALE: Record<Locale, string> = {
  ko: "ko-KR",
  en: "en-US",
};

/** 지금 언어의 Intl locale 태그. Intl.DateTimeFormat·toLocaleString에 넘긴다. */
export function intlLocale(locale: Locale = getLocale()): string {
  return INTL_LOCALE[locale];
}

/**
 * 언어마다 한 번만 만드는 Intl 포매터. 모듈 위에서 만든 포매터가 처음 언어에 묶이지 않게 한다.
 * `const dateTime = localeCached((l) => new Intl.DateTimeFormat(l, {...}))` → `dateTime().format(at)`
 */
export function localeCached<T>(make: (intlLocale: string) => T) {
  const cache = new Map<Locale, T>();
  return (locale: Locale = getLocale()): T => {
    let value = cache.get(locale);
    if (value === undefined) {
      value = make(INTL_LOCALE[locale]);
      cache.set(locale, value);
    }
    return value;
  };
}
