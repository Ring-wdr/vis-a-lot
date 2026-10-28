// Paraglide 컴파일 설정. `paraglide-js compile`이 project.inlang 안에서 이 파일을 찾는다.
// 화면 언어는 기존 i18n.ts와 같은 localStorage 키를 읽어, 옛 API와 Paraglide가 늘 같은 언어를 본다.
// 정적 export라 쿠키·URL 전략은 쓰지 않는다 (서버가 요청을 보지 않는다). 서버 렌더는 baseLocale(ko).

/** @type {import("@inlang/paraglide-js").ParaglideConfig} */
export default {
  outdir: "./src/shared/lib/paraglide",
  strategy: ["localStorage", "baseLocale"],
  localStorageKey: "vis-a-lot:locale",
  emitReadme: false,
  emitPrettierIgnore: false,
};
