// 스타일이 다른 컴포넌트로 새지 않게 막는 규칙.
// CSS Modules는 클래스 이름만 가린다. 자손·태그 선택자는 안쪽 컴포넌트까지 입히고,
// 모듈 안의 `button {}`이나 `:global`은 그대로 전역이 된다.

/** @type {import("stylelint").Config} */
export default {
  rules: {
    // 한 클래스는 자기 요소만 꾸민다. `.a .b`, `.a > button`, `.a + .a` 금지.
    "selector-max-combinators": 0,
    "selector-max-compound-selectors": 1,
    // 모듈 안의 태그 선택자는 전역 선택자다.
    "selector-max-type": 0,
    "selector-max-universal": 0,
    "selector-max-id": 0,
    "selector-pseudo-class-disallowed-list": ["global"],
    "declaration-no-important": true,
    // 색은 globals.css의 토큰만 쓴다.
    "color-no-hex": true,
    "color-named": "never",
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla", "oklch", "lab"],
    "color-no-invalid-hex": true,
    "declaration-block-no-duplicate-properties": true,
    "no-duplicate-selectors": true,
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "theme",
          "utility",
          "variant",
          "custom-variant",
          "source",
          "apply",
          "reference",
          "plugin",
        ],
      },
    ],
  },
  overrides: [
    {
      // 토큰을 정의하고 요소 기본값(reset)을 두는 유일한 곳
      files: ["app/globals.css"],
      rules: {
        "selector-max-type": null,
        "selector-max-universal": null,
        "selector-max-compound-selectors": null,
        "selector-max-combinators": null,
        "color-no-hex": null,
        "function-disallowed-list": null,
      },
    },
  ],
  // Tailwind로 옮기는 중인 파일. 옮기면 목록에서 지운다.
  ignoreFiles: [
    "out/**",
    ".next/**",
  ],
};
