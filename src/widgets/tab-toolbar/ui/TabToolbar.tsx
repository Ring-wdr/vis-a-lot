"use client";

import { ChartActionBar } from "@/features/chart-actions/ui/ChartActionBar";
import { ModeBar } from "@/features/select-mode/ui/ModeBar";
import { ChartFeedExportButton } from "@/features/share-chart/ui/FeedExportButton";
import { ShareButton } from "@/features/share-chart/ui/ShareButton";

/** 탭 안 도구 줄: 이 탭 차트의 모드, 차트 도구와 공유(링크 복사, 피드로 보내기). 탭마다 작업 상태가 따로라 탭 바 아래, 탭 내용 쪽에 둔다. */
export function TabToolbar() {
  return (
    // 탭 바 바로 아래, 탭 내용과 같은 배경이라 그 탭에 속해 보인다.
    <div className="col-span-full flex items-center gap-3 border-b border-line bg-surface px-4">
      <ModeBar />
      {/* 모드 바와 차트 도구 사이 구분선 */}
      <span className="my-2 w-px self-stretch bg-line" aria-hidden="true" />
      <ChartActionBar />
      <div className="ml-auto flex items-center gap-2">
        <ShareButton />
        <ChartFeedExportButton />
      </div>
    </div>
  );
}
