"use client";

import { create } from "zustand";

type AlertState = {
  message?: string;
  show: (message: string) => void;
  close: () => void;
};

/** 화면 어디서든 띄우는 알림 팝업 상태 */
export const useAlert = create<AlertState>((set) => ({
  show: (message) => set({ message }),
  close: () => set({ message: undefined }),
}));
