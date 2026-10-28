"use client";

// 알림함 (/feed/inbox): 받은 알림·안읽음·보관함 탭(?tab=), 게시물별 묶음(최근 순).
// 묶음을 누르면 옆 패널로 게시물을 열고 그 묶음을 읽음으로 바꾼다.

import { Archive, CheckCheck, Inbox, Mail, MailOpen } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { notifyKindLabels, statusLabel } from "@/entities/post/lib/labels";
import { chip, statusBadge } from "@/entities/post/ui/styles";
import { useGroupMap, useUserMap } from "@/shared/api/feed/lookups";
import { useFeedNow, useInbox } from "@/shared/api/feed/queries";
import type { InboxGroup, Notification } from "@/shared/api/feed/types";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { useOpenPeek } from "@/shared/lib/peek";
import { dateTime, relativeTime } from "@/shared/lib/time";
import { cn } from "@/shared/lib/tw";
import { button, itemButton } from "@/shared/ui/button";
import { EmptyState, LoadingText } from "@/shared/ui/Loading";
import { tabStyles, useQueryHref } from "@/shared/ui/tabs";
import { notificationSentence } from "@/views/feed-inbox/lib/notification-text";
import {
  type InboxChange,
  useInboxAction,
} from "@/views/feed-inbox/model/use-inbox-actions";

const tabs = tabStyles();

const messages = defineMessages({
  ko: {
    tabs: { all: "받은 알림", unread: "안읽음", archived: "보관함" },
    title: "알림함",
    unreadTotal: (n: number) => `안읽음 ${n}개`,
    markAllRead: "모두 읽음",
    tabsLabel: "알림함 탭",
    loadFailed: (reason: string) => `알림을 불러오지 못했습니다 (${reason})`,
    retry: "다시 시도",
    loading: "알림을 불러오는 중",
    emptyArchived: "보관한 알림이 없습니다",
    emptyUnread: "안읽은 알림이 없습니다",
    emptyAll: "받은 알림이 없습니다",
    emptyHint:
      "배정·멘션·댓글·상태 변경 등이 생기면 여기에 게시물별로 모입니다.",
    openGroup: (key: string, title: string, unread: number) =>
      `${key} ${title} 열기${unread ? `, 안읽음 ${unread}개` : ""}`,
    groupRead: "묶음 읽음으로",
    groupUnread: "묶음 안읽음으로",
    groupArchive: "묶음 보관",
    unknownUser: "알 수 없음",
    unread: "안읽음",
    markRead: "읽음으로",
    markUnread: "안읽음으로",
    archive: "보관",
  },
  en: {
    tabs: { all: "Inbox", unread: "Unread", archived: "Archived" },
    title: "Inbox",
    unreadTotal: (n: number) => `${n} unread`,
    markAllRead: "Read all",
    tabsLabel: "Inbox tabs",
    loadFailed: (reason: string) => `Couldn't load notifications (${reason})`,
    retry: "Retry",
    loading: "Loading notifications",
    emptyArchived: "No archived notifications",
    emptyUnread: "No unread notifications",
    emptyAll: "No notifications yet",
    emptyHint:
      "Assignments, mentions, comments, status changes and more gather here by post.",
    openGroup: (key: string, title: string, unread: number) =>
      `Open ${key} ${title}${unread ? `, ${unread} unread` : ""}`,
    groupRead: "Mark group as read",
    groupUnread: "Mark group as unread",
    groupArchive: "Archive group",
    unknownUser: "Unknown",
    unread: "Unread",
    markRead: "Mark as read",
    markUnread: "Mark as unread",
    archive: "Archive",
  },
});

const TABS = [
  { id: "all", params: {} },
  { id: "unread", params: { unreadOnly: true } },
  { id: "archived", params: { archived: true } },
] as const;
type TabId = (typeof TABS)[number]["id"];

const parseTab = (v: string | null): TabId =>
  TABS.find((t) => t.id === v)?.id ?? "all";

