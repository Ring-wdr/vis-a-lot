// metadata의 점들을 격자 버킷에 나눠 담아, 커서 주변 칸만 훑어 가장 가까운 점을 찾는다.

const CELL = 16;

export class PointIndex {
  readonly #px: readonly number[];
  readonly #py: readonly number[];
  readonly #buckets = new Map<number, number[]>();

  constructor(px: readonly number[], py: readonly number[]) {
    this.#px = px;
    this.#py = py;
    for (let i = 0; i < px.length; i++) {
      const key = this.#key(Math.floor(px[i] / CELL), Math.floor(py[i] / CELL));
      const bucket = this.#buckets.get(key);
      if (bucket) bucket.push(i);
      else this.#buckets.set(key, [i]);
    }
  }

  #key(cx: number, cy: number) {
    return cx * 100_000 + cy;
  }

  /** maxDistance(px) 안에서 가장 가까운 점의 인덱스. 없으면 -1 */
  nearest(x: number, y: number, maxDistance: number): number {
    const reach = Math.ceil(maxDistance / CELL);
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    let best = -1;
    let bestD2 = maxDistance * maxDistance;
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dy = -reach; dy <= reach; dy++) {
        const bucket = this.#buckets.get(this.#key(cx + dx, cy + dy));
        if (!bucket) continue;
        for (const i of bucket) {
          const ddx = this.#px[i] - x;
          const ddy = this.#py[i] - y;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 <= bestD2) {
            bestD2 = d2;
            best = i;
          }
        }
      }
    }
    return best;
  }
}
