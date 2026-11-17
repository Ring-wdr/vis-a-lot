"use client";

import { useEffect } from "react";
import {
  useBoard,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import { placeQueuedDataset } from "@/features/register-dataset/model/open-in-analytics";
import { ApiRequestError } from "@/shared/api/api";
import { useAnalyticsBoard } from "@/shared/api/queries";
import { reopenPanels } from "./reopen-board";

/**
 * /analytics를 처음 열면 저장한 보드를 받아 보드 store를 채우고, 그린 적 있는 칸을 다시 그린다.
 * 저장한 보드가 없으면(404) 빈 칸 하나로 시작한다. 한 번 채운 뒤에는(세션 동안 `/`에 다녀와도) 다시 받지 않는다.
 * datastore의 `analytics에서 열기`가 채우기 전에 맡겨 둔 데이터도 채운 뒤 넣는다.
 */
export function useBoardHydrate() {
  const board = useBoardStore();
  const hydrated = useBoard((s) => s.hydrated);
  const { data, error, refetch, isFetching } = useAnalyticsBoard({
    enabled: !hydrated,
  });
  const notFound = error instanceof ApiRequestError && error.status === 404;

  useEffect(() => {
    if (board.getState().hydrated) return;
    if (data === undefined && !notFound) return;
    const reopen = board.getState().hydrate(data ?? null);
    void reopenPanels(board, reopen);
    void placeQueuedDataset(board);
  }, [board, data, notFound]);

  return {
    hydrated,
    /** 404가 아닌 실패. 이때는 빈 보드로 덮어 저장하지 않도록 채우지 않는다. */
    error: hydrated || notFound ? null : error,
    retry: () => void refetch(),
    retrying: isFetching,
  };
}
