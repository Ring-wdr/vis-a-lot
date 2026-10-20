// 팔레트는 서버 렌더러와 같은 정의를 쓴다.

import { PALETTE } from "@/server/render/theme";

export { PALETTE };

export function colorName(hex: string) {
  return (
    PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex
  );
}
