"use client";

import { LogOut } from "lucide-react";
import { logout, useSession } from "@/shared/api/session";
import { button } from "@/shared/ui/button";

/** 상단 바 오른쪽: 로그인한 사용자와 로그아웃 */
export function UserMenu() {
  const name = useSession((s) =>
    s.status === "authenticated" ? s.user.name : undefined,
  );
  if (!name) return null;
  return (
    <div className="flex items-center gap-1.5 border-l border-line pl-2 text-ui text-fg-secondary">
      <span className="whitespace-nowrap">{name}</span>
      <button
        type="button"
        className={button({
          size: "sm",
          class: "inline-grid h-7 place-items-center",
        })}
        title="로그아웃"
        aria-label="로그아웃"
        onClick={() => logout()}
      >
        <LogOut size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
