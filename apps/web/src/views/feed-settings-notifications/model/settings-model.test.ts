import { describe, expect, it } from "vitest";
import {
  defaultSetting,
  defaultSettings,
  sameSettings,
} from "./settings-model";

describe("알림 설정 기본값", () => {
  it("스펙 알림 표와 같다", () => {
    expect(defaultSetting("mention")).toEqual({
      kind: "mention",
      inapp: true,
      slack: true,
      email: false,
    });
    expect(defaultSetting("overdue")).toMatchObject({
      slack: true,
      email: true,
    });
    expect(defaultSetting("comment")).toMatchObject({
      slack: false,
      email: false,
    });
  });

  it("같은 설정인지 이벤트별로 비교한다", () => {
    const base = defaultSettings(["comment", "mention"]);
    expect(sameSettings(base, [...base].reverse())).toBe(true);
    expect(sameSettings(base, [{ ...base[0], inapp: false }, base[1]])).toBe(
      false,
    );
  });
});
