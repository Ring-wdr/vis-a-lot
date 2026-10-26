// 시드용 결정적 난수. 같은 씨앗이면 같은 순서로 같은 값을 낸다 (mulberry32).

export type Random = {
  /** [0, 1) */
  next(): number;
  /** [min, max] 정수 */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** 원본을 건드리지 않고 섞은 사본 */
  shuffle<T>(items: readonly T[]): T[];
};

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
