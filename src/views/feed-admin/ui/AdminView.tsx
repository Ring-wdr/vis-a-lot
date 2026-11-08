"use client";

// 관리 콘솔 (/feed/admin): 사용자 목록(시스템 관리자 지정·비활성화), 그룹 목록. 시스템 관리자만 본다.

import { useQueryClient } from "@tanstack/react-query";
import { Lock, Settings, ShieldOff, UserX } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { errorMessage } from "@/entities/post/model/use-post-action";
import { useStatusName } from "@/entities/post/ui/post-meta";
import { statusBadge } from "@/entities/post/ui/styles";
import {
  feedKeys,
  useGroups,
  useMe,
  useUsers,
} from "@/shared/api/feed/queries";
import type { DeactivateResponse, FeedUser } from "@/shared/api/feed/types";
import { usersApi } from "@/shared/api/feed/users";
import { FEED, groupHref } from "@/shared/config/feed-routes";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { useOpenPeek } from "@/shared/lib/peek";
import { cn } from "@/shared/lib/tw";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import { Avatar } from "@/shared/ui/Avatar";
import { button } from "@/shared/ui/button";
import { settings } from "@/shared/ui/feed-settings-styles";
import { EmptyState, LoadingText } from "@/shared/ui/Loading";

const messages = defineMessages({
  ko: {
    deactivated: (name: string, open: number) =>
      open > 0
        ? `${name}님을 비활성화했습니다. 담당·요청 중인 열린 게시물 ${open}개를 다른 사람에게 넘겨 주세요.`
        : `${name}님을 비활성화했습니다. 넘겨줄 열린 게시물은 없습니다.`,
    close: "닫기",
    unsetSelfConfirm:
      "내 시스템 관리자 권한을 해제할까요? 해제하면 이 화면을 더 볼 수 없습니다.",
    unset: "해제",
    setAdminFailed: (error: string) =>
      `시스템 관리자 지정을 바꾸지 못했습니다: ${error}`,
    deactivateConfirm: (name: string) =>
      `${name}님을 비활성화할까요? 사용자 전환 목록과 담당자 선택에서 빠집니다.`,
    deactivate: "비활성화",
    deactivateFailed: (error: string) => `비활성화하지 못했습니다: ${error}`,
    users: "사용자",
    people: (n: number) => `${n}명`,
    loading: "불러오는 중",
    loadUsersFailed: (error: string) =>
      `사용자를 불러오지 못했습니다: ${error}`,
    name: "이름",
    email: "이메일",
    adminShort: "관리자",
    admin: "시스템 관리자",
    status: "상태",
    actions: "동작",
    me: "나",
    adminOf: (name: string) => `${name} 시스템 관리자`,
    active: "활성",
    inactive: "비활성",
    cannotDeactivateSelf: "자기 자신은 비활성화할 수 없습니다",
    deactivateOf: (name: string) => `${name} 비활성화`,
    groups: "그룹",
    loadGroupsFailed: (error: string) => `그룹을 불러오지 못했습니다: ${error}`,
    key: "키",
    visibility: "공개",
    members: "멤버",
    settings: "설정",
    private: "비공개",
    public: "공개",
    groupSettingsOf: (name: string) => `${name} 그룹 설정`,
    groupSettings: "그룹 설정",
    adminOnly: "시스템 관리자만 볼 수 있습니다",
    meFailed: (error: string) => `사용자를 확인하지 못했습니다: ${error}`,
    adminOnlyHint:
      "상단의 사용자 전환에서 시스템 관리자로 바꾸면 이 화면을 볼 수 있습니다.",
    home: "홈으로",
    title: "관리 콘솔",
    lead: "사용자를 비활성화하거나 시스템 관리자로 지정하고, 그룹을 살펴봅니다.",
  },
  en: {
    deactivated: (name: string, open: number) =>
      open > 0
        ? `Deactivated ${name}. Hand off ${open} open ${open === 1 ? "post" : "posts"} they own or requested to someone else.`
        : `Deactivated ${name}. No open posts to hand off.`,
    close: "Close",
    unsetSelfConfirm:
      "Remove your own system admin role? You won't be able to see this page anymore.",
    unset: "Remove",
    setAdminFailed: (error: string) =>
      `Couldn't change system admin role: ${error}`,
    deactivateConfirm: (name: string) =>
      `Deactivate ${name}? They'll be removed from the user switcher and assignee choices.`,
    deactivate: "Deactivate",
    deactivateFailed: (error: string) => `Couldn't deactivate: ${error}`,
    users: "Users",
    people: (n: number) => `${n}`,
    loading: "Loading",
    loadUsersFailed: (error: string) => `Couldn't load users: ${error}`,
    name: "Name",
    email: "Email",
    adminShort: "Admin",
    admin: "System admin",
    status: "Status",
    actions: "Actions",
    me: "me",
    adminOf: (name: string) => `${name} system admin`,
    active: "Active",
    inactive: "Inactive",
    cannotDeactivateSelf: "You can't deactivate yourself",
    deactivateOf: (name: string) => `Deactivate ${name}`,
    groups: "Groups",
    loadGroupsFailed: (error: string) => `Couldn't load groups: ${error}`,
    key: "Key",
    visibility: "Visibility",
    members: "Members",
    settings: "Settings",
    private: "Private",
    public: "Public",
    groupSettingsOf: (name: string) => `${name} group settings`,
    groupSettings: "Settings",
    adminOnly: "Only system admins can view this",
    meFailed: (error: string) => `Couldn't verify the user: ${error}`,
    adminOnlyHint:
      "Switch to a system admin with the user switcher at the top to see this page.",
    home: "Go home",
    title: "Admin console",
    lead: "Deactivate users or make them system admins, and review groups.",
  },
});

