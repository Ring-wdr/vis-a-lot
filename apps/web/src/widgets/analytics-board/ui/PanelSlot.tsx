"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useLingui } from "@lingui/react/macro";
import { tv } from "@vis-a-lot/shared/lib/tw";
import { GripVertical, Maximize2, Minimize2, X } from "lucide-react";
import { memo, type ReactNode, useMemo } from "react";
import type { DropEdge } from "@/entities/workspace/lib/layout-tree";
import {
  type RenderPanel,
  useBoard,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import {
  selectIsActive,
  selectIsMaximized,
  selectLinkPeer,
  selectPanelNumber,
} from "@/entities/workspace/model/board-store";
import {
  type ArrangeBlock,
  blockedReason,
  layoutBlock,
  removePanelBlock,
  removePanelWithConfirm,
} from "@/features/arrange-panels/model/arrange";
import { itemButton } from "@/shared/ui/button";
import "../config/messages";

/** 놓을 변: 대상 칸의 그쪽 절반을 반투명으로 칠한다. */
const edgeBand = tv({
  base: "absolute rounded-md border-2 border-accent bg-accent/20",
  variants: {
    edge: {
      top: "inset-x-0 top-0 h-1/2",
      bottom: "inset-x-0 bottom-0 h-1/2",
      left: "inset-y-0 left-0 w-1/2",
      right: "inset-y-0 right-0 w-1/2",
    },
  },
});

/** 끌어 놓을 대상 영역. 칸 내용의 조작을 막지 않게 포인터는 통과시킨다 (자리는 dnd-kit이 잰다). */
function DropZone({
  panelId,
  edge,
  disabled,
}: {
  panelId: string;
  edge: DropEdge | undefined;
  disabled: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: panelId, disabled });
  return (
    <div
      ref={setNodeRef}
      className="z-overlay pointer-events-none absolute inset-0"
    >
      {edge && <span className={edgeBand({ edge })} />}
    </div>
  );
}

