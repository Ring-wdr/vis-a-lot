import { msg, plural } from "@lingui/core/macro";
import { expect, test } from "vitest";
import { inAllLocales } from "./lingui";

test("매크로가 descriptor에 넣은 자리표시자 값을 쓴다", () => {
  const count = 3;
  const text = inAllLocales(msg`문서 ${plural(count, { other: "#개" })}`);
  // 카탈로그를 등록하지 않았으므로 모든 언어가 원문(한국어)으로 나온다.
  expect(text.ko).toBe("문서 3개");
  expect(text.en).toBe("문서 3개");
});

test("넘긴 values는 매크로 값에 더한다", () => {
  const name = "차트";
  const text = inAllLocales(msg`${name}: {state}`, { state: "완료" });
  expect(text.ko).toBe("차트: 완료");
});

test("values 함수는 언어마다 부른다", () => {
  const text = inAllLocales(msg`{who}`, (i18n) => ({ who: i18n.locale }));
  expect(text.ko).toBe("ko");
  expect(text.ja).toBe("ja");
});
