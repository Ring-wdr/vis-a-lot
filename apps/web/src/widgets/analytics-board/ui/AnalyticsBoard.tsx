"use client";

// analytics 보드: 레이아웃 트리대로 칸을 놓고, 칸 틀(손잡이·이름표·최대화·닫기)과 경계 손잡이를 그린다.
// 칸 안의 내용은 view가 넘긴 renderPanel로 그린다 (이 위젯은 칸의 차트를 모른다).
// 칸은 트리 모양과 상관없이 칸 번호 순 한 목록으로 그리고, 트리에서 구한 자리(보드에 대한 %)에 놓는다.
// 그래서 옮기거나 칸을 더하거나 preset을 바꿔도 칸 내용을 다시 마운트하지 않는다.

import {
  type Announcements,
  type Collision,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { select } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { cn } from "@vis-a-lot/shared/lib/tw";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type DropEdge,
  movePanel as movedLayout,
  setSplitRatios,
} from "@/entities/workspace/lib/layout-tree";
import {
  type RenderPanel,
  useBoard,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import {
  blockedReason,
  layoutBlock,
} from "@/features/arrange-panels/model/arrange";
import "../config/messages";
import {
  type DropCollisionData,
  dropCollision,
  keyboardDrop,
} from "../lib/drop-target";
import {
  type BoardRects,
  boardRects,
  boxStyle,
  type Divider,
  dividerStyle,
  FULL_BOX,
} from "../lib/layout-rects";
import { useWideBoard } from "../lib/use-wide-board";
import { DropPreview } from "./DropPreview";
import { PanelSlot } from "./PanelSlot";
import { ResizeHandle } from "./ResizeHandle";

export type AnalyticsBoardProps = {
  /** 칸 안의 내용. 칸 id만 받는다. 참조가 바뀌면 모든 칸을 다시 그리므로 고정해서 넘긴다. */
  renderPanel: RenderPanel;
  /** 칸 이름표의 번호 뒤에 붙일 것 (차트 · 데이터셋 이름). 고정해서 넘긴다. */
  renderLabel?: RenderPanel;
  /** 칸 이름표 뒤의 연결 버튼. 고정해서 넘긴다. */
  renderLink?: RenderPanel;
  className?: string;
};

/** 끄는 칸과 놓을 자리 */
type DragState = { activeId: string; targetId?: string; edge?: DropEdge };

const dropOf = (collisions: Collision[] | null) => {
  const hit = collisions?.[0];
  const edge = (hit?.data as DropCollisionData | undefined)?.edge;
  return hit && edge ? { targetId: String(hit.id), edge } : undefined;
};

/** 다른 팝업(대화 상자·메뉴·popover)의 Esc는 그쪽 닫기다. */
const OWN_ESCAPE =
  "dialog, [role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox'], [popover]";

/**
 * 보드 위젯. 레이아웃 트리·칸 id 목록·최대화·잠금만 구독한다. 칸의 번호·활성 표시는 칸(PanelSlot)이 고르고,
 * 칸의 draft·진행률이 바뀌어도 보드는 다시 그리지 않는다. 경계를 끄는 동안에는 DOM의 칸 자리만 바꾼다.
 * 48rem보다 좁으면 트리를 쓰지 않고 칸을 번호 순으로 한 줄로 쌓는다 (저장된 트리는 그대로다).
 */
export function AnalyticsBoard({
  renderPanel,
  renderLabel,
  renderLink,
  className,
}: AnalyticsBoardProps) {
  const { t } = useLingui();
  const board = useBoardStore();
  const layout = useBoard((s) => s.layout);
  const panelIds = useBoard((s) => s.panelIds);
  const maximizedId = useBoard((s) => s.maximizedPanelId);
  const block = useBoard(layoutBlock);
  const movePanel = useBoard((s) => s.movePanel);
  const resizeSplit = useBoard((s) => s.resizeSplit);
  const setMaximized = useBoard((s) => s.setMaximized);
  const wide = useWideBoard();
  // 좁은 화면은 칸을 쌓아 모두 보이므로 최대화를 쓰지 않는다.
  const maximized = wide ? maximizedId : null;
  const movable = wide && maximized === null;

  const rects = useMemo(() => boardRects(layout), [layout]);
  const [drag, setDrag] = useState<DragState | null>(null);
  // 안내 문구가 읽는 마지막 놓을 자리 (끄는 동안 바뀌어도 다시 그리지 않는다).
  const dropRef = useRef<DragState | null>(null);
  const cellEls = useRef(new Map<string, HTMLElement>());
  const dividerEls = useRef(new Map<string, HTMLElement>());

  /** 칸·경계 자리를 DOM에 바로 쓴다 (경계를 끄는 동안). React가 다음에 그릴 때 같은 값을 쓴다. */
  const writeRects = (next: BoardRects) => {
    for (const [id, box] of next.cells) {
      const el = cellEls.current.get(id);
      if (el) Object.assign(el.style, boxStyle(box));
    }
    for (const d of next.dividers) {
      const el = dividerEls.current.get(d.key);
      if (el) Object.assign(el.style, dividerStyle(d));
    }
  };

  const previewResize = (d: Divider, ratios: readonly number[] | null) =>
    writeRects(
      ratios ? boardRects(setSplitRatios(layout, d.path, ratios)) : rects,
    );

  const commitResize = (d: Divider, ratios: readonly number[]) => {
    const before = board.getState().layout;
    resizeSplit(d.path, ratios);
    // store가 받지 않았으면(그사이 잠김) DOM을 원래 자리로 돌린다.
    if (board.getState().layout === before) writeRects(rects);
  };

  useEffect(() => {
    if (!maximized) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.target instanceof Element && e.target.closest(OWN_ESCAPE)) return;
      setMaximized(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [maximized, setMaximized]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardDrop }),
  );

  const numberOf = (id: string) => board.getState().panelIds.indexOf(id) + 1;
  const dropText = (drop: DragState | null) => {
    if (!drop?.targetId || !drop.edge) return t`놓을 칸이 없습니다.`;
    const target = numberOf(drop.targetId);
    const edge = drop.edge;
    return t`칸 ${target}의 ${select(edge, { top: "위", bottom: "아래", left: "왼쪽", right: "오른쪽", other: "옆" })}에 놓습니다.`;
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const n = numberOf(String(active.id));
      return t`칸 ${n}의 손잡이를 잡았습니다. 화살표로 놓을 칸과 변을 고르고 Space나 Enter로 놓습니다. Esc는 취소입니다.`;
    },
    onDragMove: () => dropText(dropRef.current),
    onDragOver: () => dropText(dropRef.current),
    onDragEnd: () => {
      const drop = dropRef.current;
      if (!drop?.targetId || !drop.edge)
        return t`놓을 칸이 없어 그대로 둡니다.`;
      const target = numberOf(drop.targetId);
      const edge = drop.edge;
      return t`칸 ${target}의 ${select(edge, { top: "위", bottom: "아래", left: "왼쪽", right: "오른쪽", other: "옆" })}에 놓았습니다.`;
    },
    onDragCancel: () => t`옮기기를 취소했습니다.`,
  };

  const track = ({ active, collisions }: DragMoveEvent) => {
    const activeId = String(active.id);
    const drop = dropOf(collisions);
    const next: DragState = { activeId, ...drop };
    dropRef.current = next;
    setDrag((prev) =>
      prev?.activeId === activeId &&
      prev.targetId === next.targetId &&
      prev.edge === next.edge
        ? prev
        : next,
    );
  };

  const onDragEnd = ({ active, collisions }: DragEndEvent) => {
    setDrag(null);
    const drop = dropOf(collisions);
    dropRef.current = { activeId: String(active.id), ...drop };
    if (drop) movePanel(String(active.id), drop.targetId, drop.edge);
  };

  const preview =
    drag?.targetId && drag.edge
      ? movedLayout(layout, drag.activeId, drag.targetId, drag.edge)
      : null;
  const lockedReason = block && blockedReason(block);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dropCollision}
      onDragStart={({ active }) => {
        dropRef.current = { activeId: String(active.id) };
        setDrag({ activeId: String(active.id) });
      }}
      onDragMove={track}
      onDragOver={track}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDrag(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: t`Space나 Enter로 칸을 집고, 화살표로 놓을 칸과 변을 고른 뒤 Space나 Enter로 놓습니다. Esc는 취소입니다.`,
        },
      }}
    >
      <div
        className={cn("relative size-full min-h-0 min-w-0", className)}
        data-wide={wide || undefined}
      >
        {/* 넓으면 칸을 자리(%)에 놓는 판, 좁으면 세로 스크롤 목록. 같은 요소라 폭이 바뀌어도 칸을 다시 마운트하지 않는다. */}
        <div
          className={
            wide
              ? "absolute inset-1"
              : "flex size-full flex-col gap-2 overflow-y-auto p-2"
          }
        >
          {panelIds.map((id) => {
            const box = id === maximized ? FULL_BOX : rects.cells.get(id);
            const hidden = maximized !== null && id !== maximized;
            return (
              <div
                key={id}
                ref={(el) => {
                  if (el) cellEls.current.set(id, el);
                  return () => {
                    cellEls.current.delete(id);
                  };
                }}
                data-panel-id={id}
                // 최대화한 동안 다른 칸은 자리·크기를 그대로 두고 감추기만 한다 (크기가 바뀌지 않아 다시 그리지 않는다).
                inert={hidden || undefined}
                className={cn(
                  wide
                    ? "absolute p-1"
                    : "relative aspect-4/3 w-full flex-none",
                  hidden && "invisible",
                  id === maximized && "z-raised",
                )}
                style={wide && box ? boxStyle(box) : undefined}
              >
                <PanelSlot
                  panelId={id}
                  renderPanel={renderPanel}
                  renderLabel={renderLabel}
                  renderLink={renderLink}
                  dropEdge={drag?.targetId === id ? drag.edge : undefined}
                  dragging={drag?.activeId === id}
                  wide={wide}
                  movable={movable}
                />
              </div>
            );
          })}
          {movable &&
            rects.dividers.map((d) => (
              <ResizeHandle
                key={d.key}
                ref={(el) => {
                  if (el) dividerEls.current.set(d.key, el);
                  return () => {
                    dividerEls.current.delete(d.key);
                  };
                }}
                divider={d}
                disabledReason={lockedReason}
                onPreview={previewResize}
                onCommit={commitResize}
              />
            ))}
          {movable && drag && preview && (
            <DropPreview layout={preview} movedId={drag.activeId} />
          )}
        </div>
      </div>
    </DndContext>
  );
}
