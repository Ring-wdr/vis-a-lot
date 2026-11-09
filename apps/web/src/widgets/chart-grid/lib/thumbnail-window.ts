/**
 * 크게 보기 섬네일 목록의 첫 순번. 크게 보는 item(focus)을 가운데 두고 한 칸씩 미끄러지며,
 * 처음·끝에서는 목록을 꽉 채운 채 멈춘다. 짝수 개면 가운데 두 칸 중 왼쪽에 둔다.
 */
export function windowStart(focus: number, count: number, total: number) {
  const centered = focus - Math.floor((count - 1) / 2);
  return Math.max(0, Math.min(centered, total - count));
}
