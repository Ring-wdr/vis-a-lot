"use client";

import { useCallback, useState } from "react";

export type ElementSize = { width: number; height: number };

/**
 * 요소의 content box 크기를 ResizeObserver로 따라간다.
 * 크기가 같으면 이전 객체를 그대로 둬, 크기를 의존성으로 쓰는 effect·debounce가 헛돌지 않게 한다.
 */
export function useElementSize<T extends Element>() {
  const [size, setSize] = useState<ElementSize>();
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev?.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}
