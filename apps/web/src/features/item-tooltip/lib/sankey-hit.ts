// sankey metadata 위의 히트 테스트. 흐름은 서버 렌더러와 같은 가로 3차 베지어(조절점이 가운데 x)라
// 커서 x에서의 곡선 가운데 y를 구해 굵기 안인지 본다.

import type { SankeyMeta } from "@/shared/api/types";

type Link = SankeyMeta["links"][number];

/** 노드 사각형을 이만큼 넓혀 잡는다 (얇은 노드도 가리킬 수 있게) */
const NODE_SLOP_PX = 2;
/** 얇은 흐름도 가리킬 수 있는 최소 반폭 */
const LINK_MIN_HALF_PX = 3;
const BISECT_STEPS = 24;

export type SankeyHit =
  | { kind: "node"; index: number }
  | { kind: "link"; index: number };

function ends(meta: SankeyMeta, link: Link) {
  return { xs: meta.nodes[link.source].x1, xt: meta.nodes[link.target].x0 };
}

/**
 * 곡선 위 x에서의 가운데 y. 곡선은 (xs, y0) → (xt, y1), 조절점 (xm, y0), (xm, y1)이다.
 * x(t)는 단조 증가라 이분법으로 t를 찾는다. 범위 밖이면 null.
 */
export function linkCenterY(
  xs: number,
  xt: number,
  y0: number,
  y1: number,
  x: number,
): number | null {
  if (x < xs || x > xt || xt <= xs) return null;
  const u = (x - xs) / (xt - xs);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < BISECT_STEPS; i++) {
    const t = (lo + hi) / 2;
    const xt3 = 1.5 * t - 1.5 * t * t + t * t * t;
    if (xt3 < u) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2;
  return y0 + (y1 - y0) * (3 * t * t - 2 * t * t * t);
}

/** 커서(PNG 좌표)가 가리키는 노드 또는 흐름. 노드가 위에 그려지므로 먼저 본다. */
export function hitSankey(
  meta: SankeyMeta,
  px: number,
  py: number,
): SankeyHit | null {
  const node = meta.nodes.findIndex(
    (n) =>
      px >= n.x0 - NODE_SLOP_PX &&
      px <= n.x1 + NODE_SLOP_PX &&
      py >= n.y0 - NODE_SLOP_PX &&
      py <= n.y1 + NODE_SLOP_PX,
  );
  if (node !== -1) return { kind: "node", index: node };

  // 겹친 흐름 중에서는 곡선 가운데가 커서에 가장 가까운 것을 고른다.
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  meta.links.forEach((link, i) => {
    const { xs, xt } = ends(meta, link);
    const cy = linkCenterY(xs, xt, link.y0, link.y1, px);
    if (cy === null) return;
    const distance = Math.abs(py - cy);
    if (distance > Math.max(link.width / 2, LINK_MIN_HALF_PX)) return;
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best === -1 ? null : { kind: "link", index: best };
}

/** 흐름 띠의 윤곽 (SVG path, PNG 좌표). 위 가장자리를 따라가고 아래 가장자리로 돌아온다. */
export function linkOutline(meta: SankeyMeta, link: Link) {
  const { xs, xt } = ends(meta, link);
  const xm = (xs + xt) / 2;
  const h = Math.max(link.width, 1) / 2;
  const top = [link.y0 - h, link.y1 - h];
  const bottom = [link.y0 + h, link.y1 + h];
  return [
    `M${xs},${top[0]}`,
    `C${xm},${top[0]} ${xm},${top[1]} ${xt},${top[1]}`,
    `L${xt},${bottom[1]}`,
    `C${xm},${bottom[1]} ${xm},${bottom[0]} ${xs},${bottom[0]}`,
    "Z",
  ].join(" ");
}
