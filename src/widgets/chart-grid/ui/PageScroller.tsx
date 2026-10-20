"use client";

import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { throttle } from "@/shared/lib/throttle";
import styles from "@/shared/ui/workspace.module.css";

/** 브라우저가 다룰 수 있는 요소 높이를 넘지 않도록 트랙 길이를 제한한다 (Firefox는 약 1,700만 px). */
const MAX_TRACK_PX = 8_000_000;
/** 서버에서 페이지를 받아오는 간격. 휙 내려도 이 간격으로만 조회한다. */
const FETCH_THROTTLE_MS = 200;
/** 스크롤이 멈추고 이만큼 지나면 페이지 경계에 맞춘다. */
const SETTLE_MS = 150;

export type PageScrollerHandle = {
  /** grid 위에서 굴린 휠을 이 스크롤바로 넘긴다. */
  wheel: (deltaY: number) => void;
};

/**
 * grid 오른쪽의 페이지 스크롤바. 트랙 길이가 페이지 수에 비례해 thumb 위치가 곧 페이지다.
 * 스크롤하는 동안 보이는 페이지(onViewPage)는 바로 바꾸고, 서버 조회 페이지(onPage)는
 * throttle로만 바꿔 100페이지를 한 번에 내려도 조회가 100번 일어나지 않게 한다.
 */
export function PageScroller({
  ref,
  controls,
  page,
  totalPages,
  onPage,
  onViewPage,
}: {
  ref?: Ref<PageScrollerHandle>;
  /** 스크롤바가 넘기는 grid의 id */
  controls: string;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  onViewPage: (page: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  // 페이지 하나에 해당하는 트랙 길이. 페이지가 아주 많으면 줄인다.
  const unit = Math.max(1, Math.min(height, MAX_TRACK_PX / totalPages));
  const callbacks = useRef({ onPage, onViewPage });
  callbacks.current = { onPage, onViewPage };
  /** 코드로 옮긴 위치. 그때 나는 scroll 이벤트는 사용자 스크롤이 아니므로 무시한다. */
  const programmatic = useRef<number | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchPage = useMemo(
    () =>
      throttle((p: number) => callbacks.current.onPage(p), FETCH_THROTTLE_MS),
    [],
  );
  useEffect(
    () => () => {
      fetchPage.cancel();
      clearTimeout(settleTimer.current);
    },
    [fetchPage],
  );

  const scrollTo = (top: number) => {
    const s = el.current;
    if (!s || Math.abs(s.scrollTop - top) < 1) return;
    programmatic.current = top;
    s.scrollTop = top;
  };

  useImperativeHandle(ref, () => ({
    wheel: (deltaY) => {
      // 휠 이동량은 화면 높이 기준이므로 줄어든 트랙 길이에 맞춰 환산한다.
      if (el.current && height > 0)
        el.current.scrollTop += deltaY * (unit / height);
    },
  }));

  // 페이지가 밖에서 바뀌면(이전/다음 버튼, grid 변경) 스크롤 위치를 맞춘다.
  useEffect(() => {
    const s = el.current;
    if (!s) return;
    if (Math.round(s.scrollTop / unit) !== page) scrollTo(page * unit);
  });

  useEffect(() => {
    const s = el.current;
    if (!s) return;
    const observer = new ResizeObserver(([entry]) =>
      setHeight(entry.contentRect.height),
    );
    observer.observe(s);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={el}
      className={styles.pageScroller}
      role="scrollbar"
      aria-controls={controls}
      aria-orientation="vertical"
      aria-label="페이지"
      aria-valuemin={1}
      aria-valuemax={totalPages}
      aria-valuenow={page + 1}
      tabIndex={totalPages > 1 ? 0 : -1}
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        if (
          programmatic.current !== null &&
          Math.abs(top - programmatic.current) < 1
        ) {
          programmatic.current = null;
          return;
        }
        programmatic.current = null;
        const next = Math.min(
          totalPages - 1,
          Math.max(0, Math.round(top / unit)),
        );
        callbacks.current.onViewPage(next);
        fetchPage(next);
        clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(
          () => scrollTo(next * unit),
          SETTLE_MS,
        );
      }}
    >
      <div style={{ height: totalPages * unit }} />
    </div>
  );
}
