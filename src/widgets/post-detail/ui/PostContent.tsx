/* biome-ignore-all lint/performance/noImgElement: 게시물 썸네일은 data URL·외부 주소라 next/image 최적화 대상이 아니다. */
"use client";

// 형식별 내용: 차트(썸네일 + vis-a-lot 링크), 이미지, 동영상, 코드.

import { ExternalLink } from "lucide-react";
import { FORMAT_LABELS } from "@/entities/post/lib/labels";
import { linkButton } from "@/shared/ui/button";
import type { PostDetail } from "@/widgets/post-detail/model/detail-type";

type Payload = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/** vis-a-lot 차트 공유에서 온 차트 게시물이면 공유 페이지 경로 */
export function visALotLink(payload: unknown): string | null {
  const p = (payload ?? {}) as Payload;
  return p.source === "vis-a-lot" ? str(p.link) : null;
}

const figure =
  "flex flex-col gap-2 rounded-lg border border-line bg-elevated p-3";
const media =
  "mx-auto block h-auto max-h-80 w-auto max-w-full rounded-md object-contain";

export function PostContent({ post }: { post: PostDetail }) {
  const p = (post.payload ?? {}) as Payload;
  const thumb = post.thumbnail;

  switch (post.format) {
    case "chart": {
      const link = visALotLink(p);
      const chartType = str(p.chartType) ?? str(p.kind);
      return (
        <figure className={figure}>
          {thumb ? (
            <img className={media} src={thumb} alt={`${post.title} 차트`} />
          ) : (
            <p className="text-xs text-fg-muted">차트 이미지가 없습니다.</p>
          )}
          <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
            <span>
              {FORMAT_LABELS.chart}
              {chartType && ` · ${chartType}`}
              {str(p.dataset) && ` · ${str(p.dataset)}`}
            </span>
            {link && (
              <a
                className={linkButton({ class: "self-auto" })}
                href={link}
                target="_blank"
                rel="noopener"
              >
                <ExternalLink size={12} aria-hidden="true" />
                vis-a-lot에서 차트 열기
              </a>
            )}
          </figcaption>
        </figure>
      );
    }
    case "image": {
      const src = str(p.src) ?? thumb;
      return src ? (
        <figure className={figure}>
          <img className={media} src={src} alt={post.title} />
        </figure>
      ) : null;
    }
    case "video": {
      const url = str(p.url);
      return (
        <figure className={figure}>
          {url ? (
            // biome-ignore lint/a11y/useMediaCaption: 사용자가 올린 동영상이라 자막이 없다
            <video
              className={media}
              src={url}
              poster={thumb ?? undefined}
              controls
              preload="none"
            />
          ) : (
            thumb && <img className={media} src={thumb} alt={post.title} />
          )}
          {url && (
            <a
              className={linkButton()}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={12} aria-hidden="true" />
              {url}
            </a>
          )}
        </figure>
      );
    }
    case "code": {
      const code = str(p.code);
      if (!code) return null;
      return (
        <figure className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-panel">
          <figcaption className="border-b border-line px-3 py-1.5 text-2xs font-semibold text-fg-secondary">
            {str(p.language) ?? "코드"}
          </figcaption>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
            <code>{code}</code>
          </pre>
        </figure>
      );
    }
  }
}
