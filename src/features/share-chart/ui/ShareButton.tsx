"use client";

import { useState } from "react";
import { sharePageUrl } from "@/entities/chart/lib/share";
import { chartTitle } from "@/entities/chart/lib/title";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { createChartShare } from "@/features/share-chart/model/create-share";
import { useColumns } from "@/shared/api/queries";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { showAlert } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";

const messages = defineMessages({
  ko: {
    title: "지금 차트를 공유로 고정하고 공유 페이지 링크를 복사합니다",
    failed: (reason: string) => `링크를 복사하지 못했습니다: ${reason}`,
    copied: "복사됨",
    copy: "링크 복사",
  },
  en: {
    title: "Freeze this chart as a share and copy the share page link",
    failed: (reason: string) => `Couldn't copy the link: ${reason}`,
    copied: "Copied",
    copy: "Copy link",
  },
});

/**
 * 지금 차트를 chart 서비스 공유(스냅숏)로 고정하고 공유 페이지 링크를 복사한다.
 * 대표 이미지는 고른 item, 없으면 처음 그려진 item이다.
 */
export function ShareButton() {
  const text = useT(messages);
  const current = useWorkspace((s) => s.current);
  const selectedItem = useWorkspace((s) => s.selectedItem);
  const columns = useColumns(current?.spec.dataset ?? "");
  const [copied, setCopied] = useState(false);
  // 공유를 만드는 동안
  const [copying, setCopying] = useState(false);

  return (
    <button
      type="button"
      className={button({ size: "sm", class: "whitespace-nowrap" })}
      title={text.title}
      disabled={!current || copying}
      aria-busy={copying}
      onClick={async () => {
        if (!current) return;
        setCopying(true);
        try {
          const share = await createChartShare({
            chartId: current.chartId,
            selectedItem,
            title: chartTitle(current.spec, columns),
          });
          await navigator.clipboard.writeText(sharePageUrl(share.id));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          showAlert(
            text.failed(err instanceof Error ? err.message : String(err)),
          );
        } finally {
          setCopying(false);
        }
      }}
    >
      {copying && <Spinner size="sm" />}
      {copied ? text.copied : text.copy}
    </button>
  );
}
