// @vitest-environment jsdom
// draw 상태는 job 상태(진행 중 → 끝)가 바뀔 때만 다시 그려야 한다.
// 진행률 long polling은 응답마다 query를 다시 받는다(fetchStatus가 idle ↔ fetching). 고른 값을 렌더 중에
// 읽지 않으면 react-query가 쓰는 필드를 몰라 그때마다 다시 그린다. 이 테스트가 그 회귀를 잡는다.

import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceScope } from "@/entities/workspace/model/workspace-scope";
import {
  createWorkspaceStore,
  type DrawnChart,
  defaultSpec,
} from "@/entities/workspace/model/workspace-store";
import type { ChartDefaults, JobStateResponse } from "@/shared/api/types";
import { renderWithI18n } from "@/shared/lib/render-with-i18n";
import { useDrawState } from "./draw-state";

let fetches = 0;

// 진행률 응답: 늘 진행 중이고 version만 오른다. 응답이 오면 바로 다음 요청을 보낸다.
vi.mock("@/shared/api/api", async (original) => {
  const mod = await original<typeof import("@/shared/api/api")>();
  return {
    ...mod,
    api: {
      ...mod.api,
      job: () =>
        new Promise<Partial<JobStateResponse>>((resolve) =>
          setTimeout(
            () =>
              resolve({ jobId: "job", status: "progress", version: fetches++ }),
            2,
          ),
        ),
    },
  };
});

let renders = 0;
let state: string | undefined;

function Probe() {
  state = useDrawState();
  renders++;
  return null;
}

afterEach(cleanup);

describe("useDrawState 렌더 횟수", () => {
  it("차트를 여는 동안 진행률을 다시 받아도 다시 그리지 않는다", async () => {
    const draft = defaultSpec(CHART_DEFAULTS as ChartDefaults);
    const store = createWorkspaceStore({ draft });
    // history·공유 링크의 차트를 여는 중: job은 있고 opening이 켜져 있다. 이때 useDrawState는
    // 진행률을 보기 전에 "pending"을 돌려주므로, 미리 읽어 두지 않으면 쓰는 필드가 등록되지 않는다.
    store.setState({
      opening: true,
      current: { chartId: "chart", jobId: "job", spec: draft } as DrawnChart,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    renderWithI18n(
      <QueryClientProvider client={client}>
        <WorkspaceScope store={store}>
          <Probe />
        </WorkspaceScope>
      </QueryClientProvider>,
    );
    // 첫 응답(상태를 처음 받음)까지 기다린다.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(state).toBe("pending");
    renders = 0;
    const before = fetches;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    // 그동안 진행률을 여러 번 다시 받았다.
    expect(fetches - before).toBeGreaterThan(10);
    expect(renders).toBe(0);
    // 다 열면 그리는 중(cancel)으로 바뀐다.
    await act(async () => store.setState({ opening: false }));
    expect(state).toBe("cancel");
  });
});
