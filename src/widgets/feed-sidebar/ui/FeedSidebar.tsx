"use client";

import {
  Bell,
  BookmarkCheck,
  ClipboardList,
  Clock,
  Columns3,
  Database,
  FileBarChart,
  Home,
  List,
  Mail,
  PieChart,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useGroups, useMe, useUnreadCount } from "@/shared/api/feed/queries";
import type { Group } from "@/shared/api/feed/types";
import { FEED, groupHref, isCurrent } from "@/shared/config/feed-routes";
import { countBadge, sideHeading, sideLink } from "@/shared/ui/feed-styles";

function SideLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  return (
    <Link
      href={href}
      className={sideLink()}
      aria-current={isCurrent(href, pathname, search) ? "page" : undefined}
    >
      <span className="flex-none text-fg-muted" aria-hidden="true">
        {icon}
      </span>
      {children}
    </Link>
  );
}

const ICON = 14;

function GroupLinks({ group, admin }: { group: Group; admin: boolean }) {
  const key = group.keyPrefix;
  return (
    <li>
      <p className={sideHeading()} title={group.name}>
        {group.name}
        <span className="ml-1 font-mono font-normal">{key}</span>
      </p>
      <ul className="flex flex-col gap-0.5">
        <li>
          <SideLink
            href={groupHref(FEED.list, key)}
            icon={<List size={ICON} />}
          >
            리스트
          </SideLink>
        </li>
        <li>
          <SideLink
            href={groupHref(FEED.board, key)}
            icon={<Columns3 size={ICON} />}
          >
            보드
          </SideLink>
        </li>
        <li>
          <SideLink
            href={groupHref(FEED.reportActivity, key)}
            icon={<FileBarChart size={ICON} />}
          >
            활동 보고
          </SideLink>
        </li>
        <li>
          <SideLink
            href={groupHref(FEED.reportStatus, key)}
            icon={<PieChart size={ICON} />}
          >
            현황 보고
          </SideLink>
        </li>
        {admin && (
          <li>
            <SideLink
              href={groupHref(FEED.settingsGroup, key)}
              icon={<Settings size={ICON} />}
            >
              그룹 설정
            </SideLink>
          </li>
        )}
      </ul>
    </li>
  );
}

/** 왼쪽 사이드바: 개인 화면, 그룹별 화면, 저장된 뷰, 관리·개발 장치 */
export function FeedSidebar() {
  const groups = useGroups();
  const unread = useUnreadCount();
  const me = useMe();
  const systemAdmin = me.data?.isAdmin === true;

  return (
    <nav
      className="flex h-full flex-col gap-0.5 overflow-y-auto p-2"
      aria-label="피드"
    >
      <Link
        href={FEED.home}
        className="mb-2 px-2 py-1.5 text-base font-bold text-fg no-underline"
      >
        피드
      </Link>
      <SideLink href={FEED.home} icon={<Home size={ICON} />}>
        홈
      </SideLink>
      <SideLink href={FEED.my} icon={<ClipboardList size={ICON} />}>
        내 작업
      </SideLink>
      <SideLink href={FEED.inbox} icon={<Bell size={ICON} />}>
        알림함
        {!!unread.data && (
          <span className={countBadge()}>
            {unread.data > 99 ? "99+" : unread.data}
            <span className="sr-only">개 안읽음</span>
          </span>
        )}
      </SideLink>

      <ul className="flex flex-col">
        {groups.data?.map((g) => (
          <GroupLinks
            key={g.id}
            group={g}
            admin={g.myRole === "admin" || systemAdmin}
          />
        ))}
      </ul>
      {groups.isPending && (
        <p className="px-2 py-1 text-xs text-fg-muted">그룹을 불러오는 중</p>
      )}
      {groups.isError && (
        <p className="px-2 py-1 text-xs text-fg-muted">
          그룹을 불러오지 못했습니다 ({groups.error.message})
        </p>
      )}

      <p className={sideHeading()}>저장된 뷰</p>
      <p className="flex items-center gap-2 px-2 py-1 text-xs text-fg-muted">
        <BookmarkCheck size={ICON} aria-hidden="true" />
        고정한 뷰가 여기에 나옵니다
      </p>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-2">
        {systemAdmin && (
          <SideLink href={FEED.admin} icon={<Shield size={ICON} />}>
            관리 콘솔
          </SideLink>
        )}
        <p className={sideHeading({ class: "mt-1" })}>개발 장치</p>
        <SideLink href={FEED.devOutbox} icon={<Mail size={ICON} />}>
          발송 로그
        </SideLink>
        <SideLink href={FEED.devSeed} icon={<Database size={ICON} />}>
          시드
        </SideLink>
        <SideLink href={FEED.devClock} icon={<Clock size={ICON} />}>
          시계
        </SideLink>
      </div>
    </nav>
  );
}
