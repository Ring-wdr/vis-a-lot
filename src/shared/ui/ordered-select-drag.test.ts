import { describe, expect, it } from "vitest";
import {
  type DragInput,
  type DragSession,
  IDLE,
  reduceDrag,
  toggleValue,
} from "./ordered-select-drag";

const KEYS = ["a", "b", "c", "d", "e", "f"];

/** 입력을 차례로 반영하고 마지막 세션과 값을 돌려준다. 값이 바뀌지 않은 입력은 이전 값을 유지한다. */
function run(start: string[], inputs: DragInput[], keys = KEYS) {
  let session: DragSession<string> = IDLE;
  let value = start;
  const history: string[][] = [];
  for (const input of inputs) {
    const result = reduceDrag(session, input, value, keys);
    session = result.session;
    if (result.value) value = result.value;
    history.push(value);
  }
  return { session, value, history };
}

/** index 행 위에 있는 포인터 (행 높이 32px로 가정) */
const at = (index: number, x = 10) => ({ x, y: index * 32 + 16, index });
const down = (index: number): DragInput => ({ type: "down", ...at(index) });
const move = (index: number, x?: number): DragInput => ({
  type: "move",
  ...at(index, x),
});

describe("클릭 토글", () => {
  it("없으면 끝에 추가하고 있으면 뺀다", () => {
    expect(toggleValue(["b"], "a")).toEqual(["b", "a"]);
    expect(toggleValue(["b", "a"], "b")).toEqual(["a"]);
  });

  it("4px 미만으로 움직이고 떼면 토글이다", () => {
    const { value, session } = run(
      ["c"],
      [
        down(1),
        { type: "move", x: 12, y: 1 * 32 + 18, index: 1 },
        { type: "up" },
      ],
    );
    expect(value).toEqual(["c", "b"]);
    expect(session).toEqual(IDLE);
  });

  it("누르기만 해서는 값이 바뀌지 않는다", () => {
    const { history } = run([], [down(2)]);
    expect(history).toEqual([[]]);
  });
});

describe("드래그 시작과 모드 (규칙 2)", () => {
  it("4px 이상 움직이면 시작하고 시작 항목에 먼저 적용한다", () => {
    const { value, session } = run(
      [],
      [down(1), { type: "move", x: 20, y: 48, index: 1 }],
    );
    expect(session.phase).toBe("dragging");
    expect(value).toEqual(["b"]);
  });

  it("다른 항목으로 넘어가면 이동 거리와 상관없이 시작한다", () => {
    const { value } = run(
      [],
      [down(1), { type: "move", x: 10, y: 49, index: 2 }],
    );
    expect(value).toEqual(["b", "c"]);
  });

  it("시작 항목이 선택돼 있으면 remove 모드다", () => {
    const { session, value } = run(["b", "c", "e"], [down(1), move(3)]);
    expect(session.phase === "dragging" && session.mode).toBe("remove");
    expect(value).toEqual(["e"]);
  });

  it("드래그 뒤 떼면 토글하지 않고 확정한다", () => {
    const { value, session } = run([], [down(0), move(2), { type: "up" }]);
    expect(value).toEqual(["a", "b", "c"]);
    expect(session).toEqual(IDLE);
  });
});

describe("방문 순서 적용 (규칙 3)", () => {
  it("add 모드는 안 고른 항목만 방문 순서대로 끝에 붙인다", () => {
    const { value } = run(["d", "a"], [down(1), move(2), move(3), move(4)]);
    expect(value).toEqual(["d", "a", "b", "c", "e"]);
  });

  it("remove 모드에서는 안 고른 항목을 추가하지 않는다", () => {
    const { value } = run(["a", "c"], [down(0), move(1), move(2), move(3)]);
    expect(value).toEqual([]);
  });

  it("add 모드에서는 이미 고른 항목을 빼지 않는다", () => {
    const { value } = run(["c"], [down(0), move(4)]);
    expect(value).toEqual(["c", "a", "b", "d", "e"]);
  });
});

describe("건너뛰기 채우기 (규칙 4)", () => {
  it("한 번에 여러 행을 넘어도 사이 항목을 순서대로 채운다", () => {
    const { value } = run([], [down(0), move(5)]);
    expect(value).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("목록 밖 index는 끝으로 맞춘다", () => {
    const { value } = run(
      [],
      [down(4), { type: "move", x: 10, y: 999, index: 99 }],
    );
    expect(value).toEqual(["e", "f"]);
  });
});

describe("되돌아가기와 위로 드래그 (규칙 5)", () => {
  it("시작 쪽으로 돌아오면 지나쳤던 변경을 되돌린다", () => {
    const { history } = run(["f"], [down(1), move(4), move(2)]);
    expect(history.at(-2)).toEqual(["f", "b", "c", "d", "e"]);
    expect(history.at(-1)).toEqual(["f", "b", "c"]);
  });

  it("시작 항목까지 돌아오면 시작 항목만 남는다", () => {
    const { value } = run([], [down(2), move(4), move(2)]);
    expect(value).toEqual(["c"]);
  });

  it("시작 항목을 지나 반대 방향으로 가면 그 방향 순서로 추가한다", () => {
    const { value } = run([], [down(2), move(4), move(0)]);
    expect(value).toEqual(["c", "b", "a"]);
  });

  it("위로 드래그하면 위 방향 순서로 추가한다", () => {
    const { value } = run(["a"], [down(4), move(3), move(1)]);
    expect(value).toEqual(["a", "e", "d", "c", "b"]);
  });

  it("remove 모드에서 되돌아가면 다시 살린다(원래 순서 그대로)", () => {
    const { history } = run(["e", "b", "c", "d"], [down(1), move(3), move(1)]);
    expect(history.at(-2)).toEqual(["e"]);
    expect(history.at(-1)).toEqual(["e", "c", "d"]);
  });
});

describe("Esc 취소 (규칙 7)", () => {
  it("드래그 시작 전 값으로 되돌리고, 뗄 때까지 이동을 무시한다", () => {
    const { history, session } = run(
      ["f"],
      [down(0), move(3), { type: "escape" }, move(5), { type: "up" }],
    );
    expect(history[1]).toEqual(["f", "a", "b", "c", "d"]);
    expect(history[2]).toEqual(["f"]);
    expect(history[3]).toEqual(["f"]);
    expect(history[4]).toEqual(["f"]);
    expect(session).toEqual(IDLE);
  });

  it("누르고 있는 중 Esc면 떼어도 토글하지 않는다", () => {
    const { value } = run([], [down(0), { type: "escape" }, { type: "up" }]);
    expect(value).toEqual([]);
  });
});

describe("확정", () => {
  it("pointercancel류(abort)는 드래그 결과를 남기고, 누르기만 한 상태면 토글하지 않는다", () => {
    expect(run([], [down(0), move(2), { type: "abort" }]).value).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(run([], [down(0), { type: "abort" }]).value).toEqual([]);
  });

  it("드래그 중에 보이는 목록이 바뀌어도 시작 시점 목록 기준으로 판정한다", () => {
    let session: DragSession<string> = IDLE;
    let value: string[] = [];
    for (const [input, keys] of [
      [down(0), KEYS],
      [move(1), KEYS],
      [move(2), ["x", "y", "z"]],
    ] as const) {
      const result = reduceDrag(session, input, value, keys);
      session = result.session;
      if (result.value) value = result.value;
    }
    expect(value).toEqual(["a", "b", "c"]);
  });
});
