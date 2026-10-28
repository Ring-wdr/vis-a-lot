"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  setThemePreference,
  THEME_PREFERENCES,
  type ThemePreference,
  useThemePreference,
} from "@/shared/lib/color-scheme";
import { useLocale } from "@/shared/lib/i18n";
import * as m from "@/shared/lib/paraglide/messages/_index.js";
import { preferencesPopover } from "@/shared/ui/preferences-popover";
import { segmented } from "@/shared/ui/segmented";

const NAME: Record<ThemePreference, typeof m.switch_theme_system> = {
  system: m.switch_theme_system,
  light: m.switch_theme_light,
  dark: m.switch_theme_dark,
};

const ICON: Record<ThemePreference, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const p = preferencesPopover();
const s = segmented();

/**
 * 화면 테마: 시스템·라이트·다크 중 하나를 고른다. 차트 PNG도 바뀐 테마로 다시 그린다
 * (현재 페이지만, resize와 같은 규칙). 버튼 폭은 같게 나눠 언어가 바뀌어도 그대로다.
 */
export function ThemeSelect() {
  const locale = useLocale();
  const preference = useThemePreference();
  return (
    <fieldset className={p.section()}>
      <legend className={p.label()}>
        {m.switch_theme_label({}, { locale })}
      </legend>
      <div className={s.root()}>
        {THEME_PREFERENCES.map((value) => {
          const Icon = ICON[value];
          return (
            <button
              key={value}
              type="button"
              className={s.item({ class: "min-w-0 basis-0" })}
              aria-pressed={preference === value}
              onClick={() => setThemePreference(value)}
            >
              <Icon size={13} className="flex-none" aria-hidden="true" />
              <span className="truncate">{NAME[value]({}, { locale })}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
