"use client";

import { type ReactNode, useEffect, useState } from "react";

type State =
  | { status: "booting" }
  | { status: "ready" }
  | { status: "error"; message: string };

/** 브라우저 안의 mock 서버(MSW)가 뜬 뒤에 children을 렌더한다. */
export function MockServerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "booting" });

  useEffect(() => {
    let alive = true;
    import("@/server/browser")
      .then(({ startMockServer }) => startMockServer())
      .then(
        () => alive && setState({ status: "ready" }),
        (err: unknown) =>
          alive &&
          setState({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          }),
      );
    return () => {
      alive = false;
    };
  }, []);

  if (state.status === "booting") return <p>서버 부팅 중…</p>;
  if (state.status === "error")
    return <p role="alert">서버 부팅 실패: {state.message}</p>;
  return children;
}
