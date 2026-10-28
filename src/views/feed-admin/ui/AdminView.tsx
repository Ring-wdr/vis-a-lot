"use client";

// 관리 콘솔 (/feed/admin): 사용자 목록(시스템 관리자 지정·비활성화), 그룹 목록. 시스템 관리자만 본다.

import { Plural, Trans, useLingui } from "@lingui/react/macro";
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
import { useOpenPeek } from "@/shared/lib/peek";
import { cn } from "@/shared/lib/tw";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import { Avatar } from "@/shared/ui/Avatar";
import { button } from "@/shared/ui/button";
import { settings } from "@/shared/ui/feed-settings-styles";
import { EmptyState, LoadingText } from "@/shared/ui/Loading";
import "../config/messages";

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
  const { t } = useLingui();
  const openPeek = useOpenPeek();
  const statusName = useStatusName();
  const { user, openPosts } = result;
  const name = user.name;
  const open = openPosts.length;
  return (
    <div
      role="status"
      className="flex min-w-0 flex-col gap-2 rounded-md border border-accent-line bg-accent-soft p-3"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {open > 0
            ? t`${name}님을 비활성화했습니다. 담당·요청 중인 열린 게시물 ${open}개를 다른 사람에게 넘겨 주세요.`
            : t`${name}님을 비활성화했습니다. 넘겨줄 열린 게시물은 없습니다.`}
        </p>
        <button
          type="button"
          className={button({ size: "sm" })}
          onClick={onClose}
        >
          <Trans context="close deactivation notice">닫기</Trans>
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
  const { t } = useLingui();
  const id = useId();
  const client = useQueryClient();
  const users = useUsers();
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<DeactivateResponse | null>(null);

  const adminOf = (name: string) => t`${name} 시스템 관리자`;
  const deactivateOf = (name: string) => t`${name} 비활성화`;

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
      !(await showConfirm(
        t`내 시스템 관리자 권한을 해제할까요? 해제하면 이 화면을 더 볼 수 없습니다.`,
        {
          confirmLabel: t({
            message: "해제",
            context: "remove own system admin role",
          }),
        },
      ))
    )
      return;
    setPending(u.id);
    try {
      await usersApi.setAdmin(u.id, on);
      await refresh();
    } catch (err) {
      const error = errorMessage(err);
      showAlert(t`시스템 관리자 지정을 바꾸지 못했습니다: ${error}`);
    } finally {
      setPending(null);
    }
  };

  const deactivate = async (u: FeedUser) => {
    const name = u.name;
    const ok = await showConfirm(
      t`${name}님을 비활성화할까요? 사용자 전환 목록과 담당자 선택에서 빠집니다.`,
      {
        confirmLabel: t({ message: "비활성화", context: "deactivate user" }),
      },
    );
    if (!ok) return;
    setPending(u.id);
    try {
      setResult(await usersApi.deactivate(u.id));
      await refresh();
    } catch (err) {
      const error = errorMessage(err);
      showAlert(t`비활성화하지 못했습니다: ${error}`);
    } finally {
      setPending(null);
    }
  };

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead()}>
        <h2 id={`${id}-title`} className={s.sectionTitle()}>
          {t({ message: "사용자", context: "admin console section" })}{" "}
          {users.data && (
            <span className="font-normal text-fg-muted">
              <Plural
                value={users.data.length}
                other="#명"
                context="user count"
              />
            </span>
          )}
        </h2>
      </div>
      {result && (
        <DeactivatedNotice result={result} onClose={() => setResult(null)} />
      )}
      {users.isPending && (
        <LoadingText>
          <Trans>불러오는 중</Trans>
        </LoadingText>
      )}
      {users.isError && (
        <p role="alert" className="text-danger">
          <Trans>사용자를 불러오지 못했습니다: {users.error.message}</Trans>
        </p>
      )}
      {users.data && (
        <div className="relative min-w-0 overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse text-ui sm:min-w-136">
            <thead className="bg-panel">
              <tr>
                <th scope="col" className={th}>
                  <Trans context="admin table column">이름</Trans>
                </th>
                <th scope="col" className={cn(th, "hidden sm:table-cell")}>
                  <Trans context="admin table column">이메일</Trans>
                </th>
                <th scope="col" className={th}>
                  <span className="sm:hidden">
                    <Trans context="admin table column, narrow screen">
                      관리자
                    </Trans>
                  </span>
                  <span className="hidden sm:inline">
                    <Trans context="admin table column">시스템 관리자</Trans>
                  </span>
                </th>
                <th scope="col" className={th}>
                  <Trans context="admin table column">상태</Trans>
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">
                    <Trans context="admin table column">동작</Trans>
                  </span>
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
                              <Trans context="marks the current user in a list">
                                나
                              </Trans>
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
                      label={adminOf(u.name)}
                      disabled={!!pending || !u.active}
                      onChange={(on) => setAdmin(u, on)}
                    />
                  </td>
                  <td className={td}>
                    {u.active ? (
                      <span className="text-fg-secondary">
                        <Trans context="user account state">활성</Trans>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <ShieldOff size={12} aria-hidden="true" />
                        <Trans context="user account state">비활성</Trans>
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
                          u.id === me.id
                            ? t`자기 자신은 비활성화할 수 없습니다`
                            : undefined
                        }
                        aria-label={deactivateOf(u.name)}
                        onClick={() => deactivate(u)}
                      >
                        <UserX size={14} aria-hidden="true" />
                        <span className="hidden sm:inline">
                          <Trans context="deactivate user">비활성화</Trans>
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
  const { t } = useLingui();
  const id = useId();
  const groups = useGroups();
  const groupSettingsOf = (name: string) => t`${name} 그룹 설정`;
  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={s.sectionTitle()}>
        <Trans context="admin console section">그룹</Trans>
      </h2>
      {groups.isPending && (
        <LoadingText>
          <Trans>불러오는 중</Trans>
        </LoadingText>
      )}
      {groups.isError && (
        <p role="alert" className="text-danger">
          <Trans>그룹을 불러오지 못했습니다: {groups.error.message}</Trans>
        </p>
      )}
      {groups.data && (
        <div className="relative min-w-0 overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse text-ui sm:min-w-112">
            <thead className="bg-panel">
              <tr>
                <th scope="col" className={th}>
                  <Trans context="admin table column">이름</Trans>
                </th>
                <th scope="col" className={th}>
                  <Trans context="admin table column: group key prefix">
                    키
                  </Trans>
                </th>
                <th scope="col" className={th}>
                  <Trans context="admin table column: group visibility">
                    공개
                  </Trans>
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  <Trans context="admin table column">멤버</Trans>
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">
                    <Trans context="admin table column">설정</Trans>
                  </span>
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
                        <Trans context="group visibility">비공개</Trans>
                      </span>
                    ) : (
                      t({ message: "공개", context: "group visibility" })
                    )}
                  </td>
                  <td className={cn(td, "text-right tabular-nums")}>
                    <Plural
                      value={g.memberCount}
                      other="#명"
                      context="group member count"
                    />
                  </td>
                  <td className={cn(td, "text-right")}>
                    <Link
                      href={groupHref(FEED.settingsGroup, g.keyPrefix)}
                      aria-label={groupSettingsOf(g.name)}
                      className={button({
                        size: "sm",
                        class: "whitespace-nowrap no-underline",
                      })}
                    >
                      <Settings size={14} aria-hidden="true" />
                      <span className="hidden sm:inline">
                        <Trans context="link to group settings">
                          그룹 설정
                        </Trans>
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
  const { t } = useLingui();
  const me = useMe();
  if (me.isPending)
    return (
      <div className={s.root()}>
        <LoadingText>
          <Trans>불러오는 중</Trans>
        </LoadingText>
      </div>
    );
  if (me.isError || !me.data.isAdmin)
    return (
      <EmptyState
        icon={<Lock size={20} />}
        title={t`시스템 관리자만 볼 수 있습니다`}
      >
        <p>
          {me.isError ? (
            <Trans>사용자를 확인하지 못했습니다: {me.error.message}</Trans>
          ) : (
            t`상단의 사용자 전환에서 시스템 관리자로 바꾸면 이 화면을 볼 수 있습니다.`
          )}
        </p>
        <Link
          href={FEED.home}
          className={button({ size: "sm", class: "mt-2 no-underline" })}
        >
          <Trans>홈으로</Trans>
        </Link>
      </EmptyState>
    );
  return (
    <div className={s.root()}>
      <div className={s.head()}>
        <h1 className={s.title()}>
          <Trans context="admin console page title">관리 콘솔</Trans>
        </h1>
        <p className={s.lead()}>
          <Trans>
            사용자를 비활성화하거나 시스템 관리자로 지정하고, 그룹을 살펴봅니다.
          </Trans>
        </p>
      </div>
      <UsersTable me={me.data} />
      <GroupsTable />
    </div>
  );
}
