import { describe, expect, it } from "vitest";
import { compileDatetimeFormat } from "./datetime-format";

describe("compileDatetimeFormat", () => {
  it("패턴대로 읽어 ISO 문자열로 바꾼다", () => {
    const read = compileDatetimeFormat("yyyy-MM-dd HH:mm:ss.SSS");
    expect(read("2013-01-01 05:17:00.5")).toBe("2013-01-01 05:17:00.500");
    expect(compileDatetimeFormat("MM/dd/yyyy")("07/28/2023")).toBe(
      "2023-07-28 00:00:00.000",
    );
    expect(compileDatetimeFormat("yyyyMMddHHmmss")("20230728131826")).toBe(
      "2023-07-28 13:18:26.000",
    );
  });

  it("형식이 다르거나 없는 날짜면 null", () => {
    const read = compileDatetimeFormat("yyyy-MM-dd");
    expect(read("2023/07/28")).toBeNull();
    expect(read("2023-02-31")).toBeNull();
    expect(read("2023-13-01")).toBeNull();
  });

  it("연도가 없는 패턴은 받지 않는다", () => {
    expect(() => compileDatetimeFormat("HH:mm")).toThrow(/연도/);
  });
});
