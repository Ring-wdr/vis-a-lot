"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FEED, groupHref } from "@/shared/config/feed-routes";
import { button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/Loading";
import { PostDetail } from "@/widgets/post-detail/ui/PostDetail";
import "../config/messages";

/** 게시물 상세 (/feed/post?key=FD-12) */
export function PostView() {
  const key = useSearchParams().get("key");
  const router = useRouter();
  const { t } = useLingui();

  if (!key)
    return (
      <EmptyState
        icon={<FileQuestion size={20} />}
        title={t`게시물 키가 없습니다`}
      >
        <p>
          <Trans>주소에 ?key=FD-12처럼 이슈 키를 붙여 엽니다.</Trans>
        </p>
        <Link
          href={FEED.home}
          className={button({ size: "sm", class: "mt-2" })}
        >
          <Trans>홈 피드로</Trans>
        </Link>
      </EmptyState>
    );

  return (
    <div className="mx-auto w-full max-w-280 p-4 md:p-6">
      <PostDetail
        key={key}
        postKey={key}
        mode="page"
        // 지우면 그 그룹 목록으로 간다 (키 접두사 = 그룹)
        onDeleted={() => router.push(groupHref(FEED.list, key.split("-")[0]))}
      />
    </div>
  );
}
