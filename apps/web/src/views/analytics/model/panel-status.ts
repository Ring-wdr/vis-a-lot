"use client";

import { create } from "zustand";

// 실패한 칸 (칸 id → true). 칸마다 작은 컴포넌트가 자기 job 상태를 읽어 옮기고, 하단 줄은 개수만 구독한다.
// 그리는 중인 칸은 보드 store(busy)가 들고 있다 (레이아웃 잠금에 쓴다). 실패는 이 화면의 표시에만 쓰므로 여기에 둔다.

type PanelStatus = {
  failed: Record<string, true>;
  setFailed: (panelId: string, failed: boolean) => void;
};

export const usePanelStatus = create<PanelStatus>((set) => ({
  failed: {},
  setFailed: (panelId, failed) =>
    set((s) => {
      if (failed === (s.failed[panelId] === true)) return s;
      if (failed) return { failed: { ...s.failed, [panelId]: true } };
      const { [panelId]: _done, ...rest } = s.failed;
      return { failed: rest };
    }),
}));