/** 칸을 끌어 옮기는 손잡이. Space·Enter로 집고 화살표로 대상 칸과 변을 고른 뒤 Space·Enter로 놓는다. */
function DragHandle({
  panelId,
  number,
  block,
}: {
  panelId: string;
  number: number;
  /** 옮기기가 막힌 까닭 (그리는 칸이 있다) */
  block: ArrangeBlock | undefined;
}) {
  const { t } = useLingui();
  const disabled = block !== undefined;
  const { setNodeRef, attributes, listeners } = useDraggable({
    id: panelId,
    disabled,
    attributes: { roleDescription: t`옮길 수 있는 칸` },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-disabled={disabled || undefined}
      aria-label={t`칸 ${number} 옮기기`}
      title={block ? blockedReason(block) : t`끌어서 칸을 옮깁니다`}
      className={itemButton({
        className:
          "cursor-grab touch-none aria-disabled:cursor-not-allowed aria-disabled:opacity-35",
      })}
      data-drag-handle=""
    >
      <GripVertical size={13} aria-hidden="true" />
    </button>
  );
}

export type PanelSlotProps = {
  panelId: string;
  renderPanel: RenderPanel;
  /** 이름표에서 번호 뒤에 붙일 것 (차트 · 데이터셋). 없으면 번호만 */
  renderLabel?: RenderPanel;
  /** 이름표 뒤의 칸 연결 버튼. 없으면 두지 않는다 */
  renderLink?: RenderPanel;
  /** 끄는 칸이 이 칸 위에 있을 때 놓을 변 */
  dropEdge?: DropEdge;
  /** 이 칸을 끄는 중 */
  dragging: boolean;
  /** 레이아웃 트리로 놓는 넓은 화면. 좁으면(한 줄 쌓기) 최대화를 숨긴다. */
  wide: boolean;
  /** 끌어 옮길 수 있는지 (넓은 화면이고 최대화한 칸이 없다). 아니면 손잡이를 숨긴다. */
  movable: boolean;
};

/**
 * 칸 틀 하나 (보드 목록의 아이템). 부모는 칸 id만 넘기고 이 칸의 번호·활성·최대화·막힘은 여기서 고른다.
 * 칸 내용(renderPanel 결과)은 칸 id로 한 번 만들어 두어, 활성 표시나 번호가 바뀌어도 내용은 다시 그리지 않는다.
 */
export const PanelSlot = memo(function PanelSlot({
  panelId,
  renderPanel,
  renderLabel,
  renderLink,
  dropEdge,
  dragging,
  wide,
  movable,
}: PanelSlotProps) {
  const board = useBoardStore();
  const number = useBoard(selectPanelNumber(panelId));
  const active = useBoard(selectIsActive(panelId));
  const maximized = useBoard(selectIsMaximized(panelId));
  const linkPeer = useBoard(selectLinkPeer(panelId));
  const moveBlock = useBoard(layoutBlock);
  const removeBlock = useBoard(removePanelBlock);
  const activate = useBoard((s) => s.activate);
  const setMaximized = useBoard((s) => s.setMaximized);

  const content = useMemo(() => renderPanel(panelId), [renderPanel, panelId]);
  const label = useMemo(() => renderLabel?.(panelId), [renderLabel, panelId]);
  const link = useMemo(() => renderLink?.(panelId), [renderLink, panelId]);

  return (
    <PanelFrame
      number={number}
      active={active}
      maximized={maximized}
      linkPeer={linkPeer}
      dragging={dragging}
      wide={wide}
      label={label}
      link={link}
      removeBlock={removeBlock}
      onActivate={() => activate(panelId)}
      onToggleMaximize={() => setMaximized(maximized ? null : panelId)}
      onRemove={() => void removePanelWithConfirm(board, panelId)}
      handle={
        movable && (
          <DragHandle panelId={panelId} number={number} block={moveBlock} />
        )
      }
      dropZone={
        movable && (
          <DropZone
            panelId={panelId}
            edge={dropEdge}
            disabled={moveBlock !== undefined}
          />
        )
      }
    >
      {content}
    </PanelFrame>
  );
});

/** 버튼·입력·칸 안 그리기 레이어의 더블 클릭은 그쪽 조작이다. */
const OWN_DOUBLE_CLICK =
  "button, input, select, textarea, a, [role='application'], [role='separator']";

/** 칸 틀의 모양 (표현). 값과 콜백은 PanelSlot이 넘긴다. */
function PanelFrame({
  number,
  active,
  maximized,
  linkPeer,
  dragging,
  wide,
  label,
  link,
  removeBlock,
  onActivate,
  onToggleMaximize,
  onRemove,
  handle,
  dropZone,
  children,
}: {
  number: number;
  active: boolean;
  maximized: boolean;
  /** 연결 버튼에 커서를 올린 칸과 연결된 칸 (테두리 강조) */
  linkPeer: boolean;
  dragging: boolean;
  wide: boolean;
  label: ReactNode;
  link: ReactNode;
  removeBlock: ArrangeBlock | undefined;
  onActivate: () => void;
  onToggleMaximize: () => void;
  onRemove: () => void;
  handle: ReactNode;
  dropZone: ReactNode;
  children: ReactNode;
}) {
  const { t } = useLingui();
  return (
    <section
      aria-label={t`칸 ${number}`}
      aria-current={active || undefined}
      data-dragging={dragging || undefined}
      data-link-peer={linkPeer || undefined}
      className="group/panel relative flex size-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface data-dragging:opacity-50 data-link-peer:ring-2 data-link-peer:ring-accent aria-current:border-accent aria-current:shadow-card"
      onPointerDown={onActivate}
      onFocus={onActivate}
      onDoubleClick={(e) => {
        if (!wide) return;
        if ((e.target as Element).closest(OWN_DOUBLE_CLICK)) return;
        onToggleMaximize();
      }}
    >
      <div className="relative min-h-0 flex-1">{children}</div>
      {/* 칸 왼쪽 위의 틀 도구. 커서를 올리거나 포커스가 들어오면 보이고, 커서 없는 기기에서는 늘 보인다. */}
      <div className="z-item-toolbar absolute top-1 left-1 flex max-w-[calc(100%-0.5rem)] min-w-0 items-center gap-0.5 rounded-md border border-line bg-elevated p-0.5 opacity-0 shadow-xs transition-opacity group-focus-within/panel:opacity-100 group-hover/panel:opacity-100 hover-none:opacity-100">
        {handle}
        <span className="flex min-w-0 items-center gap-1 px-1 text-2xs whitespace-nowrap text-fg-secondary">
          <span className="font-semibold text-fg tabular-nums">
            {t`칸 ${number}`}
          </span>
          {label && <span className="min-w-0 truncate">{label}</span>}
        </span>
        {link}
        {wide && (
          <button
            type="button"
            className={itemButton()}
            aria-pressed={maximized}
            aria-label={maximized ? t`칸 되돌리기` : t`칸 최대화`}
            title={maximized ? t`보드로 되돌리기 (Esc)` : t`칸 최대화`}
            onClick={onToggleMaximize}
          >
            {maximized ? (
              <Minimize2 size={13} aria-hidden="true" />
            ) : (
              <Maximize2 size={13} aria-hidden="true" />
            )}
          </button>
        )}
        <button
          type="button"
          className={itemButton()}
          disabled={removeBlock !== undefined}
          aria-label={t`칸 ${number} 지우기`}
          title={removeBlock ? blockedReason(removeBlock) : t`칸 지우기`}
          onClick={onRemove}
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>
      {dropZone}
    </section>
  );
}
