"use client";

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
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
import "../config/messages";

const TOOL_ICONS: Record<PaintTool, LucideIcon> = {
  rect: Square,
  line: Slash,
  freehand: PenLine,
  text: Type,
};

const TOOL_LABELS = {
  rect: msg({ message: "사각형", context: "paint tool" }),
  line: msg({ message: "선", context: "paint tool" }),
  freehand: msg({ message: "자유곡선", context: "paint tool" }),
  text: msg({ message: "텍스트", context: "paint tool" }),
} satisfies Record<PaintTool, MessageDescriptor>;

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
  const { t, i18n } = useLingui();
  const label = item.label;
  const undoShape = t`도형 되돌리기`;
  const clearShapes = t`도형 전체 삭제`;
  const tool = useWorkspace((s) => s.paintTool);
  const setTool = useWorkspace((s) => s.setPaintTool);

  return (
    <div
      className="flex gap-0.5"
      role="toolbar"
      aria-label={t`${label} 그리기 도구`}
    >
      {PAINT_TOOLS.map((paint) => {
        const toolLabel = i18n._(TOOL_LABELS[paint]);
        const Icon = TOOL_ICONS[paint];
        return (
          <button
            key={paint}
            type="button"
            className={itemButton()}
            title={toolLabel}
            aria-label={toolLabel}
            aria-pressed={tool === paint}
            onClick={() => setTool(paint)}
          >
            <Icon size={13} aria-hidden="true" />
          </button>
        );
      })}
      <span className="m-0.5 w-px self-stretch bg-line" aria-hidden="true" />
      <button
        type="button"
        className={itemButton()}
        title={undoShape}
        aria-label={undoShape}
        disabled={busy || undoCount === 0 || item.shapeCount === 0}
        onClick={() => onAction({ type: "undoShape" })}
      >
        <Undo2 size={13} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={itemButton()}
        title={clearShapes}
        aria-label={clearShapes}
        disabled={busy || item.shapeCount === 0}
        onClick={() => onAction({ type: "clearShapes" })}
      >
        <Eraser size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
