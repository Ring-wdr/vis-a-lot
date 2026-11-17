"use client";

import { useRouter } from "next/navigation";
import { useTabsStore } from "@/entities/workspace/model/tabs-scope";
import { tabsLockedHint } from "@/entities/workspace/model/tabs-store";
import type { ChartSpec } from "@/shared/api/types";
import { showAlert } from "@/shared/ui/AlertDialog";
import { queueOpen } from "./pending-open";

/**
 * 다른 화면(analytics 칸)의 차트 설정으로 새 gallery 탭을 열고 `/`로 간다.
 * 탭이 화면에 붙어 grid 크기를 안 뒤 gallery가 맡겨 둔 차트를 그린다 (pending-open).
 * gallery 탭이 그리는 중이라 잠겨 있으면 열지 않고 이유를 알린다.
 */
export function useOpenInGallery() {
  const tabs = useTabsStore();
  const router = useRouter();
  return (spec: ChartSpec) => {
    const tab = tabs.getState().openGallery(spec);
    if (!tab) {
      showAlert(tabsLockedHint());
      return;
    }
    queueOpen(tab.store, { spec });
    router.push("/");
  };
}
