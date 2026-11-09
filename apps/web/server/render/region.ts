// 차트 위 영역(사각형·자유형). 선택·새 범례·삭제가 쓴다. 위치는 데이터 좌표라 확대·이동해도 같은 데이터를 가리킨다.

export type Region =
  | { type: "rect"; x0: number; y0: number; x1: number; y1: number }
  | { type: "lasso"; points: [number, number][] };

type Project = (v: number) => number;
type Ctx = OffscreenCanvasRenderingContext2D;

/** 점 (x, y)가 영역 안에 있는지. 자유형은 시작점과 끝점을 이어 닫힌 다각형으로 본다. */
export function regionContains(region: Region, x: number, y: number) {
  if (region.type === "rect") {
    return (
      x >= Math.min(region.x0, region.x1) &&
      x <= Math.max(region.x0, region.x1) &&
      y >= Math.min(region.y0, region.y1) &&
      y <= Math.max(region.y0, region.y1)
    );
  }
  // ray casting: 오른쪽으로 쏜 반직선이 변을 홀수 번 지나면 안쪽이다.
  const { points } = region;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * 점 판정 함수. 점이 많을 때 쓰도록 경계 상자로 먼저 걸러,
 * 자유형의 변을 훑는 계산은 상자 안의 점에만 한다.
 */
export function regionTester(
  region: Region,
): (x: number, y: number) => boolean {
  if (region.type === "rect") return (x, y) => regionContains(region, x, y);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [px, py] of region.points) {
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  }
  return (x, y) =>
    x >= minX &&
    x <= maxX &&
    y >= minY &&
    y <= maxY &&
    regionContains(region, x, y);
}

/** 영역 테두리를 PNG 좌표로 그린다. 스타일은 호출하는 쪽에서 정한다. */
export function traceRegion(ctx: Ctx, region: Region, x: Project, y: Project) {
  ctx.beginPath();
  addRegion(ctx, region, x, y);
}

/** 지금 path에 영역을 더한다 (beginPath는 부르는 쪽이). */
function addRegion(ctx: Ctx, region: Region, x: Project, y: Project) {
  if (region.type === "rect") {
    const left = Math.min(x(region.x0), x(region.x1));
    const top = Math.min(y(region.y0), y(region.y1));
    ctx.rect(
      left,
      top,
      Math.abs(x(region.x1) - x(region.x0)),
      Math.abs(y(region.y1) - y(region.y0)),
    );
    return;
  }
  region.points.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(x(px), y(py));
    else ctx.lineTo(x(px), y(py));
  });
  ctx.closePath();
}

/**
 * 선택 영역 밖을 배경색으로 덮어 흐리게 한다. 점마다 투명도를 바꿔 두 번 훑는 대신 다 그린 뒤 한 번 칠한다.
 * 그림 영역 사각형에 영역을 구멍으로 더해 even-odd로 칠하므로, 자유형 판정(ray casting)과 같은 안쪽이 남는다.
 * strength는 덮는 진하기(0..1)다. 선택 밖 진하기가 d면 1 - d로 덮어 예전 모습과 비슷하게 한다.
 */
export function dimOutside(
  ctx: Ctx,
  region: Region,
  x: Project,
  y: Project,
  plot: { left: number; top: number; width: number; height: number },
  color: string,
  strength: number,
) {
  if (strength <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  addRegion(ctx, region, x, y);
  ctx.globalAlpha = Math.min(1, strength);
  ctx.fillStyle = color;
  ctx.fill("evenodd");
  ctx.restore();
}

/** 선택 영역: 점선 테두리와 옅은 바탕 */
export function drawSelection(
  ctx: Ctx,
  region: Region,
  x: Project,
  y: Project,
  color: string,
) {
  ctx.save();
  traceRegion(ctx, region, x, y);
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}
