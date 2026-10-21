import { describe, expect, it } from "vitest";
import { windowStart } from "./thumbnail-window";

describe("windowStart", () => {
  it("focus를 가운데 두고 한 칸씩 미끄러진다", () => {
    expect(windowStart(10, 5, 100)).toBe(8);
    expect(windowStart(11, 5, 100)).toBe(9);
  });

  it("짝수 개면 가운데 두 칸 중 왼쪽에 둔다", () => {
    expect(windowStart(10, 6, 100)).toBe(8);
  });

  it("처음과 끝에서는 목록을 꽉 채운 채 멈춘다", () => {
    expect(windowStart(0, 5, 100)).toBe(0);
    expect(windowStart(1, 5, 100)).toBe(0);
    expect(windowStart(99, 5, 100)).toBe(95);
    expect(windowStart(98, 5, 100)).toBe(95);
  });

  it("item이 목록보다 적으면 처음부터 보여준다", () => {
    expect(windowStart(2, 6, 3)).toBe(0);
  });
});
