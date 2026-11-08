"use client";

import { useQuery } from "@tanstack/react-query";
import { OverlayProvider } from "overlay-kit";
import type { ReactNode } from "react";
import { readShareHash } from "@/entities/chart/lib/share";
import { TabsScope } from "@/entities/workspace/model/tabs-scope";
import { chartDefaultsQuery } from "@/shared/api/queries";
import { BootScreen } from "@/shared/ui/Loading";

// 공유 링크(#s=…)로 들어오면 시작 화면을 건너뛰고 gallery에서 그 차트를 연다. 연 뒤에는 hash를 지운다.
const sharedLinkView = () =>
  readShareHash(location.hash) ? ("gallery" as const) : null;

/**
 * 로그인한 동안만 사는 상태. SessionGate가 로그인한 뒤에만 그리므로, 로그아웃하거나 세션이 끝나면
 * 탭(각 탭의 작업 상태)과 열려 있던 팝업이 통째로 사라져 다음 세션에 이전 화면이 남지 않는다.
 */
export function SessionScope({ children }: { children: ReactNode }) {
  // 차트 기본값을 먼저 받는다. 새 탭 draft와 설정 팝업이 서버 draw와 같은 기본값을 쓰게 한다.
  const defaults = useQuery(chartDefaultsQuery);
  if (defaults.error)
    return <BootScreen step="defaults" error={defaults.error.message} />;
  if (!defaults.data) return <BootScreen step="defaults" />;
  return (
    <TabsScope defaults={defaults.data} initialView={sharedLinkView}>
      {/* 팝업도 탭 상태를 쓰므로 그 안에서 그린다. */}
      <OverlayProvider>{children}</OverlayProvider>
    </TabsScope>
  );
}
