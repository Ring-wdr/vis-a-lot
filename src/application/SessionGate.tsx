"use client";

import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { restoreSession, useSession } from "@/shared/api/session";
import { BootScreen } from "@/shared/ui/Loading";
import { LoginView } from "@/views/login/ui/LoginView";

/**
 * 로그인해야 화면을 보여준다. 처음 열면 남은 refresh token으로 로그인을 이어 가고,
 * 로그아웃하거나 세션이 끝나면 서버 상태 캐시를 비우고 로그인 화면으로 돌아간다.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const status = useSession((s) => s.status);
  const reason = useSession((s) =>
    s.status === "anonymous" ? s.reason : undefined,
  );
  const client = useQueryClient();

  useEffect(() => {
    // 실패하면 안에서 로그아웃 상태로 둔다.
    void restoreSession();
  }, []);

  useEffect(() => {
    if (status === "anonymous") client.clear();
  }, [status, client]);

  if (status === "unknown") return <BootScreen step="session" />;
  if (status === "anonymous") return <LoginView notice={reason} />;
  return children;
}
