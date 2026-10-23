"use client";

// 관리 콘솔 (/feed/admin): 사용자 목록(시스템 관리자 지정·비활성화), 그룹 목록. 시스템 관리자만 본다.

import { useQueryClient } from "@tanstack/react-query";
import { Lock, Settings, ShieldOff, UserX } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { feedKeys, useGroups, useMe, useUsers } from "@/feed/api/queries";
import type { DeactivateResponse, FeedUser } from "@/feed/api/types";
import { usersApi } from "@/feed/api/users";
import { useOpenPeek } from "@/feed/lib/peek";
import { FEED, groupHref } from "@/feed/lib/routes";
import { useStatusName } from "@/feed/ui/posts/post-meta";
import { Avatar } from "@/feed/ui/UserSwitcher";
import { statusBadge } from "@/feed/views/post/styles";
import { errorMessage } from "@/feed/views/post/use-post-action";
import { settings } from "@/feed/views/settings-group/styles";
import { cn } from "@/shared/lib/tw";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { EmptyState, LoadingText } from "@/shared/ui/Loading";

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
          {user.name}님을 비활성화했습니다.
          {openPosts.length > 0
            ? ` 담당·요청 중인 열린 게시물 ${openPosts.length}개를 다른 사람에게 넘겨 주세요.`
            : " 넘겨줄 열린 게시물은 없습니다."}
        </p>
        <button
          type="button"
          className={button({ size: "sm" })}
          onClick={onClose}
        >
          닫기
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
      !(await showConfirm(
        "내 시스템 관리자 권한을 해제할까요? 해제하면 이 화면을 더 볼 수 없습니다.",
        { confirmLabel: "해제" },
      ))
    )
      return;
    setPending(u.id);
    try {
      await usersApi.setAdmin(u.id, on);
      await refresh();
    } catch (err) {
      showAlert(`시스템 관리자 지정을 바꾸지 못했습니다: ${errorMessage(err)}`);
    } finally {
      setPending(null);
    }
  };

  const deactivate = async (u: FeedUser) => {
    const ok = await showConfirm(
      `${u.name}님을 비활성화할까요? 사용자 전환 목록과 담당자 선택에서 빠집니다.`,
      { confirmLabel: "비활성화" },
    );
    if (!ok) return;
    setPending(u.id);
    try {
      setResult(await usersApi.deactivate(u.id));
      await refresh();
    } catch (err) {
      showAlert(`비활성화하지 못했습니다: ${errorMessage(err)}`);
    } finally {
      setPending(null);
    }
  };

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead()}>
        <h2 id={`${id}-title`} className={s.sectionTitle()}>
          사용자{" "}
          {users.data && (
            <span className="font-normal text-fg-muted">
              {users.data.length}명
            </span>
          )}
        </h2>
      </div>
      {result && (
        <DeactivatedNotice result={result} onClose={() => setResult(null)} />
      )}
      {users.isPending && <LoadingText>불러오는 중</LoadingText>}
      {users.isError && (
        <p role="alert" className="text-danger">
          사용자를 불러오지 못했습니다: {users.error.message}
        </p>
      )}
      {users.data && (
        <div className="relative min-w-0 overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse text-ui sm:min-w-136">
            <thead className="bg-panel">
              <tr>
                <th scope="col" className={th}>
                  이름
                </th>
                <th scope="col" className={cn(th, "hidden sm:table-cell")}>
                  이메일
                </th>
                <th scope="col" className={th}>
                  <span className="sm:hidden">관리자</span>
                  <span className="hidden sm:inline">시스템 관리자</span>
                </th>
                <th scope="col" className={th}>
                  상태
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">동작</span>
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
                              나
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
                      label={`${u.name} 시스템 관리자`}
                      disabled={!!pending || !u.active}
                      onChange={(on) => setAdmin(u, on)}
                    />
                  </td>
                  <td className={td}>
                    {u.active ? (
                      <span className="text-fg-secondary">활성</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <ShieldOff size={12} aria-hidden="true" />
                        비활성
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
                            ? "자기 자신은 비활성화할 수 없습니다"
                            : undefined
                        }
                        aria-label={`${u.name} 비활성화`}
                        onClick={() => deactivate(u)}
                      >
                        <UserX size={14} aria-hidden="true" />
                        <span className="hidden sm:inline">비활성화</span>
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
  const id = useId();
  const groups = useGroups();
  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={s.sectionTitle()}>
        그룹
      </h2>
      {groups.isPending && <LoadingText>불러오는 중</LoadingText>}
      {groups.isError && (
        <p role="alert" className="text-danger">
          그룹을 불러오지 못했습니다: {groups.error.message}
        </p>
      )}
      {groups.data && (
        <div className="relative min-w-0 overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse text-ui sm:min-w-112">
            <thead className="bg-panel">
              <tr>
                <th scope="col" className={th}>
                  이름
                </th>
                <th scope="col" className={th}>
                  키
                </th>
                <th scope="col" className={th}>
                  공개
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  멤버
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">설정</span>
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
                        비공개
                      </span>
                    ) : (
                      "공개"
                    )}
                  </td>
                  <td className={cn(td, "text-right tabular-nums")}>
                    {g.memberCount}명
                  </td>
                  <td className={cn(td, "text-right")}>
                    <Link
                      href={groupHref(FEED.settingsGroup, g.keyPrefix)}
                      aria-label={`${g.name} 그룹 설정`}
                      className={button({
                        size: "sm",
                        class: "whitespace-nowrap no-underline",
                      })}
                    >
                      <Settings size={14} aria-hidden="true" />
                      <span className="hidden sm:inline">그룹 설정</span>
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
  const me = useMe();
  if (me.isPending)
    return (
      <div className={s.root()}>
        <LoadingText>불러오는 중</LoadingText>
      </div>
    );
  if (me.isError || !me.data.isAdmin)
    return (
      <EmptyState
        icon={<Lock size={20} />}
        title="시스템 관리자만 볼 수 있습니다"
      >
        <p>
          {me.isError
            ? `사용자를 확인하지 못했습니다: ${me.error.message}`
            : "상단의 사용자 전환에서 시스템 관리자로 바꾸면 이 화면을 볼 수 있습니다."}
        </p>
        <Link
          href={FEED.home}
          className={button({ size: "sm", class: "mt-2 no-underline" })}
        >
          홈으로
        </Link>
      </EmptyState>
    );
  return (
    <div className={s.root()}>
      <div className={s.head()}>
        <h1 className={s.title()}>관리 콘솔</h1>
        <p className={s.lead()}>
          사용자를 비활성화하거나 시스템 관리자로 지정하고, 그룹을 살펴봅니다.
        </p>
      </div>
      <UsersTable me={me.data} />
      <GroupsTable />
    </div>
  );
}
