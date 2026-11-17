"use client";

import { useLingui } from "@lingui/react/macro";
import { cn } from "@vis-a-lot/shared/lib/tw";
import { useMemo } from "react";
import {
  type LayoutNode,
  panelIdsOf,
} from "@/entities/workspace/lib/layout-tree";
import "../config/messages";
import { boardRects, boxStyle } from "../lib/layout-rects";

/**
 * 놓으면 바뀔 레이아웃의 미리보기. 칸 위에 칸 자리의 윤곽과 새 번호를 겹쳐 그리고, 옮기는 칸의 새 자리를 칠한다.
 * 실제 칸은 끄는 동안 움직이지 않는다 (놓을 대상이 포인터 아래에서 바뀌지 않게).
 */
export function DropPreview({
  layout,
  movedId,
}: {
  layout: LayoutNode;
  movedId: string;
}) {
  const { t } = useLingui();
  const cells = useMemo(() => {
    const { cells } = boardRects(layout);
    return panelIdsOf(layout).map((id, i) => ({
      id,
      number: i + 1,
      box: cells.get(id),
    }));
  }, [layout]);
  return (
    <div className="z-item-toolbar pointer-events-none absolute inset-0">
      {cells.map(({ id, number, box }) =>
        box ? (
          <div key={id} className="absolute p-1" style={boxStyle(box)}>
            <div
              data-moved={id === movedId || undefined}
              className={cn(
                "flex size-full items-start justify-end rounded-lg border-2 border-dashed border-line-strong p-1.5",
                "data-moved:border-accent data-moved:bg-accent-soft/70",
              )}
            >
              <span className="rounded-sm bg-elevated px-1 text-2xs font-semibold text-fg-secondary tabular-nums">
                {t`칸 ${number}`}
              </span>
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}
