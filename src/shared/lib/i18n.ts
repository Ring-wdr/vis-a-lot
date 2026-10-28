import { useLayoutEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  LOCALES,
  type Locale,
} from "@/shared/config/locale";
import {
  overwriteGetLocale,
  overwriteSetLocale,
} from "@/shared/lib/paraglide/runtime.js";

// 화면 언어. 사용자가 고른 값을 localStorage에 두고 <html lang>에 적는다 (color-scheme.ts와 같은 방식).
// 문구는 쓰는 slice가 defineMessages로 언어별 표를 두고, 컴포넌트는 useT로, 컴포넌트 밖 함수는 t로 읽는다.
// t는 지금 언어를 읽기만 하므로, t로 만든 문구를 그리는 컴포넌트는 useLocale(또는 useT)로 언어 변경을 구독한다.

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

/** 지금 화면 언어. 서버 렌더(SSR)와 테스트에서는 DEFAULT_LOCALE */
export function getLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  current ??= readLocale();
  return current;
}

export function setLocale(locale: Locale) {
  try {
    if (locale === DEFAULT_LOCALE) localStorage.removeItem(LOCALE_STORAGE_KEY);
    else localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // 저장소를 못 쓰면 이번 페이지에서만 바뀐다.
  }
  current = locale;
  document.documentElement.lang = locale;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Paraglide(shared/lib/paraglide, 컴파일 결과)의 언어를 이 store에 묶는다. 메시지 함수(m.*)가 locale 없이 불려도
// 이 store의 값을 쓰고, Paraglide의 setLocale은 새로고침 대신 여기로 와서 구독한 컴포넌트를 다시 그린다.
// 이 모듈이 아직 안 불렸으면 Paraglide는 같은 localStorage 키(project.inlang/paraglide.config.mjs)를 직접 읽는다.
overwriteGetLocale(getLocale);
overwriteSetLocale((locale) => setLocale(locale));

/** 고른 값이나 다른 탭에서 고른 값이 바뀌면 알린다. */
function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LOCALE_STORAGE_KEY) return;
    current = readLocale();
    document.documentElement.lang = current;
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

/** 언어별 문구 표. 문구는 문자열이나 값을 받아 문자열을 만드는 함수다. en은 ko와 같은 모양이어야 한다. */
export type Messages<M> = Readonly<Record<Locale, M>>;

export function defineMessages<M extends object>(messages: {
  ko: M;
  en: NoInfer<M>;
}): Messages<M> {
  return messages;
}

/** 컴포넌트 밖에서 지금 언어의 문구를 읽는다. 그리는 컴포넌트는 useLocale로 언어 변경을 구독한다. */
export function t<M>(messages: Messages<M>): M {
  return messages[getLocale()];
}

/** 컴포넌트에서 지금 언어의 문구를 읽고, 언어가 바뀌면 다시 렌더한다. */
export function useT<M>(messages: Messages<M>): M {
  return messages[useLocale()];
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

/** 입력이 없는 Paraglide 메시지(m.*) */
export type PlainMessage = (
  inputs: object,
  options: { locale: Locale },
) => string;

/**
 * 값별 Paraglide 메시지 표를 언어별 문자열 표로 읽는다. 표는 언어마다 한 번만 만든다.
 * `const statusLabels = messageTable({ open: m.post_status_open, ... })` → `statusLabels()[s]`
 */
export function messageTable<K extends PropertyKey>(
  messages: Record<K, PlainMessage>,
) {
  const cache = new Map<Locale, Record<K, string>>();
  return (locale: Locale = getLocale()): Record<K, string> => {
    let table = cache.get(locale);
    if (!table) {
      table = Object.fromEntries(
        Object.entries<PlainMessage>(messages).map(([k, message]) => [
          k,
          message({}, { locale }),
        ]),
      ) as Record<K, string>;
      cache.set(locale, table);
    }
    return table;
  };
}
