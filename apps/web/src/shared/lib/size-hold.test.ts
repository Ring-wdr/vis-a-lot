import { describe, expect, it, vi } from "vitest";
import { holdSizes, onSizesReleased, sizesHeld } from "./size-hold";

describe("크기 쓰기 미루기", () => {
  it("모든 미룸이 풀릴 때 한 번 알리고, 같은 미룸을 두 번 풀어도 한 번만 센다", () => {
    const released = vi.fn();
    const stop = onSizesReleased(released);
    const a = holdSizes();
    const b = holdSizes();
    expect(sizesHeld()).toBe(true);
    a();
    a();
    expect(sizesHeld()).toBe(true);
    expect(released).not.toHaveBeenCalled();
    b();
    expect(sizesHeld()).toBe(false);
    expect(released).toHaveBeenCalledTimes(1);
    stop();
    holdSizes()();
    expect(released).toHaveBeenCalledTimes(1);
  });
});
