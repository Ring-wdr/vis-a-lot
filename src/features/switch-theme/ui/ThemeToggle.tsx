"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  setThemePreference,
  THEME_PREFERENCES,
  type ThemePreference,
  useThemePreference,
} from "@/shared/lib/color-scheme";
import { navButton } from "@/shared/ui/nav";

const UI: Record<ThemePreference, { label: string; Icon: typeof Sun }> = {
  system: { label: "시스템", Icon: Monitor },
  light: { label: "라이트", Icon: Sun },
  dark: { label: "다크", Icon: Moon },
};

/**
 * 화면 테마: 누를 때마다 시스템 → 라이트 → 다크 순서로 바꾼다. 차트 PNG도 바뀐 테마로 다시 그린다
 * (현재 페이지만, resize와 같은 규칙).
 */
export function ThemeToggle() {
  const preference = useThemePreference();
  const { label, Icon } = UI[preference];
  const next =
    THEME_PREFERENCES[
      (THEME_PREFERENCES.indexOf(preference) + 1) % THEME_PREFERENCES.length
    ];
  return (
    <button
      type="button"
      className={navButton({ class: "px-2" })}
      title={`테마: ${label} (누르면 ${UI[next].label})`}
      aria-label={`테마: ${label}`}
      onClick={() => setThemePreference(next)}
    >
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}
