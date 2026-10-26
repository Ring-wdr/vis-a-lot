// 화면 테마를 저장하는 키와 첫 페인트 전에 테마를 정하는 스크립트. 서버 컴포넌트(app/layout.tsx)와
// 화면 코드(shared/lib/color-scheme.ts)가 함께 쓰므로 "use client" 없이 둔다.

export const THEME_STORAGE_KEY = "vis-a-lot:theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * <head>에서 HTML을 읽는 동안 바로 실행해 첫 페인트부터 맞는 테마로 보이게 한다.
 * 고른 값이 없거나 system이면 시스템 설정을 따른다 (color-scheme.ts의 resolve와 같은 규칙).
 */
export const THEME_INIT_SCRIPT = `(function(){var p;try{p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}var d=p==="dark"||(p!=="light"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches);document.documentElement.dataset.theme=d?"dark":"light"})()`;
