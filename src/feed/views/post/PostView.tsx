"use client";

import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FEED, groupHref } from "@/feed/lib/routes";
import { button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/Loading";
import { PostDetail } from "./PostDetail";

/** 게시물 상세 (/feed/post?key=FD-12) */
export function PostView() {
  const key = useSearchParams().get("key");
  const router = useRouter();

  if (!key)
    return (
      <EmptyState
        icon={<FileQuestion size={20} />}
        title="게시물 키가 없습니다"
      >
        <p>주소에 ?key=FD-12처럼 이슈 키를 붙여 엽니다.</p>
        <Link
          href={FEED.home}
          className={button({ size: "sm", class: "mt-2" })}
        >
          홈 피드로
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
