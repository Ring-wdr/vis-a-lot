// @vitest-environment jsdom
// 설정 패널은 자기가 보여주는 draft 필드가 바뀔 때만 다시 그려야 한다.
// grid·필터·공통 속성은 다른 곳이 고치므로, 그걸 바꿨을 때 패널 전체가 다시 그려지면 구독이 넓은 것이다.

import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceScope } from "@/entities/workspace/model/workspace-scope";
import {
  createWorkspaceStore,
  defaultSpec,
  type WorkspaceStore,
} from "@/entities/workspace/model/workspace-store";
import type { ChartDefaults, ColumnInfo } from "@/shared/api/types";
import { ControlPanel } from "./ControlPanel";

const COLUMNS: ColumnInfo[] = [
  {
    name: "t",
    label: "시각",
    type: "datetime",
    nullable: false,
    distinct: null,
  },
  { name: "v", label: "값", type: "numeric", nullable: false, distinct: null },
  { name: "w", label: "값2", type: "numeric", nullable: false, distinct: null },
  {
    name: "c",
    label: "범주",
    type: "categorical",
    nullable: false,
    distinct: 3,
  },
];
const schema = { data: { columns: COLUMNS } };
let panelRenders = 0;

vi.mock("@/shared/api/queries", async (original) => ({
  ...(await original<typeof import("@/shared/api/queries")>()),
  useDatasetSchema: () => schema,
  // ControlPanel 본문만 부른다. 패널 렌더 수를 여기서 센다.
  useSchemaState: () => {
    panelRenders++;
    return "ready";
  },
  useDatasets: () => ({ data: { datasets: [] } }),
  useJobProgress: () => ({ data: undefined }),
}));

let store: WorkspaceStore;

beforeEach(() => {
  store = createWorkspaceStore({
    draft: defaultSpec(CHART_DEFAULTS as ChartDefaults),
  });
  const client = new QueryClient({
    defaultOptions: { queries: { enabled: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <WorkspaceScope store={store}>
        <ControlPanel />
      </WorkspaceScope>
    </QueryClientProvider>,
  );
  panelRenders = 0;
});

afterEach(cleanup);

describe("ControlPanel 렌더 횟수", () => {
  it("스키마에 맞춰 x·y를 처음 채운다", () => {
    const { x, y } = store.getState().draft;
    expect(x).toBe("t");
    expect(y).toBe("v");
  });

  it("필터를 바꿔도 패널은 다시 그리지 않는다", () => {
    act(() =>
      store.getState().updateDraft({
        filters: [
          {
            kind: "range",
            column: "v",
            min: 0,
            max: 1,
            inverse: false,
            includeNull: false,
          },
        ],
      }),
    );
    expect(panelRenders).toBe(0);
  });

  it("grid를 바꿔도 패널은 다시 그리지 않는다", () => {
    act(() => store.getState().updateDraft({ grid: { rows: 2, cols: 2 } }));
    expect(panelRenders).toBe(0);
  });

  it("공통 속성(전체 설정)을 바꿔도 패널은 다시 그리지 않는다", () => {
    act(() =>
      store.getState().updateDraft({
        common: { ...store.getState().draft.common, color: "#ff0000" },
      }),
    );
    expect(panelRenders).toBe(0);
  });

  it("패널이 보여주는 값(y)을 바꾸면 한 번 다시 그린다", () => {
    act(() => store.getState().updateDraft({ y: "w" }));
    expect(panelRenders).toBe(1);
  });
});
