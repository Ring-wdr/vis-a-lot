"use client";

import { LogOut } from "lucide-react";
import { logout, useSession } from "@/shared/api/session";
import styles from "@/shared/ui/workspace.module.css";

/** 상단 바 오른쪽: 로그인한 사용자와 로그아웃 */
export function UserMenu() {
  const name = useSession((s) =>
    s.status === "authenticated" ? s.user.name : undefined,
  );
  if (!name) return null;
  return (
    <div className={styles.userMenu}>
      <span>{name}</span>
      <button
        type="button"
        className={styles.secondaryButton}
        title="로그아웃"
        aria-label="로그아웃"
        onClick={() => logout()}
      >
        <LogOut size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
