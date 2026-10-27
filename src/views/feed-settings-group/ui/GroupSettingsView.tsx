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
import { button } from "@/shared/ui/button";
import { settings } from "@/shared/ui/feed-settings-styles";
import { EmptyState, LoadingText } from "@/shared/ui/Loading";
import { useGroupEdit } from "@/views/feed-settings-group/model/use-group-edit";
import { BasicSection } from "./BasicSection";
import { MembersSection } from "./MembersSection";
import { PostTypesSection } from "./PostTypesSection";
import { StatusNamesSection } from "./StatusNamesSection";
import { TeamsSection } from "./TeamsSection";

const s = settings();

/** ?g=가 없을 때: 고칠 그룹 고르기 */
function GroupPicker() {
  const groups = useGroups();
  return (
    <div className={s.root()}>
      <div className={s.head()}>
        <h1 className={s.title()}>그룹 설정</h1>
        <p className={s.lead()}>설정할 그룹을 고르세요.</p>
      </div>
      {groups.isPending && <LoadingText>불러오는 중</LoadingText>}
      {groups.isError && (
        <p role="alert" className="text-danger">
          그룹을 불러오지 못했습니다: {groups.error.message}
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
                <Lock size={12} className="text-fg-muted" aria-label="비공개" />
              )}
            </Link>
            <span className="text-2xs text-fg-muted">
              {g.myRole === "admin" ? "관리자" : "읽기 전용"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupSettings({ groupId }: { groupId: string }) {
  const detail = useGroup(groupId);
  const edit = useGroupEdit(groupId);
  if (detail.isPending)
    return (
      <div className={s.root()}>
        <LoadingText>그룹을 불러오는 중</LoadingText>
      </div>
    );
  if (detail.isError)
    return (
      <EmptyState
        icon={<SettingsIcon size={20} />}
        title="그룹을 불러오지 못했습니다"
      >
        <p>{detail.error.message}</p>
        <button
          type="button"
          className={button({ size: "sm", class: "mt-2" })}
          onClick={() => detail.refetch()}
        >
          다시 시도
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
          그룹 설정 · <span className="font-mono">{group.keyPrefix}</span>
        </p>
        <h1 className={s.title()}>{group.name}</h1>
        <p className={s.lead()}>
          <Link href={groupHref(FEED.list, group.keyPrefix)}>리스트</Link>
          {" · "}
          <Link href={groupHref(FEED.board, group.keyPrefix)}>보드</Link>
        </p>
      </div>
      {!canEdit && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-md border border-line bg-panel px-3 py-2 text-ui text-fg-secondary"
        >
          <Lock size={14} className="mt-0.5 flex-none" aria-hidden="true" />
          그룹 관리자만 설정을 바꿀 수 있습니다. 지금은 읽기 전용으로 봅니다.
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
