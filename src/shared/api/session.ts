"use client";

// 로그인 세션. access token은 메모리에만 두고, refresh token은 새로고침해도 이어지도록 localStorage에 둔다.
// (실서비스라면 refresh token은 httpOnly 쿠키가 맞다. 브라우저 안 mock 서버라 쿠키를 쓸 수 없다.)

import createClient from "openapi-fetch";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { defineMessages, t } from "@/shared/lib/i18n";
import type { paths as AuthPaths } from "./generated/auth";
import type { TokenResponse, User } from "./types";

const REFRESH_KEY = "vis-a-lot:refresh-token";
/** 만료 직전 토큰으로 보내지 않도록 이만큼 남으면 미리 새로 받는다. */
const RENEW_BEFORE_MS = 15_000;

export type SessionState =
  | { status: "unknown" }
  | { status: "anonymous"; reason?: string }
  | {
      status: "authenticated";
      user: User;
      accessToken: string;
      expiresAt: number;
    };

export const sessionStore = createStore<SessionState>(() => ({
  status: "unknown",
}));

export function useSession<T>(selector: (s: SessionState) => T) {
  return useStore(sessionStore, selector);
}

const auth = createClient<AuthPaths>({ baseUrl: "/api/auth" });

function readRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function writeRefreshToken(token: string | null) {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {}
}

function accept(tokens: TokenResponse) {
  writeRefreshToken(tokens.refreshToken);
  sessionStore.setState({
    status: "authenticated",
    user: tokens.user,
    accessToken: tokens.accessToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  });
}

const messages = defineMessages({
  ko: {
    loginFailed: "로그인하지 못했습니다.",
    expired: "세션이 만료되었습니다. 다시 로그인해 주세요.",
  },
  en: {
    loginFailed: "Could not sign in.",
    expired: "Your session has expired. Please sign in again.",
  },
});

function signOut(reason?: string) {
  writeRefreshToken(null);
  sessionStore.setState({ status: "anonymous", reason });
}

export async function login(username: string, password: string) {
  const { data, error } = await auth.POST("/login", {
    body: { username, password },
  });
  if (!data) throw new Error(error?.error ?? t(messages).loginFailed);
  accept(data);
}

let refreshing: Promise<boolean> | undefined;

/**
 * refresh token으로 토큰을 새로 받는다. 동시에 여러 요청이 401을 받아도 한 번만 부른다.
 * refresh token은 한 번 쓰면 폐기되므로(rotation) 겹쳐 부르면 뒤 요청이 실패하기 때문이다.
 */
export function refreshSession() {
  refreshing ??= (async () => {
    const refreshToken = readRefreshToken();
    if (!refreshToken) {
      // 방금 만료로 로그아웃된 뒤 401을 받은 요청이 다시 부르면, 만료 안내를 지우지 않는다.
      if (sessionStore.getState().status !== "anonymous") signOut();
      return false;
    }
    const { data, error } = await auth
      .POST("/refresh", { body: { refreshToken } })
      .catch(() => ({ data: undefined, error: undefined }));
    if (!data) {
      signOut(error?.error ?? t(messages).expired);
      return false;
    }
    accept(data);
    return true;
  })().finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}

/** 앱을 열 때: 남아 있는 refresh token이 있으면 로그인을 이어 간다. */
export function restoreSession() {
  if (!readRefreshToken()) {
    signOut();
    return Promise.resolve(false);
  }
  return refreshSession();
}

export async function logout() {
  const refreshToken = readRefreshToken();
  signOut();
  if (refreshToken)
    await auth.POST("/logout", { body: { refreshToken } }).catch(() => {});
}

/** 지금 쓸 access token. 곧 만료되면 먼저 새로 받는다. */
export async function currentAccessToken() {
  const s = sessionStore.getState();
  if (s.status !== "authenticated") return undefined;
  if (s.expiresAt - RENEW_BEFORE_MS > Date.now()) return s.accessToken;
  if (!(await refreshSession())) return undefined;
  const next = sessionStore.getState();
  return next.status === "authenticated" ? next.accessToken : undefined;
}
