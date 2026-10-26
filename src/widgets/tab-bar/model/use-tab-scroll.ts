"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TabScroll = {
  /** 왼쪽·오른쪽에 가려진 탭이 있는지. 둘 다 false면 탭이 다 보인다. */
  canLeft: boolean;
  canRight: boolean;
};

const NONE: TabScroll = { canLeft: false, canRight: false };

/** 누르고 있을 때 한 번에 옮기는 폭. 16ms마다 옮겨 초당 약 750px로 흐른다. */
const NUDGE_PX = 12;
export const NUDGE_INTERVAL_MS = 16;

// 소수점 폭 때문에 끝에서 1px 미만이 남는 경우는 끝으로 본다.
const atEnd = (el: HTMLElement, dir: -1 | 1) =>
  dir < 0
    ? el.scrollLeft <= 1
    : el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;

/**
 * 탭 줄 가로 스크롤. 스크롤바는 숨기므로 넘쳤는지(양옆 버튼을 보일지)를 따로 알려 주고,
 * 세로 휠을 가로 스크롤로 바꾸고, 고른 탭이 보이도록 스크롤한다.
 * `tabCount`·`activeId`가 바뀌면 다시 잰다 (탭을 열고 닫으면 내용 폭이 바뀐다).
 */
export function useTabScroll(tabCount: number, activeId: string | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState<TabScroll>(NONE);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const canLeft = !atEnd(el, -1);
    const canRight = !atEnd(el, 1);
    setScroll((prev) =>
      prev.canLeft === canLeft && prev.canRight === canRight
        ? prev
        : { canLeft, canRight },
    );
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // 트랙패드처럼 가로로 움직이는 휠은 그대로 두고, 세로 휠만 가로로 옮긴다.
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("scroll", measure, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
      el.removeEventListener("wheel", onWheel);
    };
  }, [measure]);

  // 탭을 열거나 고르면 그 탭이 보이게 한다. 처음 넘쳐 양옆 버튼이 생기면 탭 줄이 좁아지므로 한 번 더 맞춘다.
  const overflowing = scroll.canLeft || scroll.canRight;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 탭 수·넘침이 바뀌어도 다시 맞춘다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelector('[aria-selected="true"]')
      ?.closest("[data-tab]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
  }, [tabCount, activeId, overflowing, measure]);

  /** 보이는 폭의 80%만큼 부드럽게 옮긴다 (한 번 누름). 더 갈 곳이 없으면 false */
  const page = useCallback((dir: -1 | 1) => {
    const el = ref.current;
    if (!el || atEnd(el, dir)) return false;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
    return true;
  }, []);

  /** 조금씩 바로 옮긴다 (누르고 있는 동안 짧은 간격으로 불러 흐르듯 움직인다). 끝에 닿으면 false */
  const nudge = useCallback((dir: -1 | 1) => {
    const el = ref.current;
    if (!el || atEnd(el, dir)) return false;
    el.scrollLeft += dir * NUDGE_PX;
    return !atEnd(el, dir);
  }, []);

  return { ref, ...scroll, page, nudge };
}
