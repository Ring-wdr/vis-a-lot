"use client";

// @ 멘션 목록. Tiptap suggestion이 알려 주는 상태를 React state로 옮겨 커서 아래에 목록을 띄운다.
// 위·아래 화살표로 고르고 Enter·Tab으로 넣는다. Esc는 닫는다.

import { useLingui } from "@lingui/react/macro";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUsers } from "@/shared/api/feed/queries";
import type { FeedUser } from "@/shared/api/feed/types";
import { Avatar } from "@/shared/ui/Avatar";
import type { MentionSuggestion } from "./extensions";
import "@/shared/config/messages";

type RenderHooks = ReturnType<NonNullable<MentionSuggestion["render"]>>;
type SuggestionProps = Parameters<NonNullable<RenderHooks["onStart"]>>[0];

const MAX_ITEMS = 8;
/** 목록이 들어갈 높이 (사람 8명) */
const POPUP_SPACE = 300;

type Open = {
  items: FeedUser[];
  index: number;
  rect: DOMRect | null;
  pick: (user: FeedUser) => void;
};

/** 이름·id·이메일에 query가 들어 있는 활성 사용자 */
export function filterUsers(users: FeedUser[] | undefined, query: string) {
  const q = query.trim().toLowerCase();
  return (users ?? [])
    .filter((u) => u.active)
    .filter(
      (u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        !!u.email?.toLowerCase().includes(q),
    )
    .slice(0, MAX_ITEMS);
}

export function useMentionSuggestion() {
  const users = useUsers().data;
  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);
  const [open, setOpenState] = useState<Open | null>(null);
  const openRef = useRef<Open | null>(null);
  const setOpen = useCallback((next: Open | null) => {
    openRef.current = next;
    setOpenState(next);
  }, []);

  const suggestion = useMemo<MentionSuggestion>(
    () => ({
      char: "@",
      items: ({ query }) => filterUsers(usersRef.current, query),
      render: () => {
        const show = (props: SuggestionProps, index: number) =>
          setOpen({
            items: props.items as FeedUser[],
            index: Math.min(index, Math.max(props.items.length - 1, 0)),
            rect: props.clientRect?.() ?? null,
            pick: (u) => props.command({ id: u.id, label: u.name }),
          });
        return {
          onStart: (props) => show(props, 0),
          onUpdate: (props) => show(props, openRef.current?.index ?? 0),
          onExit: () => setOpen(null),
          onKeyDown: ({ event }) => {
            const cur = openRef.current;
            if (!cur) return false;
            if (event.key === "Escape") {
              setOpen(null);
              return true;
            }
            const n = cur.items.length;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              if (n === 0) return true;
              const delta = event.key === "ArrowDown" ? 1 : -1;
              setOpen({ ...cur, index: (cur.index + delta + n) % n });
              return true;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              const user = cur.items[cur.index];
              if (!user) return false;
              cur.pick(user);
              return true;
            }
            return false;
          },
        };
      },
    }),
    [setOpen],
  );

  const popup =
    open && typeof document !== "undefined"
      ? createPortal(
          <MentionList
            open={open}
            onHover={(index) => setOpen({ ...open, index })}
          />,
          document.body,
        )
      : null;

  return { suggestion, popup };
}

function MentionList({
  open,
  onHover,
}: {
  open: Open;
  onHover: (index: number) => void;
}) {
  const { t } = useLingui();
  const rect = open.rect;
  // 아래 자리가 모자라면 커서 위로 띄운다
  const left = rect
    ? Math.max(8, Math.min(rect.left, window.innerWidth - 248))
    : 0;
  const style = !rect
    ? { top: 0, left }
    : rect.bottom + POPUP_SPACE > window.innerHeight
      ? { bottom: window.innerHeight - rect.top + 4, left }
      : { top: rect.bottom + 4, left };
  return (
    <div
      className="z-popover fixed w-60 rounded-lg border border-line bg-elevated p-1 text-ui shadow-xl"
      style={style}
    >
      {open.items.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-fg-muted">{t`맞는 사람이 없습니다`}</p>
      ) : (
        <div role="listbox" aria-label={t`멘션할 사람`}>
          {open.items.map((u, i) => (
            <div
              key={u.id}
              role="option"
              tabIndex={-1}
              aria-selected={i === open.index}
              data-selected={i === open.index ? "" : undefined}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 select-none data-selected:bg-accent-soft data-selected:text-accent"
              // 편집기 포커스를 잃지 않게 mousedown에서 고른다
              onMouseDown={(e) => {
                e.preventDefault();
                open.pick(u);
              }}
              onMouseEnter={() => onHover(i)}
            >
              <Avatar name={u.name} />
              <span className="flex-none">{u.name}</span>
              {u.email && (
                <span className="ml-auto min-w-0 truncate text-2xs text-fg-muted">
                  {u.email}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
