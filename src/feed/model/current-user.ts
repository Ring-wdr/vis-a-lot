// 프로토타입의 "로그인": 상단의 사용자 전환으로 고른 사용자. 새로고침해도 남도록 localStorage에 둔다.
// 모든 피드 API 요청은 이 사용자를 x-feed-user 헤더로 보낸다 (src/feed/api/client.ts).

import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const KEY = "vis-a-lot.feed.current-user";

function load() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

type CurrentUserState = {
  userId: string | null;
  setUserId: (userId: string | null) => void;
};

export const currentUserStore = createStore<CurrentUserState>((set) => ({
  userId: typeof window === "undefined" ? null : load(),
  setUserId: (userId) => {
    try {
      if (userId) localStorage.setItem(KEY, userId);
      else localStorage.removeItem(KEY);
    } catch {}
    set({ userId });
  },
}));

export function useCurrentUserId() {
  return useStore(currentUserStore, (s) => s.userId);
}
