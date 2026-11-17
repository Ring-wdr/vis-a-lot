import { cn } from "@vis-a-lot/shared/lib/tw";
import type { LayoutNode } from "@/entities/workspace/lib/layout-tree";

/**
 * 레이아웃의 작은 그림. preset은 split마다 똑같이 나누므로 비율 대신 같은 몫(flex-1)으로 그린다.
 */
export function LayoutThumb({ node }: { node: LayoutNode }) {
  if (node.type === "leaf")
    return (
      <span className="min-h-0 min-w-0 flex-1 rounded-xs bg-line-strong" />
    );
  return (
    <span
      className={cn(
        "flex min-h-0 min-w-0 flex-1 gap-0.5",
        node.direction === "vertical" && "flex-col",
      )}
    >
      {node.children.map((child, i) => (
        // 그림은 바뀌지 않아 자리 순번을 key로 쓴다.
        // biome-ignore lint/suspicious/noArrayIndexKey: 정적인 preset 그림
        <LayoutThumb key={i} node={child} />
      ))}
    </span>
  );
}
