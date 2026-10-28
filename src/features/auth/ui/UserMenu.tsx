"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDown, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { logout, useSession } from "@/shared/api/session";
import { useLocale } from "@/shared/lib/i18n";
import * as m from "@/shared/lib/paraglide/messages/_index.js";
import { Avatar } from "@/shared/ui/Avatar";
import { button } from "@/shared/ui/button";
import { preferencesPopover } from "@/shared/ui/preferences-popover";

const p = preferencesPopover();

/**
 * 상단 바 오른쪽: 로그인한 사용자. 누르면 화면 설정(children: 테마, 언어)과 로그아웃을 담은 팝오버를 연다.
 * 트리거에는 사용자 이름만 두어 화면 언어가 바뀌어도 상단 바 폭이 그대로다.
 */
export function UserMenu({ children }: { children?: ReactNode }) {
  const locale = useLocale();
  const name = useSession((s) =>
    s.status === "authenticated" ? s.user.name : undefined,
  );
  if (!name) return null;
  return (
    <Popover.Root>
      <Popover.Trigger
        className={p.trigger()}
        aria-label={m.user_menu_label({}, { locale })}
      >
        <Avatar name={name} />
        <span className="truncate whitespace-nowrap">{name}</span>
        <ChevronDown size={13} className="flex-none" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className={p.positioner()}
          align="end"
          sideOffset={4}
        >
          <Popover.Popup className={p.popup()}>
            <div className="flex min-w-0 items-center gap-2">
              <Avatar name={name} />
              <span className="truncate font-semibold whitespace-nowrap text-fg">
                {name}
              </span>
            </div>
            {children && (
              <>
                <div className={p.separator()} />
                {children}
              </>
            )}
            <div className={p.separator()} />
            <button
              type="button"
              className={button({
                size: "sm",
                class: "w-full justify-center whitespace-nowrap",
              })}
              onClick={() => logout()}
            >
              <LogOut size={14} aria-hidden="true" />
              {m.user_menu_logout({}, { locale })}
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
