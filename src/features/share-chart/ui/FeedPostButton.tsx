"use client";

import { useState } from "react";
import { chartTitle } from "@/entities/chart/lib/title";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { createChartShare } from "@/features/share-chart/model/create-share";
import { useColumns } from "@/shared/api/queries";
import type { Share } from "@/shared/api/types";
import { defineMessages, t, useT } from "@/shared/lib/i18n";
import { showAlert } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";

const messages = defineMessages({
  ko: {
    title: "이 차트로 데이터 공유 피드에 게시물을 쓰는 화면을 새 탭에서 엽니다",
    failed: (reason: string) => `피드에 올리지 못했습니다: ${reason}`,
    post: "피드에 올리기",
    noChart: "그린 차트가 없습니다.",
  },
  en: {
    title: "Open a new tab to write a data feed post with this chart",
    failed: (reason: string) => `Couldn't post to the feed: ${reason}`,
    post: "Post to feed",
    noChart: "No chart has been drawn.",
  },
});

/** 피드 새 게시물 폼. 같은 출처라 피드가 공유 id로 PNG·설정을 직접 읽는다. */
export const feedNewPostPath = (shareId: string) =>
  `/feed/new?share=${encodeURIComponent(shareId)}`;

/**
 * 공유를 데이터 공유 피드의 차트 게시물로 올린다: 새 탭에 피드 새 게시물 폼(?share=공유 id)을 연다.
 * 공유는 누를 때 share()로 받는다 (탭 도구 줄은 새로 만들고, 공유 페이지는 보고 있는 것을 쓴다).
 */
export function FeedPostButton({
  share,
  disabled = false,
}: {
  share: () => Promise<Share>;
  disabled?: boolean;
}) {
  const text = useT(messages);
  const [opening, setOpening] = useState(false);

  return (
    <button
      type="button"
      className={button({ size: "sm", class: "whitespace-nowrap" })}
      title={text.title}
      disabled={disabled || opening}
      aria-busy={opening}
      onClick={async () => {
        setOpening(true);
        try {
          const shared = await share();
          window.open(feedNewPostPath(shared.id), "_blank", "noopener");
        } catch (err) {
          showAlert(
            text.failed(err instanceof Error ? err.message : String(err)),
          );
        } finally {
          setOpening(false);
        }
      }}
    >
      {opening && <Spinner size="sm" />}
      {text.post}
    </button>
  );
}

/** 탭 도구 줄: 지금 차트로 공유를 만들어 올린다. 대표 이미지는 고른 item, 없으면 처음 그려진 item */
export function ChartFeedPostButton() {
  const current = useWorkspace((s) => s.current);
  const selectedItem = useWorkspace((s) => s.selectedItem);
  const columns = useColumns(current?.spec.dataset ?? "");
  return (
    <FeedPostButton
      disabled={!current}
      share={() => {
        if (!current) throw new Error(t(messages).noChart);
        return createChartShare({
          chartId: current.chartId,
          selectedItem,
          title: chartTitle(current.spec, columns),
        });
      }}
    />
  );
}
