import { describe, expect, it } from "vitest";
import { isCurrent } from "./routes";

const q = (s = "") => new URLSearchParams(s);

describe("isCurrent", () => {
  it("경로가 같으면 지금 화면이다", () => {
    expect(isCurrent("/feed", "/feed", q())).toBe(true);
    expect(isCurrent("/feed", "/feed/", q())).toBe(true);
    expect(isCurrent("/feed", "/feed/my", q())).toBe(false);
  });

  it("g가 있는 링크는 g까지 같아야 한다", () => {
    expect(isCurrent("/feed/list?g=FD", "/feed/list", q("g=FD"))).toBe(true);
    expect(isCurrent("/feed/list?g=FD", "/feed/list", q("g=DX"))).toBe(false);
    expect(isCurrent("/feed/list?g=FD", "/feed/board", q("g=FD"))).toBe(false);
  });

  it("g가 없는 링크는 경로만 본다", () => {
    expect(isCurrent("/feed/inbox", "/feed/inbox", q("g=FD"))).toBe(true);
  });
});
