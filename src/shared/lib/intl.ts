// next-intl(use-intl) 연결. 고른 언어는 여전히 i18n.ts(localStorage + <html lang>)가 정하고, 여기서는 그 언어로
// next-intl의 translator·formatter를 만든다. 컴포넌트는 next-intl의 useTranslations(Provider는 application/IntlRoot),
// 컴포넌트 밖 함수는 intlTranslator로 읽는다.
//
// 문구는 ICU 문자열이다: "{n, number}분 전", "{kind, select, a {…} other {…}}". 작은따옴표는 ICU의 escape 문자라
// '{x}'처럼 중괄호 앞뒤에 쓰려면 ''{x}''로 두 번 적는다.

import {
  _createCache,
  createFormatter,
  createTranslator,
  type DateTimeFormatOptions,
} from "next-intl";
import { getLocale, type Locale } from "@/shared/lib/i18n";

/** 모든 translator·formatter가 함께 쓰는 Intl 포매터 캐시 (언어·옵션마다 Intl 객체를 한 번만 만든다). */
const cache = _createCache();

/** 브라우저의 시간대. 정하지 않으면 next-intl이 날짜를 그릴 때마다 경고한다. */
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * 컴포넌트 밖에서 쓰는 translator. 부를 때의 언어(기본은 지금 언어)로 만들고 언어마다 하나씩 둔다.
 * 그리는 컴포넌트는 useLocale로 언어 변경을 구독한다.
 */
export function intlTranslator<const M extends Record<string, unknown>>(
  messages: Readonly<Record<Locale, M>>,
) {
  const make = (locale: Locale) =>
    createTranslator({
      locale,
      messages: messages[locale],
      timeZone,
      _cache: cache,
    });
  const translators = new Map<Locale, ReturnType<typeof make>>();
  return (locale: Locale = getLocale()) => {
    let t = translators.get(locale);
    if (!t) {
      t = make(locale);
      translators.set(locale, t);
    }
    return t;
  };
}

const formatters = new Map<Locale, ReturnType<typeof createFormatter>>();

/** 지금 언어(또는 넘긴 언어)의 next-intl formatter. `intlFormat().dateTime(at, {dateStyle: "medium"})` */
export function intlFormat(locale: Locale = getLocale()) {
  let f = formatters.get(locale);
  if (!f) {
    f = createFormatter({ locale, timeZone, _cache: cache });
    formatters.set(locale, f);
  }
  return f;
}

export type { DateTimeFormatOptions };
