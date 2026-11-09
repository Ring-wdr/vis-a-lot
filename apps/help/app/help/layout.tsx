import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HelpShell } from "@/application/HelpShell";

export const metadata: Metadata = {
  title: "도움말 · vis-a-lot",
  description: "vis-a-lot 서비스별 사용 방법",
};

/** 도움말 화면들. 로그인 없이 열리는 정적 페이지라 (session) 밖에 둔다. */
export default function HelpLayout({ children }: { children: ReactNode }) {
  return <HelpShell>{children}</HelpShell>;
}
