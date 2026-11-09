// 새 게시물 폼의 입력 → 게시물 payload·썸네일·첨부.

import type { ChartShareImport, PostFormat } from "@/shared/api/feed/types";

export type FormatInputs = {
  imageUrl: string;
  videoUrl: string;
  language: string;
  code: string;
};

/** 형식별 payload와 썸네일. 비어 있으면 둘 다 null */
export function buildPayload(
  format: PostFormat,
  inputs: FormatInputs,
  share: ChartShareImport | undefined,
): { payload: unknown; thumbnail: string | null } {
  switch (format) {
    case "chart":
      return share
        ? { payload: share.payload, thumbnail: share.thumbnail }
        : { payload: null, thumbnail: null };
    case "image": {
      const src = inputs.imageUrl.trim();
      return src
        ? { payload: { src }, thumbnail: src }
        : { payload: null, thumbnail: null };
    }
    case "video": {
      const url = inputs.videoUrl.trim();
      return { payload: url ? { url } : null, thumbnail: null };
    }
    case "code": {
      const code = inputs.code.replace(/\s+$/, "");
      return {
        payload: code
          ? { language: inputs.language.trim() || "text", code }
          : null,
        thumbnail: null,
      };
    }
  }
}

/** 이름·주소를 다 적은 링크만 첨부로. 이름이 비면 주소를 이름으로 */
export function linkRows(rows: { name: string; url: string }[]) {
  return rows
    .map((r) => ({ name: r.name.trim(), url: r.url.trim() }))
    .filter((r) => r.url)
    .map((r) => ({ kind: "link" as const, name: r.name || r.url, url: r.url }));
}
