import type { Locale } from "@/shared/config/locale";

/**
 * 짧은 글자(상단 바·탭·배지)를 두 언어 중 긴 쪽 폭으로 그린다. 두 언어를 한 칸에 겹쳐 두고
 * <html lang>에 맞지 않는 쪽은 visibility로 숨겨, 언어를 바꿔도 폭과 옆 요소의 자리가 그대로다.
 * 훅이 없어 서버 컴포넌트에서도 쓴다. 긴 문장이나 본문에는 쓰지 않는다 (Localized를 쓴다).
 */
export function StableText(text: Record<Locale, string>) {
  return (
    <span className="inline-grid">
      <span lang="ko" className="col-start-1 row-start-1 lang-en:invisible">
        {text.ko}
      </span>
      <span
        lang="en"
        className="invisible col-start-1 row-start-1 lang-en:visible"
      >
        {text.en}
      </span>
    </span>
  );
}
