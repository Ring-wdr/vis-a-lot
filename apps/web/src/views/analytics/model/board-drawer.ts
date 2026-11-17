"use client";

import { create } from "zustand";

/**
 * 좁은 폭(64rem 미만)에서 왼쪽 패널을 서랍으로 접는다. 도구 줄의 설정 버튼이 열고 닫는다.
 * 넓은 폭에서는 패널이 늘 보여 이 값을 쓰지 않는다.
 */
export const useSettingsDrawer = create<{
  open: boolean;
  toggle: () => void;
  close: () => void;
}>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
}));
