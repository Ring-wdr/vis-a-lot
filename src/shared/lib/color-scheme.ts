"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import type { ChartTheme } from "@/shared/api/types";
import { DARK_QUERY, THEME_STORAGE_KEY } from "@/shared/config/theme";

// 화면 테마. 사용자가 고른 값(시스템·라이트·다크)을 localStorage에 두고, 실제로 쓰는 테마(light·dark)를
// <html data-theme>에 적는다. CSS 토큰(app/globals.css)과 서버가 그리는 PNG의 테마가 이 값을 따른다.
// 첫 페인트 전에는 app/layout.tsx가 넣는 THEME_INIT_SCRIPT(shared/config/theme.ts)가 같은 규칙으로 적는다.

export type ThemePreference = "system" | "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = [
  "system",
  "light",
  "dark",
];

const STORAGE_KEY = THEME_STORAGE_KEY;
/** 같은 탭 안에서 고른 값이 바뀌었음을 알린다 (storage 이벤트는 다른 탭에만 온다). */
const CHANGE_EVENT = "vis-a-lot:theme-change";

function isPreference(v: unknown): v is ThemePreference {
  return v === "system" || v === "light" || v === "dark";
}

export function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function resolve(preference: ThemePreference): ChartTheme {
  if (preference !== "system") return preference;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** 지금 쓰는 테마. 서버 렌더가 없는 곳(SSR)에서는 light */
export function currentColorScheme(): ChartTheme {
  if (typeof window === "undefined") return "light";
  return resolve(readPreference());
}

function apply() {
  document.documentElement.dataset.theme = currentColorScheme();
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // 저장소를 못 쓰면 이번 페이지에서만 바뀐다.
  }
  apply();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** 고른 값, 다른 탭에서 고른 값, 시스템 설정(고른 값이 system일 때)이 바뀌면 알린다. */
function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  const update = () => {
    apply();
    onChange();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) update();
  };
  media.addEventListener("change", update);
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    media.removeEventListener("change", update);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** 지금 쓰는 테마. 바뀌면 다시 렌더해 새 테마로 PNG를 요청하게 한다. */
export function useColorScheme(): ChartTheme {
  return useSyncExternalStore(subscribe, currentColorScheme, () => "light");
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readPreference, () => "system");
}

/**
 * <html data-theme>을 지킨다. 개발 모드의 Strict Mode remount가 React가 모르는 <html> 속성을 지우므로
 * 페인트 전에 다시 적는다 (production에서는 같은 값을 다시 적을 뿐이다). 앱 root에서 한 번 쓴다.
 */
export function useApplyColorScheme() {
  const theme = useColorScheme();
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
}