export function InboxView() {
  const text = useT(messages);
  const search = useSearchParams();
  const tab = parseTab(search.get("tab"));
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const inbox = useInbox(current.params);
  const href = useQueryHref();
  const action = useInboxAction();
  const groups = inbox.data?.groups ?? [];
  const unreadIds = groups.flatMap((g) =>
    g.notifications.filter((n) => !n.readAt).map((n) => n.id),
  );
  const change = (change: InboxChange, ids: string[]) =>
    ids.length && action.mutate({ change, ids });

  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{text.title}</h1>
        {inbox.data && (
          <span className="text-xs text-fg-muted">
            {text.unreadTotal(inbox.data.unreadTotal)}
          </span>
        )}
        <button
          type="button"
          className={button({
            size: "sm",
            class: "ml-auto whitespace-nowrap",
          })}
          disabled={unreadIds.length === 0 || action.isPending}
          onClick={() => change("read", unreadIds)}
        >
          <CheckCheck size={14} aria-hidden="true" />
          {text.markAllRead}
        </button>
      </div>
      <nav aria-label={text.tabsLabel} className={tabs.list()}>
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={href({ tab: t.id === "all" ? null : t.id })}
            className={tabs.tab()}
            aria-current={t.id === tab ? "page" : undefined}
          >
            {text.tabs[t.id]}
            {t.id === "unread" && !!inbox.data?.unreadTotal && (
              <span className={tabs.count()}>{inbox.data.unreadTotal}</span>
            )}
          </Link>
        ))}
      </nav>

      {inbox.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-ui text-danger">
            {text.loadFailed(inbox.error.message)}
          </p>
          <button
            type="button"
            className={button({ size: "sm" })}
            onClick={() => inbox.refetch()}
          >
            {text.retry}
          </button>
        </div>
      ) : inbox.isPending ? (
        <LoadingText>{text.loading}</LoadingText>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} />}
          title={
            tab === "archived"
              ? text.emptyArchived
              : tab === "unread"
                ? text.emptyUnread
                : text.emptyAll
          }
        >
          {text.emptyHint}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3" aria-busy={action.isPending}>
          {groups.map((g) => (
            <InboxGroupItem
              key={g.post.id}
              group={g}
              archived={tab === "archived"}
              busy={action.isPending}
              onChange={change}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function InboxGroupItem({
  group,
  archived,
  busy,
  onChange,
}: {
  group: InboxGroup;
  archived: boolean;
  busy: boolean;
  onChange: (change: InboxChange, ids: string[]) => void;
}) {
  const text = useT(messages);
  const openPeek = useOpenPeek();
  const groupMap = useGroupMap();
  const statusNames = groupMap.get(group.post.groupId)?.statusNames;
  const ids = group.notifications.map((n) => n.id);
  const unread = group.notifications.filter((n) => !n.readAt).map((n) => n.id);

  return (
    <li
      className="flex flex-col overflow-hidden rounded-lg border border-line bg-elevated data-unread:border-accent-line"
      data-unread={group.unread > 0 ? "" : undefined}
    >
      <div className="flex min-w-0 items-center gap-2 border-b border-line bg-panel-subtle px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          aria-label={text.openGroup(
            group.post.key,
            group.post.title,
            group.unread,
          )}
          onClick={() => {
            openPeek(group.post.key);
            if (unread.length) onChange("read", unread);
          }}
        >
          <span className="flex-none font-mono text-xs text-fg-secondary">
            {group.post.key}
          </span>
          <span className="min-w-0 truncate font-semibold hover:underline">
            {group.post.title}
          </span>
          <span className={statusBadge({ status: group.post.status })}>
            {statusLabel(group.post.status, statusNames)}
          </span>
          {group.unread > 0 && (
            <span className={chip({ tone: "accent", class: "tabular-nums" })}>
              {group.unread}
            </span>
          )}
        </button>
        <span className="flex flex-none gap-0.5">
          {unread.length > 0 ? (
            <button
              type="button"
              className={itemButton()}
              aria-label={text.groupRead}
              title={text.groupRead}
              disabled={busy}
              onClick={() => onChange("read", unread)}
            >
              <MailOpen size={13} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className={itemButton()}
              aria-label={text.groupUnread}
              title={text.groupUnread}
              disabled={busy}
              onClick={() => onChange("unread", ids)}
            >
              <Mail size={13} aria-hidden="true" />
            </button>
          )}
          {!archived && (
            <button
              type="button"
              className={itemButton()}
              aria-label={text.groupArchive}
              title={text.groupArchive}
              disabled={busy}
              onClick={() => onChange("archive", ids)}
            >
              <Archive size={13} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
      <ol className="flex flex-col">
        {group.notifications.map((n) => (
          <NotificationRow
            key={n.id}
            n={n}
            archived={archived}
            busy={busy}
            statusNames={statusNames}
            onChange={onChange}
          />
        ))}
      </ol>
    </li>
  );
}

function NotificationRow({
  n,
  archived,
  busy,
  statusNames,
  onChange,
}: {
  n: Notification;
  archived: boolean;
  busy: boolean;
  statusNames: Parameters<typeof statusLabel>[1];
  onChange: (change: InboxChange, ids: string[]) => void;
}) {
  const text = useT(messages);
  const users = useUserMap();
  const userName = (id: string | null) =>
    id ? (users.get(id)?.name ?? id) : text.unknownUser;
  const now = useFeedNow();
  const unread = !n.readAt;

  return (
    <li
      className="group/row flex min-w-0 items-center gap-2.5 border-b border-line px-3 py-2 last:border-b-0"
      data-unread={unread ? "" : undefined}
    >
      <span
        className={cn(
          "size-2 flex-none rounded-full",
          unread ? "bg-accent" : "bg-transparent",
        )}
        aria-hidden="true"
      />
      {unread && <span className="sr-only">{text.unread}</span>}
      <span className={chip({ class: "w-18 justify-center" })}>
        {notifyKindLabels()[n.kind]}
      </span>
      <p
        className={cn(
          "min-w-0 flex-1 text-ui leading-snug",
          unread ? "text-fg" : "text-fg-secondary",
        )}
      >
        {notificationSentence(n, { userName, statusNames })}
        <time
          className="ml-1.5 text-2xs whitespace-nowrap text-fg-muted"
          dateTime={n.event.createdAt}
          title={dateTime().format(new Date(n.event.createdAt))}
        >
          {relativeTime(n.event.createdAt, now)}
        </time>
      </p>
      <span className="flex flex-none gap-0.5">
        <button
          type="button"
          className={itemButton()}
          aria-label={unread ? text.markRead : text.markUnread}
          title={unread ? text.markRead : text.markUnread}
          disabled={busy}
          onClick={() => onChange(unread ? "read" : "unread", [n.id])}
        >
          {unread ? (
            <MailOpen size={13} aria-hidden="true" />
          ) : (
            <Mail size={13} aria-hidden="true" />
          )}
        </button>
        {!archived && (
          <button
            type="button"
            className={itemButton()}
            aria-label={text.archive}
            title={text.archive}
            disabled={busy}
            onClick={() => onChange("archive", [n.id])}
          >
            <Archive size={13} aria-hidden="true" />
          </button>
        )}
      </span>
    </li>
  );
}
