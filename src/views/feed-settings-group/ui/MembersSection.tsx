"use client";

// 멤버: 역할(관리자·멤버) 바꾸기, 빼기, 그룹 밖 사용자 추가. 마지막 관리자는 서버가 막는다(400).

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { Plus, UserMinus } from "lucide-react";
import { useId, useState } from "react";
import { groupsApi } from "@/shared/api/feed/groups";
import { useUsers } from "@/shared/api/feed/queries";
import type { FeedUser, GroupDetail, GroupRole } from "@/shared/api/feed/types";
import { intlLocale } from "@/shared/lib/i18n";
import { showConfirm } from "@/shared/ui/AlertDialog";
import { Avatar } from "@/shared/ui/Avatar";
import { button } from "@/shared/ui/button";
import { iconButton, settings } from "@/shared/ui/feed-settings-styles";
import { Select } from "@/shared/ui/Select";
import { segmented } from "@/shared/ui/segmented";
import type { useGroupEdit } from "@/views/feed-settings-group/model/use-group-edit";
import "../config/messages";

const s = settings();
const seg = segmented();

const ROLES: GroupRole[] = ["admin", "member"];

const ROLE_LABELS: Record<GroupRole, MessageDescriptor> = {
  admin: msg({ message: "관리자", context: "group role" }),
  member: msg({ message: "멤버", context: "group role" }),
};

/** 관리자 먼저, 같으면 이름순 */
export function sortMembers(
  members: GroupDetail["members"],
  users: Map<string, FeedUser>,
) {
  return [...members].sort(
    (a, b) =>
      (a.role === "admin" ? 0 : 1) - (b.role === "admin" ? 0 : 1) ||
      (users.get(a.userId)?.name ?? a.userId).localeCompare(
        users.get(b.userId)?.name ?? b.userId,
        intlLocale(),
      ),
  );
}

function RolePicker({
  value,
  label,
  disabled,
  onChange,
}: {
  value: GroupRole;
  label: string;
  disabled?: boolean;
  onChange: (role: GroupRole) => void;
}) {
  const { i18n } = useLingui();
  return (
    <fieldset className={seg.root({ class: "w-36 flex-none self-auto" })}>
      <legend className="sr-only">{label}</legend>
      {ROLES.map((r) => (
        <button
          key={r}
          type="button"
          className={seg.item()}
          aria-pressed={value === r}
          disabled={disabled}
          onClick={() => value !== r && onChange(r)}
        >
          {i18n._(ROLE_LABELS[r])}
        </button>
      ))}
    </fieldset>
  );
}

export function MembersSection({
  group,
  edit,
}: {
  group: GroupDetail;
  edit: ReturnType<typeof useGroupEdit>;
}) {
  const { t } = useLingui();
  const id = useId();
  const users = useUsers();
  const byId = new Map((users.data ?? []).map((u) => [u.id, u]));
  const memberIds = new Set(group.members.map((m) => m.userId));
  const candidates = (users.data ?? []).filter(
    (u) => u.active && !memberIds.has(u.id),
  );
  const [pick, setPick] = useState<string | null>(null);
  const [role, setRole] = useState<GroupRole>("member");
  const busy = !!edit.pending;
  const picked = pick && !memberIds.has(pick) ? pick : null;

  const setMember = (userId: string, r: GroupRole) =>
    edit.run(`member-${userId}`, t`역할을 바꾸지 못했습니다`, () =>
      groupsApi.setMember(group.id, userId, r),
    );

  const remove = async (userId: string) => {
    const name = byId.get(userId)?.name ?? userId;
    const ok = await showConfirm(t`${name}님을 그룹에서 뺄까요?`, {
      confirmLabel: t({
        message: "빼기",
        context: "remove a member from the group",
      }),
    });
    if (ok)
      await edit.run(`member-${userId}`, t`멤버를 빼지 못했습니다`, () =>
        groupsApi.removeMember(group.id, userId),
      );
  };

  const add = async () => {
    if (!picked) return;
    const ok = await edit.run("member-add", t`멤버를 추가하지 못했습니다`, () =>
      groupsApi.setMember(group.id, picked, role),
    );
    if (ok) setPick(null);
  };

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead()}>
        <h2 id={`${id}-title`} className={s.sectionTitle()}>
          {t({ message: "멤버", context: "group settings section title" })}{" "}
          <span className="font-normal text-fg-muted">
            <Plural
              value={group.members.length}
              other="#명"
              context="group member count"
            />
          </span>
        </h2>
        <p className={s.hint()}>
          <Trans>관리자는 그룹 설정과 모든 전이·승인을 합니다.</Trans>
        </p>
      </div>
      <ul className={s.list()}>
        {sortMembers(group.members, byId).map((m) => {
          const u = byId.get(m.userId);
          const name = u?.name ?? m.userId;
          return (
            <li key={m.userId} className={s.item()}>
              <Avatar name={name} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">
                  {name}
                  {u && !u.active && (
                    <span className="ml-1.5 text-2xs text-fg-muted">
                      <Trans context="user account state">비활성</Trans>
                    </span>
                  )}
                </span>
                {u?.email && (
                  <span className="truncate text-2xs text-fg-muted">
                    {u.email}
                  </span>
                )}
              </span>
              <span className={s.actions()}>
                <RolePicker
                  value={m.role}
                  label={t`${name} 역할`}
                  disabled={busy}
                  onChange={(r) => setMember(m.userId, r)}
                />
                <button
                  type="button"
                  className={iconButton({ tone: "danger" })}
                  aria-label={t`${name} 빼기`}
                  title={t`그룹에서 빼기`}
                  disabled={busy}
                  onClick={() => remove(m.userId)}
                >
                  <UserMinus size={14} aria-hidden="true" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <form
        className={s.addRow()}
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <div className="w-full max-w-60 flex-1">
          <Select
            label={t`멤버 추가`}
            value={picked}
            placeholder={
              users.isPending
                ? t({
                    message: "불러오는 중",
                    context: "loading users placeholder",
                  })
                : candidates.length
                  ? t`사용자 고르기`
                  : t`더할 사용자가 없습니다`
            }
            options={candidates.map((u) => ({ value: u.id, label: u.name }))}
            onChange={setPick}
            disabled={candidates.length === 0}
          />
        </div>
        <RolePicker value={role} label={t`추가할 역할`} onChange={setRole} />
        <button
          type="submit"
          className={button({ size: "sm" })}
          disabled={busy || !picked}
        >
          <Plus size={14} aria-hidden="true" />
          <Trans context="add a member">추가</Trans>
        </button>
      </form>
    </section>
  );
}
