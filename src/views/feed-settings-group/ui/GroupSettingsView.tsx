"use client";

// 그룹 설정 (/feed/settings/group?g=FD): 기본 정보, 상태 이름, 게시물 유형, 팀, 멤버.
// 그룹 관리자(와 시스템 관리자)만 고친다. 다른 사람은 같은 화면을 읽기 전용으로 본다.

import { Lock, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  RouteGroupFallback,
  useRouteGroup,
} from "@/entities/group/ui/route-group";
import { useGroup, useGroups } from "@/shared/api/feed/queries";
import { FEED, groupHref } from "@/shared/config/feed-routes";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { button } from "@/shared/ui/button";
import { settings } from "@/shared/ui/feed-settings-styles";
import { EmptyState, LoadingText } from "@/shared/ui/Loading";
import { useGroupEdit } from "@/views/feed-settings-group/model/use-group-edit";
import { BasicSection } from "./BasicSection";
import { MembersSection } from "./MembersSection";
import { PostTypesSection } from "./PostTypesSection";
import { StatusNamesSection } from "./StatusNamesSection";
import { TeamsSection } from "./TeamsSection";

const messages = defineMessages({
  ko: {
    title: "그룹 설정",
    pick: "설정할 그룹을 고르세요.",
    loading: "불러오는 중",
    loadGroupsFailed: (error: string) => `그룹을 불러오지 못했습니다: ${error}`,
    private: "비공개",
    admin: "관리자",
    readOnly: "읽기 전용",
    loadingGroup: "그룹을 불러오는 중",
    loadGroupFailed: "그룹을 불러오지 못했습니다",
    retry: "다시 시도",
    list: "리스트",
    board: "보드",
    readOnlyNote:
      "그룹 관리자만 설정을 바꿀 수 있습니다. 지금은 읽기 전용으로 봅니다.",
  },
  en: {
    title: "Group settings",
    pick: "Choose a group to configure.",
    loading: "Loading",
    loadGroupsFailed: (error: string) => `Couldn't load groups: ${error}`,
    private: "Private",
    admin: "Admin",
    readOnly: "Read-only",
    loadingGroup: "Loading group",
    loadGroupFailed: "Couldn't load the group",
    retry: "Try again",
    list: "List",
    board: "Board",
    readOnlyNote:
      "Only group admins can change settings. You're viewing them read-only.",
  },
});

const s = settings();

/** ?g=가 없을 때: 고칠 그룹 고르기 */
function GroupPicker() {
  const text = useT(messages);
  const groups = useGroups();
  return (
    <div className={s.root()}>
      <div className={s.head()}>
        <h1 className={s.title()}>{text.title}</h1>
        <p className={s.lead()}>{text.pick}</p>
      </div>
      {groups.isPending && <LoadingText>{text.loading}</LoadingText>}
      {groups.isError && (
        <p role="alert" className="text-danger">
          {text.loadGroupsFailed(groups.error.message)}
        </p>
      )}
      <ul className={s.list()}>
        {groups.data?.map((g) => (
          <li key={g.id} className={s.item()}>
            <Link
              href={groupHref(FEED.settingsGroup, g.keyPrefix)}
              className="flex min-w-0 flex-1 items-center gap-2 text-fg no-underline hover:text-accent"
            >
              <span className="truncate">{g.name}</span>
              <span className="font-mono text-2xs text-fg-muted">
                {g.keyPrefix}
              </span>
              {g.isPrivate && (
                <Lock
                  size={12}
                  className="text-fg-muted"
                  aria-label={text.private}
                />
              )}
            </Link>
            <span className="text-2xs text-fg-muted">
              {g.myRole === "admin" ? text.admin : text.readOnly}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupSettings({ groupId }: { groupId: string }) {
  const text = useT(messages);
  const detail = useGroup(groupId);
  const edit = useGroupEdit(groupId);
  if (detail.isPending)
    return (
      <div className={s.root()}>
        <LoadingText>{text.loadingGroup}</LoadingText>
      </div>
    );
  if (detail.isError)
    return (
      <EmptyState
        icon={<SettingsIcon size={20} />}
        title={text.loadGroupFailed}
      >
        <p>{detail.error.message}</p>
        <button
          type="button"
          className={button({ size: "sm", class: "mt-2" })}
          onClick={() => detail.refetch()}
        >
          {text.retry}
        </button>
      </EmptyState>
    );
  const group = detail.data;
  const canEdit = group.myRole === "admin";
  const props = { group, edit };
  return (
    <div className={s.root()}>
      <div className={s.head()}>
        <p className="text-xs text-fg-muted">
          {text.title} · <span className="font-mono">{group.keyPrefix}</span>
        </p>
        <h1 className={s.title()}>{group.name}</h1>
        <p className={s.lead()}>
          <Link href={groupHref(FEED.list, group.keyPrefix)}>{text.list}</Link>
          {" · "}
          <Link href={groupHref(FEED.board, group.keyPrefix)}>
            {text.board}
          </Link>
        </p>
      </div>
      {!canEdit && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-md border border-line bg-panel px-3 py-2 text-ui text-fg-secondary"
        >
          <Lock size={14} className="mt-0.5 flex-none" aria-hidden="true" />
          {text.readOnlyNote}
        </p>
      )}
      <fieldset
        disabled={!canEdit}
        className="flex min-w-0 flex-col gap-4"
        aria-busy={!!edit.pending}
      >
        <BasicSection {...props} />
        <StatusNamesSection {...props} />
        <PostTypesSection {...props} />
        <TeamsSection {...props} />
        <MembersSection {...props} />
      </fieldset>
    </div>
  );
}

/** 그룹 설정 (/feed/settings/group) */
export function GroupSettingsView() {
  const key = useSearchParams().get("g");
  const state = useRouteGroup();
  if (!key) return <GroupPicker />;
  if (!state.group) return <RouteGroupFallback state={state} />;
  // 다른 그룹으로 옮기면 입력하던 이름·고른 사람이 남지 않게 새로 그린다.
  return <GroupSettings key={state.group.id} groupId={state.group.id} />;
}
