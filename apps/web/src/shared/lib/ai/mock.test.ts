import { describe, expect, it } from "vitest";
import { draftLines, mockAdapter, sampleFromSchema } from "./mock";
import type { ActivityData, SuggestFieldsInput } from "./types";

const activity: ActivityData = {
  from: "2026-10-19",
  to: "2026-10-23",
  groupName: "피드 개발",
  days: [
    {
      date: "2026-10-19",
      entries: [
        {
          actorName: "김지원",
          key: "FD-1",
          title: "로그인 오류",
          kind: "status",
          text: "진행 중으로 바꿈",
        },
        {
          actorName: "박서준",
          key: "FD-2",
          title: "차트 추가",
          kind: "created",
          text: "만듦",
        },
        {
          actorName: "김지원",
          key: "FD-3",
          title: "주간 회의",
          kind: "comment",
          text: "댓글 남김",
        },
      ],
    },
    { date: "2026-10-20", entries: [] },
  ],
  completed: [
    { key: "FD-1", title: "로그인 오류", assigneeName: "김지원" },
    { key: "FD-4", title: "문서 정리", assigneeName: null },
  ],
};

async function collect(it: AsyncIterable<string>) {
  const chunks: string[] = [];
  for await (const c of it) chunks.push(c);
  return chunks;
}

describe("mock draftReport", () => {
  it("날짜별로, 같은 날은 사람별로 묶고 완료 목록으로 끝난다", () => {
    expect(draftLines(activity)).toEqual([
      "# 피드 개발 활동 보고 (2026-10-19 ~ 2026-10-23)",
      "",
      "기간 동안 활동 3건, 완료 2건이 있었습니다.",
      "",
      "## 2026-10-19",
      "- 김지원님: FD-1 '로그인 오류' 진행 중으로 바꿈, FD-3 '주간 회의' 댓글 남김.",
      "- 박서준님: FD-2 '차트 추가' 만듦.",
      "",
      "## 완료한 일",
      "- FD-1 로그인 오류 (담당 김지원)",
      "- FD-4 문서 정리 (담당자 없음)",
    ]);
  });

  it("줄 단위 조각으로 흘려주고, 같은 입력이면 같은 출력이다", async () => {
    const a = await collect(mockAdapter.draftReport(activity));
    const b = await collect(mockAdapter.draftReport(activity));
    expect(a).toEqual(b);
    expect(a.join("")).toBe(`${draftLines(activity).join("\n")}\n`);
  });

  it("중단하면 더 흘려주지 않는다", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    expect(
      await collect(mockAdapter.draftReport(activity, { signal: ctrl.signal })),
    ).toEqual([]);
  });
});

describe("mock summarize", () => {
  it("첫 문단과 마지막 댓글을 잇는다", async () => {
    expect(
      await mockAdapter.summarize({
        title: "제목",
        bodyText: "\n첫 문단입니다.\n\n둘째 문단",
        lastComment: "확인했습니다",
      }),
    ).toBe("첫 문단입니다. 마지막 댓글: 확인했습니다");
  });

  it("본문이 비면 제목을 쓴다", async () => {
    expect(
      await mockAdapter.summarize({ title: "제목만", bodyText: " " }),
    ).toBe("제목만");
  });
});

describe("mock suggestFields", () => {
  const base: Omit<SuggestFieldsInput, "title" | "body"> = {
    postTypes: [
      { id: "t-bug", name: "버그" },
      { id: "t-feature", name: "기능" },
      { id: "t-question", name: "질문" },
      { id: "t-data", name: "데이터 요청" },
      { id: "t-log", name: "업무 기록" },
    ],
    users: [
      { id: "u1", name: "김지원" },
      { id: "u2", name: "박서준" },
    ],
  };
  const suggest = (title: string, body = "") =>
    mockAdapter.suggestFields({ ...base, title, body });

  it("키워드로 유형을 고른다", async () => {
    expect(await suggest("저장 버튼이 안 됨")).toEqual({ postTypeId: "t-bug" });
    expect(await suggest("대시보드 오류")).toEqual({ postTypeId: "t-bug" });
    expect(await suggest("10월 매출 데이터 요청")).toEqual({
      postTypeId: "t-data",
    });
    expect(await suggest("필터 기능 추가")).toEqual({
      postTypeId: "t-feature",
    });
    expect(await suggest("이건 어떻게 쓰나요?")).toEqual({
      postTypeId: "t-question",
    });
    expect(await suggest("아무 말")).toEqual({});
  });

  it("긴급이면 우선순위 4, 본문에 나온 사용자를 담당자로", async () => {
    expect(await suggest("[긴급] 결제 실패", "@박서준 확인 부탁")).toEqual({
      postTypeId: "t-bug",
      priority: 4,
      assigneeId: "u2",
    });
  });

  it("그룹에 없는 유형은 고르지 않는다", async () => {
    expect(
      await mockAdapter.suggestFields({
        title: "오류",
        body: "",
        postTypes: [],
        users: [],
      }),
    ).toEqual({});
  });
});

describe("mock generate", () => {
  it("스키마가 있으면 스키마 모양의 JSON을 돌려준다", async () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        n: { type: "integer" },
        kind: { enum: ["a", "b"] },
        tags: { type: "array" },
      },
    };
    expect(JSON.parse(await mockAdapter.generate("x", { schema }))).toEqual({
      name: "",
      n: 0,
      kind: "a",
      tags: [],
    });
    expect(sampleFromSchema({ type: "boolean" })).toBe(false);
  });

  it("스키마가 없으면 흉내 문장", async () => {
    expect(await mockAdapter.generate("  안녕  ")).toBe("(흉내 응답) 안녕");
  });
});
