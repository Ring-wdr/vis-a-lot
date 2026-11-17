import { describe, expect, it, vi } from "vitest";
import type { ItemState } from "../api/types";
import type { ChartItem, ChartRecord } from "../charts/chart-store";
import { JobQuerySchema } from "../services/chart/schemas";
import { type ItemSelection, jobState } from "./job-manager";

// jobState는 Render Worker 수만 읽는다. Worker를 띄우지 않게 막는다.
vi.mock("../runtime", () => ({ getRuntime: () => ({ render: { size: 1 } }) }));

type Job = Parameters<typeof jobState>[0];

const LABELS = [
  "Seoul_A1",
  "Seoul_B2",
  "Busan_A1",
  "busan_C3",
  "Incheon_SEOUL",
  "Daegu_A12",
];

function fakeJob(phase: Job["phase"] = "render"): Job {
  const items = LABELS.map(
    (label, i) => ({ key: `k${i}`, label }) as ChartItem,
  );
  const states = new Map(
    items.map((i) => [
      i.key,
      { key: i.key, label: i.label, status: "success" } as ItemState,
    ]),
  );
  return {
    id: "job",
    chart: { id: "chart", items } as ChartRecord,
    status: "progress",
    phase,
    dataset: { done: 1, total: 1 },
    items: states,
    order: phase === "render" ? items.map((i) => i.key) : [],
    version: 1,
    waiters: new Set(),
    abort: new AbortController(),
    kind: "draw",
    timing: { createdAt: 0 },
  };
}

const page = (
  search: NonNullable<Extract<ItemSelection, { page: number }>["search"]>,
  extra: { page?: number; pageSize?: number; offset?: number } = {},
): ItemSelection => ({ page: 0, pageSize: 100, ...extra, search });

const labelsOf = (job: Job, selection: ItemSelection) =>
  jobState(job, selection).items.map((i) => i.label);

describe("item 제목 검색", () => {
  it("일치 방식 넷", () => {
    const job = fakeJob();
    expect(labelsOf(job, page([{ keyword: "A1", match: "contains" }]))).toEqual(
      ["Seoul_A1", "Busan_A1", "Daegu_A12"],
    );
    expect(
      labelsOf(job, page([{ keyword: "seoul", match: "startsWith" }])),
    ).toEqual(["Seoul_A1", "Seoul_B2"]);
    expect(labelsOf(job, page([{ keyword: "a1", match: "endsWith" }]))).toEqual(
      ["Seoul_A1", "Busan_A1"],
    );
    expect(
      labelsOf(job, page([{ keyword: "busan_a1", match: "exact" }])),
    ).toEqual(["Busan_A1"]);
  });

  it("대소문자를 가리지 않는다", () => {
    const job = fakeJob();
    expect(
      labelsOf(job, page([{ keyword: "SEOUL", match: "contains" }])),
    ).toEqual(["Seoul_A1", "Seoul_B2", "Incheon_SEOUL"]);
  });

  it("조건이 여럿이면 하나라도 맞는 item을 원래 순서대로 남긴다 (OR)", () => {
    const job = fakeJob();
    const state = jobState(
      job,
      page([
        { keyword: "daegu", match: "startsWith" },
        { keyword: "b2", match: "endsWith" },
      ]),
    );
    expect(state.items.map((i) => i.label)).toEqual(["Seoul_B2", "Daegu_A12"]);
    expect(state.matchedItems).toBe(2);
    expect(state.totalItems).toBe(LABELS.length);
  });

  it("page·offset은 거른 순서 기준이다", () => {
    const job = fakeJob();
    const search = [{ keyword: "a1", match: "contains" as const }];
    expect(labelsOf(job, page(search, { page: 1, pageSize: 2 }))).toEqual([
      "Daegu_A12",
    ]);
    const ranged = jobState(job, page(search, { offset: 1, pageSize: 2 }));
    expect(ranged.offset).toBe(1);
    expect(ranged.items.map((i) => i.label)).toEqual(["Busan_A1", "Daegu_A12"]);
  });

  it("matchedItems: 조건이 없으면 totalItems와 같고, 맞는 item이 없으면 0, 조합을 모르면 null", () => {
    const job = fakeJob();
    expect(jobState(job, { page: 0, pageSize: 9 }).matchedItems).toBe(6);
    expect(jobState(job, page([])).matchedItems).toBe(6);
    const none = jobState(job, page([{ keyword: "x", match: "exact" }]));
    expect(none.matchedItems).toBe(0);
    expect(none.items).toEqual([]);
    const init = fakeJob("query");
    expect(
      jobState(init, page([{ keyword: "a", match: "contains" }])).matchedItems,
    ).toBeNull();
  });

  it("거른 순서는 조건이 같으면 다시 쓰고, item 목록이 정해지면 다시 거른다", () => {
    const job = fakeJob("query");
    const search = [{ keyword: "seoul", match: "startsWith" as const }];
    expect(labelsOf(job, page(search))).toEqual([]);
    // 조회가 끝나 item 순서가 정해짐
    job.phase = "render";
    job.order = (job.chart.items ?? []).map((i) => i.key);
    expect(labelsOf(job, page(search))).toEqual(["Seoul_A1", "Seoul_B2"]);
    const cached = job.searched?.order;
    labelsOf(job, page([{ keyword: "SEOUL", match: "startsWith" }]));
    expect(job.searched?.order).toBe(cached);
  });

  it("items=(키 지정)에는 적용하지 않는다", () => {
    const job = fakeJob();
    const state = jobState(job, { keys: ["k0", "k3"] });
    expect(state.items.map((i) => i.label)).toEqual(["Seoul_A1", "busan_C3"]);
    expect(state.matchedItems).toBe(LABELS.length);
  });
});

describe("job 조회의 search query", () => {
  it("JSON 문자열을 조건 배열로 읽는다", () => {
    const parsed = JobQuerySchema.parse({
      search: JSON.stringify([{ keyword: "A", match: "exact" }]),
    });
    expect(parsed.search).toEqual([{ keyword: "A", match: "exact" }]);
  });

  it("잘못된 JSON, 모르는 방식, 한도 초과는 거절한다", () => {
    const ok = (search: string) => JobQuerySchema.safeParse({ search }).success;
    expect(ok("[{")).toBe(false);
    expect(ok(JSON.stringify([{ keyword: "A", match: "regex" }]))).toBe(false);
    expect(
      ok(
        JSON.stringify(
          Array.from({ length: 11 }, (_, i) => ({
            keyword: `k${i}`,
            match: "contains",
          })),
        ),
      ),
    ).toBe(false);
    expect(
      ok(JSON.stringify([{ keyword: "a".repeat(101), match: "contains" }])),
    ).toBe(false);
  });
});
