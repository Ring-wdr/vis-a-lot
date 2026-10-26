"use client";

// 게시물 상세. 전체 페이지(/feed/post?key=)와 옆 패널(?peek=)이 같이 쓴다.

import { FileQuestion } from "lucide-react";
import type { ReactNode } from "react";
import { FeedApiError } from "@/feed/api/client";
import { useGroupMap } from "@/feed/api/lookups";
import { usePost } from "@/feed/api/post-queries";
import { button } from "@/shared/ui/button";
import { EmptyState, LoadingText, Skeleton } from "@/shared/ui/Loading";
import { PostActivity } from "./PostActivity";
import { PostAttachments } from "./PostAttachments";
import { PostBody } from "./PostBody";
import { PostChecklist } from "./PostChecklist";
import { PostComments } from "./PostComments";
import { PostContent } from "./PostContent";
import { PostFields } from "./PostFields";
import { PostHeader } from "./PostHeader";
import { type DetailMode, DetailModeContext } from "./PostLink";
import { PostRelations } from "./PostRelations";
import { detail } from "./styles";

const d = detail();

export function PostDetail({
  postKey,
  mode,
  onDeleted,
  toolbar,
}: {
  postKey: string;
  mode: DetailMode;
  /** 지운 뒤 (패널 닫기 / 목록으로) */
  onDeleted: () => void;
  /** 머리 위 줄 (패널의 닫기·전체 페이지 링크) */
  toolbar?: ReactNode;
}) {
  const post = usePost(postKey);
  const groups = useGroupMap();

  if (post.isPending)
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {toolbar}
        <LoadingText>{postKey} 불러오는 중</LoadingText>
        <Skeleton width={70} className="h-5" />
        <Skeleton width={90} />
        <Skeleton width={50} />
      </div>
    );

  if (post.isError) {
    const missing =
      post.error instanceof FeedApiError &&
      (post.error.status === 404 || post.error.status === 403);
    return (
      <div className="flex flex-col gap-3">
        {toolbar}
        <EmptyState
          icon={<FileQuestion size={20} />}
          title={
            missing
              ? "없거나 볼 수 없는 게시물입니다"
              : "게시물을 불러오지 못했습니다"
          }
        >
          {missing ? (
            <p>
              {postKey}는 지워졌거나, 키가 틀렸거나, 비공개 그룹의 게시물입니다.
            </p>
          ) : (
            <>
              <p>{post.error.message}</p>
              <button
                type="button"
                className={button({ size: "sm", class: "mt-2" })}
                onClick={() => post.refetch()}
              >
                다시 시도
              </button>
            </>
          )}
        </EmptyState>
      </div>
    );
  }

  const p = post.data;
  const group = groups.get(p.groupId);
  return (
    <DetailModeContext value={mode}>
      <article className={d.root()} aria-label={`${p.key} ${p.title}`}>
        {toolbar}
        <PostHeader post={p} group={group} onDeleted={onDeleted} />
        <div className={d.columns()}>
          <aside className={d.side()}>
            <PostFields key={p.id} post={p} group={group} />
          </aside>
          <div className={d.main()}>
            <PostContent post={p} />
            <PostBody key={p.id} post={p} />
            <PostChecklist post={p} />
            <PostRelations post={p} />
            <PostAttachments post={p} />
            <PostComments post={p} />
            <PostActivity post={p} group={group} />
          </div>
        </div>
      </article>
    </DetailModeContext>
  );
}
