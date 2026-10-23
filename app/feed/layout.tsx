import type { Metadata } from "next";
import type { ReactNode } from "react";
import { FeedClientApp } from "@/application/feed-client-app";

export const metadata: Metadata = {
  title: "피드 · vis-a-lot",
  description: "사내 데이터 공유 피드 프로토타입",
};

/**
 * 피드 화면들. 브라우저 안 mock 서버, 피드 데이터 준비, 사용자 전환, 화면 틀(사이드바·상단 바)을
 * 이 layout이 맡고, 아래 page는 본문만 그린다. vis-a-lot 로그인은 거치지 않는다.
 */
export default function FeedLayout({ children }: { children: ReactNode }) {
  return <FeedClientApp>{children}</FeedClientApp>;
}
