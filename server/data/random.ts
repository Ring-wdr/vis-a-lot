// 시드 기반 난수. 같은 시드면 어느 환경에서든 같은 수열을 만든다.

export type Random = {
  /** [0, 1) 균등분포 */
  next(): number;
  /** [min, max) 균등분포 */
  range(min: number, max: number): number;
  /** [min, max] 정수 */
  int(min: number, max: number): number;
  /** 표준정규분포 (Box–Muller) */
  normal(): number;
};

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  let spare: number | undefined;

  // mulberry32
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    normal() {
      if (spare !== undefined) {
        const v = spare;
        spare = undefined;
        return v;
      }
      let u = 0;
      while (u === 0) u = next();
      const v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return r * Math.cos(2 * Math.PI * v);
    },
  };
}

/** 문자열에서 하위 시드를 만든다. 센서마다 독립된 난수열을 쓰기 위함. */
export function deriveSeed(seed: number, key: string): number {
  let h = seed ^ 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}
