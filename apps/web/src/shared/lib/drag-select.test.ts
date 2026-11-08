import { describe, expect, it } from "vitest";
import {
  type DragAction,
  type DragState,
  dragPreview,
  dragReducer,
  IDLE,
  releaseValue,
  toggleValue,
} from "./drag-select";

const visible = ["a", "b", "c", "d", "e", "f"] as const;
type V = (typeof visible)[number];

/** press 뒤 move를 차례로 적용한 상태 */
function run(
  value: readonly V[],
  startIndex: number,
  moves: { index: number; x?: number; y?: number }[],
  allowDrag = true,
): DragState<V> {
  let state: DragState<V> = dragReducer<V>(IDLE, {
    type: "press",
    index: startIndex,
    x: 0,
    y: 0,
    allowDrag,
    value,
    visible,
  });
  for (const m of moves) {
    const action: DragAction<V> = {
      type: "move",
      index: m.index,
      x: m.x ?? 0,
      y: m.y ?? 0,
    };
    state = dragReducer(state, action);
  }
  return state;
}

describe("drag-select 시작", () => {
  it("누르기만 하면 값을 바꾸지 않고, 그대로 떼면 토글한다", () => {
    const state = run([], 1, [{ index: 1, y: 3 }]);
    expect(state.phase).toBe("pending");
    expect(dragPreview(state)).toBeNull();
    expect(releaseValue(state)).toEqual(["b"]);
    expect(releaseValue(run(["a", "b"], 1, []))).toEqual(["a"]);
  });

  it("4px 이상 움직이면 같은 항목 위여도 드래그를 시작하고 시작 항목에 먼저 적용한다", () => {
    const state = run(["d"], 1, [{ index: 1, y: 4 }]);
    expect(state.phase).toBe("dragging");
    expect(dragPreview(state)).toEqual(["d", "b"]);
  });

  it("다른 항목으로 넘어가면 이동 거리와 상관없이 드래그를 시작한다", () => {
    expect(dragPreview(run([], 0, [{ index: 1, y: 1 }]))).toEqual(["a", "b"]);
  });

  it("모드는 시작 항목 기준이다: 안 골랐으면 add, 골랐으면 remove", () => {
    const add = run(["b"], 0, [{ index: 2 }]);
    expect(add.phase === "dragging" && add.mode).toBe("add");
    expect(dragPreview(add)).toEqual(["b", "a", "c"]);

    const remove = run(["a", "c", "e"], 2, [{ index: 4 }]);
    expect(remove.phase === "dragging" && remove.mode).toBe("remove");
    expect(dragPreview(remove)).toEqual(["a"]);
  });
});

describe("drag-select 적용 규칙", () => {
  it("add 모드는 안 고른 것만 방문 순서대로 끝에 붙이고 이미 고른 것은 그대로 둔다", () => {
    const state = run(["c", "a"], 1, [
      { index: 2 },
      { index: 3 },
      { index: 4 },
    ]);
    expect(dragPreview(state)).toEqual(["c", "a", "b", "d", "e"]);
  });

  it("remove 모드는 고른 것만 빼고 add와 섞이지 않는다", () => {
    const state = run(["b", "d", "f"], 1, [{ index: 5 }]);
    expect(dragPreview(state)).toEqual([]);
    const partial = run(["b", "f", "d"], 1, [{ index: 3 }]);
    expect(dragPreview(partial)).toEqual(["f"]);
  });

  it("빠르게 건너뛰어도 사이 항목을 방문 순서대로 채운다", () => {
    expect(dragPreview(run([], 0, [{ index: 5 }]))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("위로 드래그하면 위 방향 순서로 추가한다", () => {
    expect(dragPreview(run(["f"], 4, [{ index: 3 }, { index: 1 }]))).toEqual([
      "f",
      "e",
      "d",
      "c",
      "b",
    ]);
  });

  it("되돌아가면 지나쳤던 항목의 변경이 풀린다", () => {
    const down = run([], 1, [{ index: 4 }, { index: 2 }]);
    expect(dragPreview(down)).toEqual(["b", "c"]);
    // 시작 항목으로 돌아오면 시작 항목만 남는다
    expect(dragPreview(run([], 1, [{ index: 4 }, { index: 1 }]))).toEqual([
      "b",
    ]);
    // 시작 항목을 지나 반대쪽으로 가면 그쪽 방향 순서로 적용한다
    expect(dragPreview(run([], 2, [{ index: 4 }, { index: 0 }]))).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("remove 모드에서 되돌아가면 뺐던 항목이 원래 순서 자리로 돌아온다", () => {
    const state = run(["a", "b", "c", "d"], 0, [{ index: 3 }, { index: 1 }]);
    expect(dragPreview(state)).toEqual(["c", "d"]);
  });

  it("목록 범위 밖 index는 끝 항목으로 맞춘다", () => {
    expect(dragPreview(run([], 4, [{ index: 99 }]))).toEqual(["e", "f"]);
    expect(dragPreview(run([], 1, [{ index: -5 }]))).toEqual(["b", "a"]);
  });
});

describe("drag-select 끝", () => {
  it("Esc(cancel)면 드래그 전 값으로 되돌린다: 확정할 값이 없다", () => {
    const state = dragReducer(run(["a"], 1, [{ index: 3 }]), {
      type: "cancel",
    });
    expect(state).toBe(IDLE);
    expect(releaseValue(state)).toBeNull();
  });

  it("뗄 때 드래그 결과를 확정한다", () => {
    expect(releaseValue(run([], 0, [{ index: 2 }]))).toEqual(["a", "b", "c"]);
  });

  it("touch는 드래그로 넘어가지 않고, 많이 움직이면 탭도 취소한다", () => {
    const small = run([], 0, [{ index: 2, y: 5 }], false);
    expect(small.phase).toBe("pending");
    expect(releaseValue(small)).toEqual(["a"]);
    const scroll = run([], 0, [{ index: 2, y: 40 }], false);
    expect(releaseValue(scroll)).toBeNull();
  });

  it("toggleValue는 없으면 끝에 추가, 있으면 뺀다", () => {
    expect(toggleValue(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(toggleValue(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });
});
