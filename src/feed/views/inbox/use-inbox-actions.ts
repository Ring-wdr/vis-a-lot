"use client";

// 알림 읽음·안읽음·보관. 바꾼 뒤 알림함과 안읽음 배지(feedKeys.notifications 아래)를 다시 받는다.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/feed/api/notifications";
import { feedKeys } from "@/feed/api/queries";
import { showAlert } from "@/shared/ui/AlertDialog";
import { errorMessage } from "../post/use-post-action";

export type InboxChange = "read" | "unread" | "archive";

const CALLS = {
  read: notificationsApi.markRead,
  unread: notificationsApi.markUnread,
  archive: notificationsApi.archive,
} satisfies Record<InboxChange, unknown>;

const FAILURES: Record<InboxChange, string> = {
  read: "읽음으로 바꾸지 못했습니다",
  unread: "안읽음으로 바꾸지 못했습니다",
  archive: "보관하지 못했습니다",
};

/** 한 번에 500개까지 받으므로 나눠 보낸다 */
const CHUNK = 500;

export function useInboxAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      change,
      ids,
    }: {
      change: InboxChange;
      ids: string[];
    }) => {
      for (let i = 0; i < ids.length; i += CHUNK)
        await CALLS[change](ids.slice(i, i + CHUNK));
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: feedKeys.notifications }),
        client.invalidateQueries({ queryKey: feedKeys.unreadCount }),
      ]),
    onError: (err, { change }) =>
      showAlert(`${FAILURES[change]}: ${errorMessage(err)}`),
  });
}
