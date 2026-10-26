import { CircleHelp, LayoutGrid, Newspaper } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/features/switch-theme/ui/ThemeToggle";
import { HELP_ROOT } from "@/shared/config/help";
import { navLink } from "@/shared/ui/nav";
import { HelpSidebar } from "@/widgets/help-sidebar/ui/HelpSidebar";

/**
 * 도움말 화면 틀: 상단 바 + 왼쪽 목차 + 본문. 로그인 없이 열리는 정적 페이지라 mock 서버를 띄우지 않는다.
 * 48rem보다 좁으면 목차가 본문 위로 올라간다.
 */
export function HelpShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-fg">
      <header className="z-drawer sticky top-0 flex h-12 items-center gap-4 border-b border-line bg-surface px-4">
        <Link
          href={HELP_ROOT}
          className="flex items-center gap-1.5 text-base font-bold text-fg"
        >
          <CircleHelp size={16} aria-hidden="true" />
          vis-a-lot 도움말
        </Link>
        <nav className="ml-auto flex items-center gap-1" aria-label="서비스">
          <Link href="/" className={navLink()}>
            <LayoutGrid size={14} aria-hidden="true" />
            시각화
          </Link>
          <Link href="/feed" className={navLink()}>
            <Newspaper size={14} aria-hidden="true" />
            피드
          </Link>
          <ThemeToggle />
        </nav>
      </header>
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-6 md:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="md:sticky md:top-18 md:max-h-[calc(100dvh-6rem)] md:self-start md:overflow-y-auto">
          <HelpSidebar />
        </aside>
        <main className="max-w-3xl min-w-0 pb-16">{children}</main>
      </div>
    </div>
  );
}
