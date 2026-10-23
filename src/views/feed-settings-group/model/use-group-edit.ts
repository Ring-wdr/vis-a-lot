"use client";

// 그룹 설정의 쓰기. 성공하면 받은 상세로 그룹 캐시를 바꾸고 그룹 목록·상세를 다시 받는다. 실패는 서버 사유를 팝업으로.

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { errorMessage } from "@/entities/post/model/use-post-action";
import { invalidatePosts } from "@/shared/api/feed/post-queries";
import { feedKeys } from "@/shared/api/feed/queries";
import type { GroupDetail } from "@/shared/api/feed/types";
import { showAlert } from "@/shared/ui/AlertDialog";

export function useGroupEdit(groupId: string) {
  const client = useQueryClient();
  /** 진행 중인 쓰기 이름 (버튼 잠그기) */
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async (
      name: string,
      failure: string,
      fn: () => Promise<GroupDetail | undefined>,
      { posts = false }: { posts?: boolean } = {},
    ) => {
      setPending(name);
      try {
        const detail = await fn();
        if (detail) client.setQueryData(feedKeys.group(groupId), detail);
        // 그룹 목록(상태 이름·멤버 수)과 다른 그룹 상세까지 같은 key 아래에 있다
        await client.invalidateQueries({ queryKey: feedKeys.groups });
        // 유형·팀을 지우면 게시물의 유형·팀이 비므로 목록도 다시 받는다
        if (posts) await invalidatePosts(client);
        return true;
      } catch (err) {
        showAlert(`${failure}: ${errorMessage(err)}`);
        return false;
      } finally {
        setPending(null);
      }
    },
    [client, groupId],
  );

  return { run, pending };
}
