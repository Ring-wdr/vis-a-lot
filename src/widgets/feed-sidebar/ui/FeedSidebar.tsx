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
import { useViews } from "@/shared/api/feed/post-queries";
import { useGroups, useMe, useUnreadCount } from "@/shared/api/feed/queries";
import type { Group, SavedView } from "@/shared/api/feed/types";
import { FEED, groupHref, isCurrent } from "@/shared/config/feed-routes";
import { defineMessages, useT } from "@/shared/lib/i18n";
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
      className={sideLink({ class: "whitespace-nowrap" })}
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

const messages = defineMessages({
  ko: {
    list: "리스트",
    board: "보드",
    reportActivity: "활동 보고",
    reportStatus: "현황 보고",
    groupSettings: "그룹 설정",
    sharedIn: (group: string | undefined) => `${group ?? "그룹"} 공유`,
    savedViews: "저장된 뷰",
    loadingViews: "뷰를 불러오는 중",
    viewsFailed: "뷰를 불러오지 못했습니다",
    allViews: (n: number) => `모든 뷰 (${n})`,
    nav: "피드",
    feed: "피드",
    home: "홈",
    my: "내 작업",
    inbox: "알림함",
    unread: "개 안읽음",
    loadingGroups: "그룹을 불러오는 중",
    groupsFailed: (reason: string) => `그룹을 불러오지 못했습니다 (${reason})`,
    admin: "관리 콘솔",
    dev: "개발 장치",
    outbox: "발송 로그",
    seed: "시드",
    clock: "시계",
  },
  en: {
    list: "List",
    board: "Board",
    reportActivity: "Activity report",
    reportStatus: "Status report",
    groupSettings: "Group settings",
    sharedIn: (group: string | undefined) =>
      group ? `shared in ${group}` : "shared with group",
    savedViews: "Saved views",
    loadingViews: "Loading views",
    viewsFailed: "Couldn't load views",
    allViews: (n: number) => `All views (${n})`,
    nav: "Feed",
    feed: "Feed",
    home: "Home",
    my: "My work",
    inbox: "Inbox",
    unread: " unread",
    loadingGroups: "Loading groups",
    groupsFailed: (reason: string) => `Couldn't load groups (${reason})`,
    admin: "Admin console",
    dev: "Dev tools",
    outbox: "Outbox log",
    seed: "Seed",
    clock: "Clock",
  },
});

function GroupLinks({ group, admin }: { group: Group; admin: boolean }) {
  const text = useT(messages);
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
            {text.list}
          </SideLink>
        </li>
        <li>
          <SideLink
            href={groupHref(FEED.board, key)}
            icon={<Columns3 size={ICON} />}
          >
            {text.board}
          </SideLink>
        </li>
        <li>
          <SideLink
            href={groupHref(FEED.reportActivity, key)}
            icon={<FileBarChart size={ICON} />}
          >
            {text.reportActivity}
          </SideLink>
        </li>
        <li>
          <SideLink
            href={groupHref(FEED.reportStatus, key)}
            icon={<PieChart size={ICON} />}
          >
            {text.reportStatus}
          </SideLink>
        </li>
        {admin && (
          <li>
            <SideLink
              href={groupHref(FEED.settingsGroup, key)}
              icon={<Settings size={ICON} />}
            >
              {text.groupSettings}
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
  const text = useT(messages);
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
        view.shared ? `${view.name} (${text.sharedIn(groupKey)})` : view.name
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
  const text = useT(messages);
  const views = useViews();
  const groups = useGroups();
  const [open, setOpen] = useState(false);
  const keyOf = (v: SavedView) =>
    groups.data?.find((g) => g.id === v.groupId)?.keyPrefix;
  const pinned = views.data?.filter((v) => v.pinned) ?? [];
  const rest = views.data?.filter((v) => !v.pinned) ?? [];
  return (
    <>
      <p className={sideHeading()}>{text.savedViews}</p>
      {views.isPending && (
        <p className="px-2 py-1 text-xs text-fg-muted">{text.loadingViews}</p>
      )}
      {views.isError && (
        <p className="px-2 py-1 text-xs text-fg-muted">{text.viewsFailed}</p>
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
            {text.allViews(rest.length)}
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
  const text = useT(messages);
  const groups = useGroups();
  const unread = useUnreadCount();
  const me = useMe();
  const systemAdmin = me.data?.isAdmin === true;

  return (
    <nav className="h-full overflow-y-auto p-2" aria-label={text.nav}>
      {/* 안쪽 상자는 내용만큼 늘어나 스크롤되고(항목이 찌그러지지 않게), 짧으면 화면 높이를 채워 개발 장치를 아래에 붙인다 */}
      <div className="flex min-h-full flex-col gap-0.5">
        <Link
          href={FEED.home}
          className="mb-2 px-2 py-1.5 text-base font-bold text-fg no-underline"
        >
          {text.feed}
        </Link>
        <SideLink href={FEED.home} icon={<Home size={ICON} />}>
          {text.home}
        </SideLink>
        <SideLink href={FEED.my} icon={<ClipboardList size={ICON} />}>
          {text.my}
        </SideLink>
        <SideLink href={FEED.inbox} icon={<Bell size={ICON} />}>
          {text.inbox}
          {!!unread.data && (
            <span className={countBadge()}>
              {unread.data > 99 ? "99+" : unread.data}
              <span className="sr-only">{text.unread}</span>
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
          <p className="px-2 py-1 text-xs text-fg-muted">
            {text.loadingGroups}
          </p>
        )}
        {groups.isError && (
          <p className="px-2 py-1 text-xs text-fg-muted">
            {text.groupsFailed(groups.error.message)}
          </p>
        )}

        <SavedViewLinks />

        <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-2">
          {systemAdmin && (
            <SideLink href={FEED.admin} icon={<Shield size={ICON} />}>
              {text.admin}
            </SideLink>
          )}
          <p className={sideHeading({ class: "mt-1" })}>{text.dev}</p>
          <SideLink href={FEED.devOutbox} icon={<Mail size={ICON} />}>
            {text.outbox}
          </SideLink>
          <SideLink href={FEED.devSeed} icon={<Database size={ICON} />}>
            {text.seed}
          </SideLink>
          <SideLink href={FEED.devClock} icon={<Clock size={ICON} />}>
            {text.clock}
          </SideLink>
        </div>
      </div>
    </nav>
  );
}
