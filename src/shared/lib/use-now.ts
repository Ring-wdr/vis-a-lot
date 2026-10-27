"use client";

import { useEffect, useState } from "react";

/** 지금 시각(ms). `interval`마다 다시 그려 흐르게 한다. `active`가 false면 멈춘다. */
export function useNow(interval = 1_000, active = true) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [active, interval]);
  return now;
}
