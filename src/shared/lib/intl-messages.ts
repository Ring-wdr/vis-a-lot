// 언어별 ICU 문구 표를 정의한다. 서버 컴포넌트(도움말)에서도 읽으므로 훅·브라우저 API를 import하지 않는다.

import type { Locale } from "@/shared/config/locale";

/** ko와 같은 키를 가진 표. 값은 문자열이기만 하면 된다 (인자 검사는 ko 문구로 한다). */
type SameShape<M> = {
  [K in keyof M]: M[K] extends string ? string : SameShape<M[K]>;
};

/**
 * slice 하나의 언어별 ICU 문구. ko의 문자열은 literal type으로 남아 next-intl이 인자({name}, {n, number})를 검사한다.
 * en은 ko와 같은 키여야 한다.
 */
export function defineIntlMessages<
  const M extends Record<string, unknown>,
>(messages: { ko: M; en: SameShape<NoInfer<M>> }): Readonly<Record<Locale, M>> {
  return messages as Record<Locale, M>;
}
