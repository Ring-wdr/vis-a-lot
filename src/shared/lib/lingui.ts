import {
  type I18n,
  type Messages as LinguiCatalog,
  i18n as linguiGlobal,
  type MessageDescriptor,
  setupI18n,
} from "@lingui/core";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/shared/config/locale";

// Lingui instance. 훅이 없어 서버 컴포넌트(도움말)도 import한다. 지금 언어(localStorage)는 i18n.ts가 맡는다.
// 언어마다 instance를 하나씩 둔다: 서버 컴포넌트·정적 HTML은 두 언어를 함께 그리고, React context는
// hydration 중에 useLocale의 서버 값(ko)으로 그려야 해서다. 컴포넌트 밖 코드가 쓰는 전역 i18n
// (@lingui/core/macro의 t``)은 i18n.ts가 지금 언어로 activate한다. 그래서 옛 API(useT·t)와 함께 바뀐다.

const instances: Record<Locale, I18n> = {
  ko: setupI18n({ locale: "ko", messages: { ko: {} } }),
  en: setupI18n({ locale: "en", messages: { en: {} } }),
};
linguiGlobal.load({ ko: {}, en: {} });
linguiGlobal.activate(DEFAULT_LOCALE);

/** 그 언어의 Lingui instance. 서버 컴포넌트에서는 `t(linguiFor(lang))\`…\`` */
export function linguiFor(locale: Locale): I18n {
  return instances[locale];
}

/** 전역 i18n(컴포넌트 밖의 t``)을 그 언어로 바꾼다. i18n.ts의 setLocale이 부른다. */
export function activateGlobal(locale: Locale) {
  if (linguiGlobal.locale !== locale) linguiGlobal.activate(locale);
}

/** slice의 컴파일된 카탈로그(config/locales/*.ts)를 등록한다. slice의 config/messages.ts가 모듈 위에서 부른다. */
export function registerCatalog(catalog: Record<Locale, LinguiCatalog>) {
  for (const locale of LOCALES) {
    instances[locale].load(locale, catalog[locale]);
    linguiGlobal.load(locale, catalog[locale]);
  }
}

/** 두 언어로 번역한 문구. 두 언어를 함께 그리는 StableText·Localized에 넘긴다 (정적 HTML). */
export function inBothLocales(
  descriptor: MessageDescriptor,
): Record<Locale, string> {
  return { ko: instances.ko._(descriptor), en: instances.en._(descriptor) };
}
