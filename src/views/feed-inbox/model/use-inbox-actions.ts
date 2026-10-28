"use client";

// 알림 읽음·안읽음·보관. 바꾼 뒤 알림함과 안읽음 배지(feedKeys.notifications 아래)를 다시 받는다.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/entities/post/model/use-post-action";
import { notificationsApi } from "@/shared/api/feed/notifications";
import { feedKeys } from "@/shared/api/feed/queries";
import { defineMessages, t } from "@/shared/lib/i18n";
import { showAlert } from "@/shared/ui/AlertDialog";

export type InboxChange = "read" | "unread" | "archive";

const CALLS = {
  read: notificationsApi.markRead,
  unread: notificationsApi.markUnread,
  archive: notificationsApi.archive,
} satisfies Record<InboxChange, unknown>;

const messages = defineMessages<{ failures: Record<InboxChange, string> }>({
  ko: {
    failures: {
      read: "읽음으로 바꾸지 못했습니다",
      unread: "안읽음으로 바꾸지 못했습니다",
      archive: "보관하지 못했습니다",
    },
  },
  en: {
    failures: {
      read: "Couldn't mark as read",
      unread: "Couldn't mark as unread",
      archive: "Couldn't archive",
    },
  },
});

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
      showAlert(`${t(messages).failures[change]}: ${errorMessage(err)}`),
  });
}
