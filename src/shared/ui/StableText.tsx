import { LOCALES, type Locale } from "@/shared/config/locale";

// 언어마다 <html lang>에 맞을 때만 보이는 클래스. 언어를 더하면 app/globals.css의 lang-* 변형과 함께 늘린다.
const VISIBLE: Record<Locale, string> = {
  ko: "col-start-1 row-start-1 lang-en:invisible",
  en: "invisible col-start-1 row-start-1 lang-en:visible",
};

/**
 * 짧은 글자(상단 바·탭·배지)를 모든 언어 중 가장 긴 폭으로 그린다. 언어마다 글자를 한 칸에 겹쳐 두고
 * <html lang>에 맞지 않는 쪽은 visibility로 숨겨, 언어를 바꿔도 폭과 옆 요소의 자리가 그대로다.
 * 훅이 없어 서버 컴포넌트에서도 쓴다. 긴 문장이나 본문에는 쓰지 않는다 (Localized를 쓴다).
 * `<StableText {...inAllLocales(msg\`피드\`)} />`
 */
export function StableText(text: Record<Locale, string>) {
  return (
    <span className="inline-grid">
      {LOCALES.map((locale) => (
        <span key={locale} lang={locale} className={VISIBLE[locale]}>
          {text[locale]}
        </span>
      ))}
    </span>
  );
}
