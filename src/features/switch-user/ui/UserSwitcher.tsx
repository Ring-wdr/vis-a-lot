"use client";

import { Menu } from "@base-ui/react/menu";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { adminGroupsByUser, roleHint } from "@/entities/user/model/roles";
import {
  currentUserStore,
  useCurrentUserId,
} from "@/shared/api/feed/current-user";
import {
  resetFeedForUser,
  useGroupDetails,
  useGroups,
  useUsers,
} from "@/shared/api/feed/queries";
import type { FeedUser, GroupDetail } from "@/shared/api/feed/types";
import { Avatar } from "@/shared/ui/Avatar";
import { menuStyles } from "@/shared/ui/feed-styles";

const m = menuStyles();

/** 지금 사용자를 바꾸고, 이전 사용자로 받아 둔 피드 데이터를 버린다. */
export function useSwitchUser() {
  const client = useQueryClient();
  return (userId: string) => {
    if (currentUserStore.getState().userId === userId) return;
    currentUserStore.getState().setUserId(userId);
    resetFeedForUser(client);
  };
}

/** 상단 바 오른쪽: 사용자 전환 (프로토타입의 "로그인"). 역할을 함께 보여준다. */
export function UserSwitcher() {
  const users = useUsers();
  const userId = useCurrentUserId();
  const [open, setOpen] = useState(false);
  const groups = useGroups();
  // 역할 설명에 그룹 관리자 정보가 필요해 메뉴를 열 때만 그룹 상세를 받는다.
  const details = useGroupDetails(
    (groups.data ?? []).map((g) => g.id),
    open,
  );
  const adminOf = adminGroupsByUser(
    details.map((d) => d.data).filter((d): d is GroupDetail => !!d),
  );
  const switchUser = useSwitchUser();

  const active = (users.data ?? []).filter((u) => u.active);
  const me: FeedUser | undefined = users.data?.find((u) => u.id === userId);

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger
        className="inline-flex h-7.5 max-w-48 cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-1.5 text-ui text-fg-secondary hover:bg-panel data-popup-open:border-line data-popup-open:bg-elevated"
        aria-label="사용자 전환"
      >
        <Avatar name={me?.name ?? "?"} />
        <span className="hidden truncate sm:inline">
          {me?.name ?? "사용자 없음"}
        </span>
        <ChevronDown size={13} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={m.positioner()} align="end" sideOffset={4}>
          <Menu.Popup className={m.popup()}>
            <Menu.Group>
              <Menu.GroupLabel className={m.label()}>
                사용자 전환
              </Menu.GroupLabel>
              {users.isError && (
                <p className="px-2 py-1.5 text-xs text-danger">
                  사용자 목록을 불러오지 못했습니다: {users.error.message}
                </p>
              )}
              {active.map((u) => (
                <Menu.Item
                  key={u.id}
                  className={m.item()}
                  onClick={() => switchUser(u.id)}
                >
                  <Avatar name={u.name} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{u.name}</span>
                    <span className="truncate text-2xs text-fg-muted">
                      {roleHint(u, adminOf.get(u.id))}
                    </span>
                  </span>
                  {u.id === userId && (
                    <Check
                      size={14}
                      className="ml-auto flex-none text-accent"
                      aria-label="지금 사용자"
                    />
                  )}
                </Menu.Item>
              ))}
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
