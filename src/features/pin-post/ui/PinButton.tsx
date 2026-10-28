"use client";

import { useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pin } from "lucide-react";
import { invalidatePosts } from "@/shared/api/feed/post-queries";
import { postsApi } from "@/shared/api/feed/posts";
import type { PostSummary } from "@/shared/api/feed/types";
import { showAlert } from "@/shared/ui/AlertDialog";
import "../config/messages";

/** 카드 위 끌어올리기(pin) 버튼. 켜져 있으면 홈 피드 맨 앞에 온다 */
export function PinButton({ post }: { post: PostSummary }) {
  const { t } = useLingui();
  const client = useQueryClient();
  const pinned = post.pinnedAt != null;
  const pin = useMutation({
    mutationFn: (on: boolean) => postsApi.pin(post.id, on),
    onSuccess: () => invalidatePosts(client),
    onError: (err) => {
      const message = err.message;
      showAlert(t`끌어올리지 못했습니다: ${message}`);
    },
  });
  const label = pinned ? t`끌어올림 해제` : t`끌어올리기`;
  return (
    <button
      type="button"
      className="inline-grid size-7 cursor-pointer place-items-center rounded-md border border-line bg-elevated/90 text-fg-secondary shadow-xs hover:text-fg disabled:cursor-wait disabled:opacity-60 aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:text-accent"
      aria-pressed={pinned}
      aria-label={`${post.key} ${label}`}
      title={label}
      disabled={pin.isPending}
      onClick={(e) => {
        e.stopPropagation();
        pin.mutate(!pinned);
      }}
    >
      <Pin size={14} fill={pinned ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
