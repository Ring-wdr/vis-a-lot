"use client";

// 댓글 쓰기. 성공하면 댓글·게시물·알림을 다시 받고, 실패하면 서버 사유를 팝업으로 알린다.

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { invalidateComments } from "@/feed/api/comment-queries";
import { showAlert } from "@/shared/ui/AlertDialog";
import { errorMessage } from "./use-post-action";

export function useCommentAction() {
  const client = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async (name: string, failure: string, fn: () => Promise<unknown>) => {
      setPending(name);
      try {
        await fn();
        await invalidateComments(client);
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
