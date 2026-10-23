"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { runSchedulerOnce } from "@/shared/api/feed/queries";

const INTERVAL_MS = 60_000;

/** 프로토타입에는 백그라운드 서버가 없어 화면이 scheduler를 부른다: 바로 한 번, 그 뒤 1분마다. */
export function useSchedulerTick() {
  const client = useQueryClient();
  useEffect(() => {
    runSchedulerOnce(client);
    const timer = setInterval(() => runSchedulerOnce(client), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [client]);
}
