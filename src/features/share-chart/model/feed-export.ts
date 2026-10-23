// 공유를 데이터 공유 피드의 차트 게시물 입력(JSON)으로 만들어 클립보드에 복사한다.
// 설정·item 상태·대표 PNG는 chart 서비스 공유(스냅숏)에서 가져온다.

import { feedExport } from "@/entities/chart/lib/feed-export";
import { sharePageUrl } from "@/entities/chart/lib/share";
import type { DatasetStatus, Share } from "@/shared/api/types";

async function pngDataUrl(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PNG를 받지 못했습니다 (HTTP ${res.status}).`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function copyFeedExport(
  share: Share,
  dataset: Pick<DatasetStatus, "id" | "name" | "kind">,
) {
  const pkg = feedExport({
    shareId: share.id,
    title: share.title,
    thumbnail: await pngDataUrl(share.image.url),
    imageUrl: new URL(share.image.url, location.origin).href,
    link: sharePageUrl(share.id),
    spec: share.spec,
    restore: share.restore,
    dataset,
    item: {
      ...share.item,
      width: share.image.width,
      height: share.image.height,
    },
  });
  await navigator.clipboard.writeText(JSON.stringify(pkg));
  return pkg;
}
