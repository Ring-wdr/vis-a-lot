"use client";

import {
  Eraser,
  type LucideIcon,
  PenLine,
  Slash,
  Square,
  Type,
  Undo2,
} from "lucide-react";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import {
  PAINT_TOOLS,
  type PaintTool,
} from "@/entities/workspace/model/workspace-store";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import type { ItemState } from "@/shared/api/types";
import { itemButton } from "@/shared/ui/button";

const TOOL_UI: Record<PaintTool, { label: string; Icon: LucideIcon }> = {
  rect: { label: "사각형", Icon: Square },
  line: { label: "선", Icon: Slash },
  freehand: { label: "자유곡선", Icon: PenLine },
  text: { label: "텍스트", Icon: Type },
};

/**
 * 페인트 모드의 item 도구: 그리기 도구 선택, 도형 되돌리기, 도형 전체 삭제.
 * 도구는 탭 안의 모든 item이 함께 쓴다.
 */
export function PaintToolbar({
  item,
  busy,
  undoCount,
  onAction,
}: {
  item: ItemState;
  busy: boolean;
  /** 이 세션에서 그린 도형 수 */
  undoCount: number;
  onAction: (action: ItemAction) => void;
}) {
  const tool = useWorkspace((s) => s.paintTool);
  const setTool = useWorkspace((s) => s.setPaintTool);

  return (
    <div
      className="flex gap-0.5"
      role="toolbar"
      aria-label={`${item.label} 그리기 도구`}
    >
      {PAINT_TOOLS.map((t) => {
        const { label, Icon } = TOOL_UI[t];
        return (
          <button
            key={t}
            type="button"
            className={itemButton()}
            title={label}
            aria-label={label}
            aria-pressed={tool === t}
            onClick={() => setTool(t)}
          >
            <Icon size={13} aria-hidden="true" />
          </button>
        );
      })}
      <span className="m-0.5 w-px self-stretch bg-line" aria-hidden="true" />
      <button
        type="button"
        className={itemButton()}
        title="도형 되돌리기"
        aria-label="도형 되돌리기"
        disabled={busy || undoCount === 0 || item.shapeCount === 0}
        onClick={() => onAction({ type: "undoShape" })}
      >
        <Undo2 size={13} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={itemButton()}
        title="도형 전체 삭제"
        aria-label="도형 전체 삭제"
        disabled={busy || item.shapeCount === 0}
        onClick={() => onAction({ type: "clearShapes" })}
      >
        <Eraser size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
