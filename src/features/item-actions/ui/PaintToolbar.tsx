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
import { defineMessages, useT } from "@/shared/lib/i18n";
import { itemButton } from "@/shared/ui/button";

const TOOL_ICONS: Record<PaintTool, LucideIcon> = {
  rect: Square,
  line: Slash,
  freehand: PenLine,
  text: Type,
};

const messages = defineMessages({
  ko: {
    tools: {
      rect: "사각형",
      line: "선",
      freehand: "자유곡선",
      text: "텍스트",
    } satisfies Record<PaintTool, string>,
    toolbar: (item: string) => `${item} 그리기 도구`,
    undoShape: "도형 되돌리기",
    clearShapes: "도형 전체 삭제",
  },
  en: {
    tools: {
      rect: "Rectangle",
      line: "Line",
      freehand: "Freehand",
      text: "Text",
    },
    toolbar: (item: string) => `${item} drawing tools`,
    undoShape: "Undo shape",
    clearShapes: "Clear all shapes",
  },
});

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
  const text = useT(messages);
  const tool = useWorkspace((s) => s.paintTool);
  const setTool = useWorkspace((s) => s.setPaintTool);

  return (
    <div
      className="flex gap-0.5"
      role="toolbar"
      aria-label={text.toolbar(item.label)}
    >
      {PAINT_TOOLS.map((t) => {
        const label = text.tools[t];
        const Icon = TOOL_ICONS[t];
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
        title={text.undoShape}
        aria-label={text.undoShape}
        disabled={busy || undoCount === 0 || item.shapeCount === 0}
        onClick={() => onAction({ type: "undoShape" })}
      >
        <Undo2 size={13} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={itemButton()}
        title={text.clearShapes}
        aria-label={text.clearShapes}
        disabled={busy || item.shapeCount === 0}
        onClick={() => onAction({ type: "clearShapes" })}
      >
        <Eraser size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
