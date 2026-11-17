// 크기를 바꾸는 조작(보드 경계 끌기)이 이어지는 동안 크기를 재는 쪽이 새 크기를 쓰지 않고 기다리게 한다.
// 끄는 도중 손을 잠깐 멈춰도 PNG를 다시 그리지 않고, 놓은 뒤 마지막 크기로 한 번만 그리게 한다.

let holds = 0;
const listeners = new Set<() => void>();

/** 크기 쓰기를 미룬다. 돌려준 함수로 푼다 (여러 번 불러도 한 번만 푼다). */
export function holdSizes() {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    if (holds === 0) for (const listener of [...listeners]) listener();
  };
}

/** 지금 크기 쓰기를 미루는 중인지 */
export const sizesHeld = () => holds > 0;

/** 모든 미룸이 풀리면 부른다. 구독을 푸는 함수를 돌려준다. */
export function onSizesReleased(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
