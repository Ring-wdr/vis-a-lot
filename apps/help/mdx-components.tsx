import type { MDXComponents } from "mdx/types";
import { MDX_COMPONENTS } from "@/shared/ui/mdx/mdx-components";

// @next/mdx가 App Router에서 찾는 필수 파일. src 아래에 두면 FSD 레이어 밖 파일이 되므로 루트에 두고,
// 요소 모양은 shared/ui/mdx에 둔다.
export function useMDXComponents(): MDXComponents {
  return MDX_COMPONENTS;
}
