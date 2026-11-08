import type { ReactNode } from "react";

/**
 * 두 언어를 함께 그리고 <html lang>에 맞는 쪽만 보인다. 훅을 쓸 수 없는 서버 컴포넌트(도움말)용이다.
 * 첫 페인트 전에 lang이 정해지므로 정적 HTML에서도 언어가 깜빡이지 않는다.
 * 감싼 요소는 display: contents라 부모의 배치에 끼어들지 않는다.
 */
export function Localized({ ko, en }: { ko: ReactNode; en: ReactNode }) {
  return (
    <>
      <span lang="ko" className="contents lang-en:hidden">
        {ko}
      </span>
      <span lang="en" className="hidden lang-en:contents">
        {en}
      </span>
    </>
  );
}
