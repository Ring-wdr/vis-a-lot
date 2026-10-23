"use client";

import {
  Bell,
  ChevronRight,
  ClipboardList,
  Clock,
  Columns3,
  Compass,
  Database,
  FileBarChart,
  Heart,
  Home,
  LayoutGrid,
  List,
  Mail,
  PieChart,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useViews } from "../api/post-queries";
import { useGroups, useMe, useUnreadCount } from "../api/queries";
import type { Group, SavedView } from "../api/types";
import { FEED, groupHref, isCurrent } from "../lib/routes";
import { countBadge, sideHeading, sideLink } from "../ui/styles";

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

const VIEW_ICON: Record<string, ReactNode> = {
  "builtin-explore": <Compass size={ICON} />,
  "builtin-following": <Heart size={ICON} />,
  feed: <LayoutGrid size={ICON} />,
  list: <List size={ICON} />,
  board: <Columns3 size={ICON} />,
};

/** 저장된 뷰 링크. /feed/view?id=…가 지금 화면이면 aria-current */
function ViewLink({
  view,
  groupKey,
}: {
  view: SavedView;
  /** 그룹 뷰면 이름 옆에 접두사(FD)를 붙여 같은 이름을 가른다 */
  groupKey?: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const current =
    pathname.replace(/\/+$/, "") === FEED.view && search.get("id") === view.id;
  return (
    <Link
      href={`${FEED.view}?id=${encodeURIComponent(view.id)}`}
      className={sideLink()}
      aria-current={current ? "page" : undefined}
      title={
        view.shared ? `${view.name} (${groupKey ?? "그룹"} 공유)` : view.name
      }
    >
      <span className="flex-none text-fg-muted" aria-hidden="true">
        {VIEW_ICON[view.id] ?? VIEW_ICON[view.layout]}
      </span>
      <span className="truncate">{view.name}</span>
      {groupKey && (
        <span className="ml-auto flex-none font-mono text-2xs text-fg-muted">
          {groupKey}
        </span>
      )}
    </Link>
  );
}

/** 사이드바 "저장된 뷰": 고정한 뷰(탐색·관심 포함) + 나머지는 "모든 뷰"에 접어 둔다 */
function SavedViewLinks() {
  const views = useViews();
  const groups = useGroups();
  const [open, setOpen] = useState(false);
  const keyOf = (v: SavedView) =>
    groups.data?.find((g) => g.id === v.groupId)?.keyPrefix;
  const pinned = views.data?.filter((v) => v.pinned) ?? [];
  const rest = views.data?.filter((v) => !v.pinned) ?? [];
  return (
    <>
      <p className={sideHeading()}>저장된 뷰</p>
      {views.isPending && (
        <p className="px-2 py-1 text-xs text-fg-muted">뷰를 불러오는 중</p>
      )}
      {views.isError && (
        <p className="px-2 py-1 text-xs text-fg-muted">
          뷰를 불러오지 못했습니다
        </p>
      )}
      <ul className="flex flex-col gap-0.5">
        {pinned.map((v) => (
          <li key={v.id}>
            <ViewLink view={v} groupKey={keyOf(v)} />
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <>
          <button
            type="button"
            className="group/more flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs text-fg-muted hover:bg-panel-hover"
            aria-expanded={open}
            aria-controls="feed-all-views"
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronRight
              size={12}
              className="transition-transform group-aria-expanded/more:rotate-90"
              aria-hidden="true"
            />
            모든 뷰 ({rest.length})
          </button>
          {open && (
            <ul id="feed-all-views" className="flex flex-col gap-0.5">
              {rest.map((v) => (
                <li key={v.id}>
                  <ViewLink view={v} groupKey={keyOf(v)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
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

      <SavedViewLinks />

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
