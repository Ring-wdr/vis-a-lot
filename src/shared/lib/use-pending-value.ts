"use client";

import { startTransition, useRef, useState } from "react";

/**
 * 조작하는 동안 바꾼 값을 화면에만 먼저 보여 주고, 밖(URL·store)에는 조작이 끝날 때 반영한다.
 * 조작 중이 아니면 밖의 값을 그대로 보여 주므로, 밖에서 값이 바뀌어도(뒤로 가기, 전체 해제) 맞출 일이 없다.
 *
 * - `change(next)`: 화면의 값만 바꾼다 (긴급 업데이트).
 * - `commit(emit)`: transition 안에서 `emit`으로 밖에 반영하고, 그사이 더 바뀐 게 없으면 보류를 푼다.
 *   보류를 푸는 일도 같은 transition이라 밖의 새 값이 그려질 때 함께 바뀌어 깜빡이지 않는다.
 *   `emit`이 Promise를 돌려주면(서버 저장) 끝날 때까지 보류를 보여 주고, 실패해도 풀어 밖의 값으로 돌아간다.
 *   `hold`면 반영만 하고 보류는 계속 보여 준다 (입력 중인 글자처럼 밖의 값과 모양이 다를 때).
 * - `release()`: 보류를 버리고 밖의 값을 보여 준다.
 *
 * 바로 반영하는 조작(체크박스)은 이 훅 대신 `useOptimistic`을 쓴다.
 */
export function usePendingValue<T>(value: T) {
  const [pending, setPending] = useState<{ value: T; seq: number } | null>(
    null,
  );
  // 반영한 뒤에 더 바뀐 값이 있는지 알려고 change마다 번호를 붙인다.
  const seq = useRef(0);

  const change = (next: T) => {
    seq.current += 1;
    setPending({ value: next, seq: seq.current });
  };
  const commit = (emit: () => unknown, { hold = false } = {}) => {
    const at = seq.current;
    const settle = () => {
      if (!hold) setPending((p) => (p && p.seq > at ? p : null));
    };
    startTransition(() => {
      const done = emit();
      if (!(done instanceof Promise)) return settle();
      // await 뒤의 업데이트는 transition 밖이므로 다시 감싼다.
      return done.then(
        () => startTransition(settle),
        () => startTransition(settle),
      );
    });
  };
  const release = () => startTransition(() => setPending(null));

  return [
    pending ? pending.value : value,
    { change, commit, release },
  ] as const;
}
