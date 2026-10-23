"use client";

// 상세 화면의 쓰기. 성공하면 목록·상세·이력·요약·알림을 다시 받고, 실패하면 서버 사유를 팝업으로 알린다.

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { invalidatePosts } from "@/shared/api/feed/post-queries";
import { showAlert } from "@/shared/ui/AlertDialog";

export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

export function usePostAction() {
  const client = useQueryClient();
  /** 지금 진행 중인 쓰기 이름 (버튼 잠그기) */
  const [pending, setPending] = useState<string | null>(null);

  /** fn을 돌린다. failure는 "우선순위를 바꾸지 못했습니다"처럼 */
  const run = useCallback(
    async (name: string, failure: string, fn: () => Promise<unknown>) => {
      setPending(name);
      try {
        await fn();
        await invalidatePosts(client);
        return true;
      } catch (err) {
        showAlert(`${failure}: ${errorMessage(err)}`);
        return false;
      } finally {
        setPending(null);
      }
    },
    [client],
  );

  return { run, pending };
}
