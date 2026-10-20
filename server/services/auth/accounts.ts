// mock 계정과 서비스 client. 실서버에서는 사용자 DB와 secret 저장소가 맡는다.

import { SCOPES, type Scope } from "../common/auth";
import type { User } from "./schemas";

type Account = User & { password: string };

const ALL: Scope[] = [...SCOPES];

export const ACCOUNTS: Account[] = [
  {
    id: "u-demo",
    username: "demo",
    password: "demo1234",
    name: "데모 사용자",
    scopes: ALL,
  },
];

/** 서비스 간 호출. chart 서비스가 데이터 준비를 data 서비스에 요청할 때 쓴다. */
export const SERVICE_CLIENTS = [
  {
    clientId: "chart-service",
    clientSecret: "chart-service-secret",
    scopes: ["data:read", "data:write"] as Scope[],
  },
];

export function findAccount(username: string, password: string) {
  return ACCOUNTS.find(
    (a) => a.username === username && a.password === password,
  );
}

export function toUser({ password: _, ...user }: Account): User {
  return user;
}
