"use client";

import { useState } from "react";
import { chartTitle } from "@/entities/chart/lib/title";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { createChartShare } from "@/features/share-chart/model/create-share";
import { copyFeedExport } from "@/features/share-chart/model/feed-export";
import { useColumns, useDatasets } from "@/shared/api/queries";
import type { Share } from "@/shared/api/types";
import { showAlert } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";

/**
 * 공유를 데이터 공유 피드의 차트 게시물 입력(JSON: 공유 id·제목·PNG 썸네일·공유 페이지 링크·설정)으로 복사한다.
 * 공유는 누를 때 share()로 받는다 (탭 도구 줄은 새로 만들고, 공유 페이지는 보고 있는 것을 쓴다).
 */
export function FeedExportButton({
  share,
  disabled = false,
}: {
  share: () => Promise<Share>;
  disabled?: boolean;
}) {
  const datasets = useDatasets().data?.datasets;
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  return (
    <button
      type="button"
      className={button({ size: "sm" })}
      title="차트를 데이터 공유 피드에 게시물로 붙여넣을 수 있게 복사합니다"
      disabled={disabled || copying}
      aria-busy={copying}
      onClick={async () => {
        setCopying(true);
        try {
          const shared = await share();
          const dataset = datasets?.find((d) => d.id === shared.dataset);
          const pkg = await copyFeedExport(shared, {
            id: shared.dataset,
            name: dataset?.name ?? shared.dataset,
            kind: dataset?.kind ?? "upload",
          });
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          if (!pkg.portable)
            showAlert(
              "업로드한 데이터의 차트라 게시물의 링크는 이 브라우저에서만 열립니다. 이미지는 그대로 보입니다.",
            );
        } catch (err) {
          showAlert(
            `피드로 복사하지 못했습니다: ${err instanceof Error ? err.message : err}`,
          );
        } finally {
          setCopying(false);
        }
      }}
    >
      {copying && <Spinner size="sm" />}
      {copied ? "복사됨" : "피드로 보내기"}
    </button>
  );
}

/** 탭 도구 줄: 지금 차트로 공유를 만들어 보낸다. 대표 이미지는 고른 item, 없으면 처음 그려진 item */
export function ChartFeedExportButton() {
  const current = useWorkspace((s) => s.current);
  const selectedItem = useWorkspace((s) => s.selectedItem);
  const columns = useColumns(current?.spec.dataset ?? "");
  return (
    <FeedExportButton
      disabled={!current}
      share={() => {
        if (!current) throw new Error("그린 차트가 없습니다.");
        return createChartShare({
          chartId: current.chartId,
          selectedItem,
          title: chartTitle(current.spec, columns),
        });
      }}
    />
  );
}
