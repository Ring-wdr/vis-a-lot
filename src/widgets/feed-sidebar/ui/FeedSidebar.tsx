"use client";

import { Trans, useLingui } from "@lingui/react/macro";
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
import { countBadge, sideHeading, sideLink } from "@/shared/ui/feed-styles";
import "../config/messages";

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
            <Trans context="sidebar: group list page">리스트</Trans>
          </SideLink>
        </li>
        <li>
          <SideLink
            href={groupHref(FEED.board, key)}
            icon={<Columns3 size={ICON} />}
          >
            <Trans context="sidebar: group board page">보드</Trans>
          </SideLink>
        </li>
        <li>
          <SideLink
            href={groupHref(FEED.reportActivity, key)}
            icon={<FileBarChart size={ICON} />}
          >
            <Trans>활동 보고</Trans>
          </SideLink>
        </li>
        <li>
          <SideLink
            href={groupHref(FEED.reportStatus, key)}
            icon={<PieChart size={ICON} />}
          >
            <Trans>현황 보고</Trans>
          </SideLink>
        </li>
        {admin && (
          <li>
            <SideLink
              href={groupHref(FEED.settingsGroup, key)}
              icon={<Settings size={ICON} />}
            >
              <Trans>그룹 설정</Trans>
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
  const { t } = useLingui();
  const pathname = usePathname();
  const search = useSearchParams();
  const sharedIn = groupKey
    ? t`${groupKey} 공유`
    : t({
        message: "그룹 공유",
        context: "sidebar tooltip: view shared with a group",
      });
  const current =
    pathname.replace(/\/+$/, "") === FEED.view && search.get("id") === view.id;
  return (
    <Link
      href={`${FEED.view}?id=${encodeURIComponent(view.id)}`}
      className={sideLink()}
      aria-current={current ? "page" : undefined}
      title={view.shared ? `${view.name} (${sharedIn})` : view.name}
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
  const { t } = useLingui();
  const views = useViews();
  const groups = useGroups();
  const [open, setOpen] = useState(false);
  const keyOf = (v: SavedView) =>
    groups.data?.find((g) => g.id === v.groupId)?.keyPrefix;
  const pinned = views.data?.filter((v) => v.pinned) ?? [];
  const rest = views.data?.filter((v) => !v.pinned) ?? [];
  const restCount = rest.length;
  return (
    <>
      <p className={sideHeading()}>
        <Trans>저장된 뷰</Trans>
      </p>
      {views.isPending && (
        <p className="px-2 py-1 text-xs text-fg-muted">
          <Trans>뷰를 불러오는 중</Trans>
        </p>
      )}
      {views.isError && (
        <p className="px-2 py-1 text-xs text-fg-muted">
          <Trans context="sidebar: saved views list">
            뷰를 불러오지 못했습니다
          </Trans>
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
            {t`모든 뷰 (${restCount})`}
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
  const { t } = useLingui();
  const groups = useGroups();
  const unread = useUnreadCount();
  const reason = groups.error?.message;
  const me = useMe();
  const systemAdmin = me.data?.isAdmin === true;

  return (
    <nav className="h-full overflow-y-auto p-2" aria-label={t`피드`}>
      {/* 안쪽 상자는 내용만큼 늘어나 스크롤되고(항목이 찌그러지지 않게), 짧으면 화면 높이를 채워 개발 장치를 아래에 붙인다 */}
      <div className="flex min-h-full flex-col gap-0.5">
        <Link
          href={FEED.home}
          className="mb-2 px-2 py-1.5 text-base font-bold text-fg no-underline"
        >
          <Trans>피드</Trans>
        </Link>
        <SideLink href={FEED.home} icon={<Home size={ICON} />}>
          <Trans>홈</Trans>
        </SideLink>
        <SideLink href={FEED.my} icon={<ClipboardList size={ICON} />}>
          <Trans>내 작업</Trans>
        </SideLink>
        <SideLink href={FEED.inbox} icon={<Bell size={ICON} />}>
          <Trans>알림함</Trans>
          {!!unread.data && (
            <span className={countBadge()}>
              {unread.data > 99 ? "99+" : unread.data}
              <span className="sr-only">
                <Trans
                  context="unit after the unread count"
                  comment="숫자 바로 뒤에 붙는다. 영어는 앞에 공백을 둔다"
                >
                  개 안읽음
                </Trans>
              </span>
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
            <Trans>그룹을 불러오는 중</Trans>
          </p>
        )}
        {groups.isError && (
          <p className="px-2 py-1 text-xs text-fg-muted">
            {t`그룹을 불러오지 못했습니다 (${reason})`}
          </p>
        )}

        <SavedViewLinks />

        <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-2">
          {systemAdmin && (
            <SideLink href={FEED.admin} icon={<Shield size={ICON} />}>
              <Trans>관리 콘솔</Trans>
            </SideLink>
          )}
          <p className={sideHeading({ class: "mt-1" })}>
            <Trans>개발 장치</Trans>
          </p>
          <SideLink href={FEED.devOutbox} icon={<Mail size={ICON} />}>
            <Trans>발송 로그</Trans>
          </SideLink>
          <SideLink href={FEED.devSeed} icon={<Database size={ICON} />}>
            <Trans>시드</Trans>
          </SideLink>
          <SideLink href={FEED.devClock} icon={<Clock size={ICON} />}>
            <Trans>시계</Trans>
          </SideLink>
        </div>
      </div>
    </nav>
  );
}