const s = settings();

const th =
  "border-b border-line px-2.5 py-2 text-left text-2xs font-semibold whitespace-nowrap text-fg-muted";
const td = "border-b border-line px-2.5 py-2 align-middle whitespace-nowrap";

/** 켜고 끄는 스위치. 켜짐은 aria-checked로 표시한다 */
function Switch({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="group/switch inline-flex h-5 w-9 flex-none cursor-pointer items-center rounded-full border border-line-strong bg-panel-strong p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-checked:border-accent aria-checked:bg-accent"
      onClick={() => onChange(!checked)}
    >
      <span className="size-3.5 rounded-full bg-elevated shadow-xs transition-transform group-aria-checked/switch:translate-x-4" />
    </button>
  );
}

function DeactivatedNotice({
  result,
  onClose,
}: {
  result: DeactivateResponse;
  onClose: () => void;
}) {
  const text = useT(messages);
  const openPeek = useOpenPeek();
  const statusName = useStatusName();
  const { user, openPosts } = result;
  return (
    <div
      role="status"
      className="flex min-w-0 flex-col gap-2 rounded-md border border-accent-line bg-accent-soft p-3"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {text.deactivated(user.name, openPosts.length)}
        </p>
        <button
          type="button"
          className={button({ size: "sm" })}
          onClick={onClose}
        >
          {text.close}
        </button>
      </div>
      {openPosts.length > 0 && (
        <ul className="flex min-w-0 flex-col gap-1">
          {openPosts.map((p) => (
            <li key={p.id} className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="flex min-w-0 cursor-pointer items-center gap-2 text-left text-fg hover:text-accent"
                onClick={() => openPeek(p.key)}
              >
                <span className="flex-none font-mono text-2xs text-fg-muted">
                  {p.key}
                </span>
                <span className="truncate underline-offset-2 hover:underline">
                  {p.title}
                </span>
              </button>
              <span className={statusBadge({ status: p.status })}>
                {statusName(p.status, p.groupId)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UsersTable({ me }: { me: FeedUser }) {
  const text = useT(messages);
  const id = useId();
  const client = useQueryClient();
  const users = useUsers();
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<DeactivateResponse | null>(null);

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: feedKeys.users }),
      client.invalidateQueries({ queryKey: feedKeys.me }),
      client.invalidateQueries({ queryKey: feedKeys.groups }),
    ]);

  const setAdmin = async (u: FeedUser, on: boolean) => {
    if (
      !on &&
      u.id === me.id &&
      !(await showConfirm(text.unsetSelfConfirm, {
        confirmLabel: text.unset,
      }))
    )
      return;
    setPending(u.id);
    try {
      await usersApi.setAdmin(u.id, on);
      await refresh();
    } catch (err) {
      showAlert(text.setAdminFailed(errorMessage(err)));
    } finally {
      setPending(null);
    }
  };

  const deactivate = async (u: FeedUser) => {
    const ok = await showConfirm(text.deactivateConfirm(u.name), {
      confirmLabel: text.deactivate,
    });
    if (!ok) return;
    setPending(u.id);
    try {
      setResult(await usersApi.deactivate(u.id));
      await refresh();
    } catch (err) {
      showAlert(text.deactivateFailed(errorMessage(err)));
    } finally {
      setPending(null);
    }
  };

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead()}>
        <h2 id={`${id}-title`} className={s.sectionTitle()}>
          {text.users}{" "}
          {users.data && (
            <span className="font-normal text-fg-muted">
              {text.people(users.data.length)}
            </span>
          )}
        </h2>
      </div>
      {result && (
        <DeactivatedNotice result={result} onClose={() => setResult(null)} />
      )}
      {users.isPending && <LoadingText>{text.loading}</LoadingText>}
      {users.isError && (
        <p role="alert" className="text-danger">
          {text.loadUsersFailed(users.error.message)}
        </p>
      )}
      {users.data && (
        <div className="relative min-w-0 overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse text-ui sm:min-w-136">
            <thead className="bg-panel">
              <tr>
                <th scope="col" className={th}>
                  {text.name}
                </th>
                <th scope="col" className={cn(th, "hidden sm:table-cell")}>
                  {text.email}
                </th>
                <th scope="col" className={th}>
                  <span className="sm:hidden">{text.adminShort}</span>
                  <span className="hidden sm:inline">{text.admin}</span>
                </th>
                <th scope="col" className={th}>
                  {text.status}
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">{text.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr
                  key={u.id}
                  data-inactive={!u.active || undefined}
                  className="data-inactive:text-fg-muted"
                >
                  {/* 좁은 화면에서는 이름 칸이 남는 폭을 쓰고 넘치면 말줄임 */}
                  <td
                    className={cn(td, "w-full max-w-0 sm:w-auto sm:max-w-none")}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={u.name} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">
                          {u.name}
                          {u.id === me.id && (
                            <span className="ml-1 text-2xs text-fg-muted">
                              {text.me}
                            </span>
                          )}
                        </span>
                        {/* 좁은 화면에서는 이메일 열 대신 이름 아래에 */}
                        {u.email && (
                          <span className="truncate text-2xs text-fg-muted sm:hidden">
                            {u.email}
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td
                    className={cn(td, "hidden text-fg-secondary sm:table-cell")}
                  >
                    {u.email ?? "—"}
                  </td>
                  <td className={td}>
                    <Switch
                      checked={u.isAdmin}
                      label={text.adminOf(u.name)}
                      disabled={!!pending || !u.active}
                      onChange={(on) => setAdmin(u, on)}
                    />
                  </td>
                  <td className={td}>
                    {u.active ? (
                      <span className="text-fg-secondary">{text.active}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <ShieldOff size={12} aria-hidden="true" />
                        {text.inactive}
                      </span>
                    )}
                  </td>
                  <td className={cn(td, "text-right")}>
                    {u.active && (
                      <button
                        type="button"
                        className={button({
                          variant: "danger",
                          size: "sm",
                          class: "whitespace-nowrap",
                        })}
                        disabled={!!pending || u.id === me.id}
                        title={
                          u.id === me.id ? text.cannotDeactivateSelf : undefined
                        }
                        aria-label={text.deactivateOf(u.name)}
                        onClick={() => deactivate(u)}
                      >
                        <UserX size={14} aria-hidden="true" />
                        <span className="hidden sm:inline">
                          {text.deactivate}
                        </span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GroupsTable() {
  const text = useT(messages);
  const id = useId();
  const groups = useGroups();
  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={s.sectionTitle()}>
        {text.groups}
      </h2>
      {groups.isPending && <LoadingText>{text.loading}</LoadingText>}
      {groups.isError && (
        <p role="alert" className="text-danger">
          {text.loadGroupsFailed(groups.error.message)}
        </p>
      )}
      {groups.data && (
        <div className="relative min-w-0 overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse text-ui sm:min-w-112">
            <thead className="bg-panel">
              <tr>
                <th scope="col" className={th}>
                  {text.name}
                </th>
                <th scope="col" className={th}>
                  {text.key}
                </th>
                <th scope="col" className={th}>
                  {text.visibility}
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  {text.members}
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">{text.settings}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.data.map((g) => (
                <tr key={g.id}>
                  <td className={td}>{g.name}</td>
                  <td className={cn(td, "font-mono text-xs")}>{g.keyPrefix}</td>
                  <td className={td}>
                    {g.isPrivate ? (
                      <span className="inline-flex items-center gap-1">
                        <Lock size={12} aria-hidden="true" />
                        {text.private}
                      </span>
                    ) : (
                      text.public
                    )}
                  </td>
                  <td className={cn(td, "text-right tabular-nums")}>
                    {text.people(g.memberCount)}
                  </td>
                  <td className={cn(td, "text-right")}>
                    <Link
                      href={groupHref(FEED.settingsGroup, g.keyPrefix)}
                      aria-label={text.groupSettingsOf(g.name)}
                      className={button({
                        size: "sm",
                        class: "whitespace-nowrap no-underline",
                      })}
                    >
                      <Settings size={14} aria-hidden="true" />
                      <span className="hidden sm:inline">
                        {text.groupSettings}
                      </span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** 관리 콘솔 (/feed/admin) */
export function AdminView() {
  const text = useT(messages);
  const me = useMe();
  if (me.isPending)
    return (
      <div className={s.root()}>
        <LoadingText>{text.loading}</LoadingText>
      </div>
    );
  if (me.isError || !me.data.isAdmin)
    return (
      <EmptyState icon={<Lock size={20} />} title={text.adminOnly}>
        <p>
          {me.isError ? text.meFailed(me.error.message) : text.adminOnlyHint}
        </p>
        <Link
          href={FEED.home}
          className={button({ size: "sm", class: "mt-2 no-underline" })}
        >
          {text.home}
        </Link>
      </EmptyState>
    );
  return (
    <div className={s.root()}>
      <div className={s.head()}>
        <h1 className={s.title()}>{text.title}</h1>
        <p className={s.lead()}>{text.lead}</p>
      </div>
      <UsersTable me={me.data} />
      <GroupsTable />
    </div>
  );
}
