import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { throttle } from "./throttle";

describe("throttle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("처음 호출은 바로 부른다", () => {
    const fn = vi.fn();
    throttle(fn, 200)(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it("짧은 시간에 100번 불러도 처음과 마지막만 부른다", () => {
    const fn = vi.fn();
    const t = throttle(fn, 200);
    for (let page = 1; page <= 100; page++) {
      t(page);
      vi.advanceTimersByTime(1);
    }
    vi.advanceTimersByTime(200);
    expect(fn.mock.calls).toEqual([[1], [100]]);
  });

  it("길게 이어지면 wait마다 한 번씩, 마지막 값으로 부른다", () => {
    const fn = vi.fn();
    const t = throttle(fn, 200);
    for (let i = 0; i < 10; i++) {
      t(i);
      vi.advanceTimersByTime(50);
    }
    vi.advanceTimersByTime(200);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(4);
    expect(fn.mock.calls.at(-1)).toEqual([9]);
  });

  it("cancel하면 남은 호출을 버린다", () => {
    const fn = vi.fn();
    const t = throttle(fn, 200);
    t(1);
    t(2);
    t.cancel();
    vi.advanceTimersByTime(300);
    expect(fn.mock.calls).toEqual([[1]]);
  });
});
