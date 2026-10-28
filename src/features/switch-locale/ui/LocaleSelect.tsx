"use client";

import { useLocale, useTranslations } from "next-intl";
import { LOCALE_NAMES, LOCALES } from "@/shared/config/locale";
import { setLocale } from "@/shared/lib/i18n";
import { preferencesPopover } from "@/shared/ui/preferences-popover";
import { segmented } from "@/shared/ui/segmented";

const p = preferencesPopover();
const s = segmented();

/**
 * 화면 언어를 고른다. 언어 이름은 각 언어로 적어 화면 언어와 상관없이 같은 글자로 보인다.
 * 버튼 폭은 같게 나눠 언어가 바뀌어도 그대로다.
 */
export function LocaleSelect() {
  const t = useTranslations("LocaleSelect");
  const locale = useLocale();
  return (
    <fieldset className={p.section()}>
      <legend className={p.label()}>{t("label")}</legend>
      <div className={s.root()}>
        {LOCALES.map((value) => (
          <button
            key={value}
            type="button"
            lang={value}
            className={s.item({ class: "min-w-0 basis-0" })}
            aria-pressed={locale === value}
            onClick={() => setLocale(value)}
          >
            <span className="truncate">{LOCALE_NAMES[value]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
