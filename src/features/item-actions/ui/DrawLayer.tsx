"use client";

import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useRef, useState } from "react";
import {
  clampToPlot,
  eventToPng,
  type Point,
  pxToData,
} from "@/entities/chart/lib/coords";
import { ChartImage } from "@/entities/chart/ui/ChartImage";
import type { PaintTool } from "@/entities/workspace/model/workspace-store";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import { itemMetaQuery, useItemMeta } from "@/shared/api/queries";
import type {
  ChartImage as ChartImageData,
  ItemMeta,
} from "@/shared/api/types";
import styles from "@/shared/ui/workspace.module.css";

/** 이동, 확대 영역 선택, 영역 선택 또는 페인트 도구 */
export type DrawTool =
  | "pan"
  | "zoom"
  | "rectSelect"
  | "lassoSelect"
  | "rectDelete"
  | "lassoDelete"
  | PaintTool;

type Draft =
  | { kind: "drag"; from: Point; to: Point }
  | { kind: "pan"; from: Point; to: Point }
  | { kind: "freehand"; points: Point[] }
  | { kind: "text"; at: Point };

const TOOL_LABELS: Record<DrawTool, string> = {
  pan: "이동",
  zoom: "확대 영역 선택",
  rectSelect: "사각형으로 선택",
  lassoSelect: "자유형으로 선택",
  rectDelete: "사각형으로 지우기",
  lassoDelete: "자유형으로 지우기",
  rect: "도형 그리기",
  line: "도형 그리기",
  freehand: "도형 그리기",
  text: "도형 그리기",
};

const MIN_DRAG_PX = 4;
const FREEHAND_STEP_PX = 2;
/** 서버가 받는 자유형 영역의 꼭짓점 수 상한 */
const MAX_LASSO_POINTS = 2000;

/** 꼭짓점이 많으면 고르게 솎아 상한 안으로 줄인다. */
function thin<T>(points: T[], max: number) {
  if (points.length <= max) return points;
  const step = points.length / max;
  return Array.from({ length: max }, (_, i) => points[Math.floor(i * step)]);
}

/** 드래그가 거의 움직이지 않았는지 (클릭) */
function isClick(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return (
    Math.max(...xs) - Math.min(...xs) < MIN_DRAG_PX &&
    Math.max(...ys) - Math.min(...ys) < MIN_DRAG_PX
  );
}

/**
 * 확대와 도형 그리기 레이어. 그리는 동안에는 화면에서 임시 미리보기만 보여주고,
 * 손을 떼면 데이터 좌표로 바꿔 서버에 보낸다. 서버가 PNG에 다시 그려 준다.
 */
export function DrawLayer({
  tool,
  image,
  display,
  alt,
  hasSelection = false,
  overlay,
  onAction,
}: {
  /** PNG 위에 겹칠 조작 (legend 체크박스) */
  overlay?: ReactNode;
  tool: DrawTool;
  /** 선택 영역이 있으면 선택 모드에서 클릭만 해도 선택을 푼다. */
  hasSelection?: boolean;
  image: ChartImageData;
  /** 화면에 보이는 크기. resize 대기 중에는 PNG 크기와 다를 수 있다. */
  display: { width: number; height: number };
  alt: string;
  onAction: (action: ItemAction) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  // 그리기 모드에서는 metadata를 미리 받아 둔다 (좌표 변환에 필요).
  const meta = useItemMeta(image.url, true);
  const [draft, setDraft] = useState<Draft>();
  const [text, setText] = useState("");

  const getMeta = (): Promise<ItemMeta> =>
    meta.data
      ? Promise.resolve(meta.data)
      : client.fetchQuery(itemMetaQuery(image.url));

  const toPoint = (e: React.PointerEvent) => {
    const p = eventToPng(e, e.currentTarget, image);
    // 이동은 그림 영역 밖까지 끌어도 끈 만큼 옮긴다.
    return meta.data && tool !== "pan" ? clampToPlot(meta.data, p) : p;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || draft?.kind === "text") return;
    const p = toPoint(e);
    if (tool === "text") {
      // 이어지는 mousedown이 포커스를 옮겨 방금 띄운 입력창을 닫지 않게 한다.
      e.preventDefault();
      setText("");
      setDraft({ kind: "text", at: p });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft(
      tool === "freehand" || tool === "lassoSelect" || tool === "lassoDelete"
        ? { kind: "freehand", points: [p] }
        : { kind: tool === "pan" ? "pan" : "drag", from: p, to: p },
    );
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draft || draft.kind === "text") return;
    const p = toPoint(e);
    if (draft.kind === "drag" || draft.kind === "pan") {
      setDraft({ ...draft, to: p });
    } else {
      const last = draft.points[draft.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= FREEHAND_STEP_PX) {
        setDraft({ kind: "freehand", points: [...draft.points, p] });
      }
    }
  };

  const onPointerUp = async () => {
    if (!draft || draft.kind === "text") return;
    const finished = draft;
    setDraft(undefined);
    const m = await getMeta();
    const clearSelection = () => {
      if (hasSelection) onAction({ type: "select", region: null });
    };
    if (
      finished.kind === "freehand" &&
      (tool === "lassoSelect" || tool === "lassoDelete")
    ) {
      const click = finished.points.length < 3 || isClick(finished.points);
      if (click) return tool === "lassoSelect" ? clearSelection() : undefined;
      const region = {
        type: "lasso" as const,
        points: thin(finished.points, MAX_LASSO_POINTS).map((p) =>
          pxToData(m, p),
        ),
      };
      onAction(
        tool === "lassoSelect"
          ? { type: "select", region }
          : { type: "deleteRegion", region },
      );
      return;
    }
    if (finished.kind === "freehand") {
      if (finished.points.length < 2) return;
      onAction({
        type: "addShape",
        shape: {
          type: "freehand",
          points: finished.points.map((p) => pxToData(m, p)),
        },
      });
      return;
    }
    const { from, to } = finished;
    if (isClick([from, to])) {
      if (tool === "rectSelect") clearSelection();
      return;
    }
    const [x0, y0] = pxToData(m, from);
    const [x1, y1] = pxToData(m, to);
    if (finished.kind === "pan") {
      // 끈 방향으로 그림이 따라오도록 보이는 범위는 반대로 옮긴다.
      onAction({
        type: "view",
        body: { type: "pan", dx: x0 - x1, dy: y0 - y1 },
      });
    } else if (tool === "zoom") {
      onAction({
        type: "view",
        body: { type: "zoomIn", x: [x0, x1], y: [y0, y1] },
      });
    } else if (tool === "rectSelect") {
      onAction({ type: "select", region: { type: "rect", x0, y0, x1, y1 } });
    } else if (tool === "rectDelete") {
      onAction({
        type: "deleteRegion",
        region: { type: "rect", x0, y0, x1, y1 },
      });
    } else if (tool === "rect" || tool === "line") {
      onAction({ type: "addShape", shape: { type: tool, x0, y0, x1, y1 } });
    }
  };

  const submitText = async () => {
    if (draft?.kind !== "text") return;
    const value = text.trim();
    const at = draft.at;
    setDraft(undefined);
    if (!value) return;
    const [x, y] = pxToData(await getMeta(), at);
    onAction({ type: "addShape", shape: { type: "text", x, y, text: value } });
  };

  return (
    <div
      ref={ref}
      className={styles.drawLayer}
      data-tool={tool}
      style={{ width: display.width, height: display.height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="application"
      aria-label={`${alt} 위에 ${TOOL_LABELS[tool]}`}
    >
      {/* 이동하는 동안에는 PNG를 끈 만큼 옮겨 보여주고, 놓으면 서버가 옮긴 범위로 다시 그린다. */}
      <div
        className={styles.drawImage}
        style={
          draft?.kind === "pan"
            ? {
                transform: `translate(${((draft.to.x - draft.from.x) * display.width) / image.width}px, ${((draft.to.y - draft.from.y) * display.height) / image.height}px)`,
              }
            : undefined
        }
      >
        <ChartImage data={image} alt={alt} />
      </div>
      {overlay}
      <svg
        className={styles.drawPreview}
        viewBox={`0 0 ${image.width} ${image.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {draft?.kind === "drag" && tool === "line" && (
          <line
            x1={draft.from.x}
            y1={draft.from.y}
            x2={draft.to.x}
            y2={draft.to.y}
          />
        )}
        {draft?.kind === "drag" && tool !== "line" && (
          <rect
            className={
              tool === "zoom"
                ? styles.zoomRect
                : tool === "rectSelect"
                  ? styles.selectRegion
                  : tool === "rectDelete"
                    ? styles.deleteRegion
                    : undefined
            }
            x={Math.min(draft.from.x, draft.to.x)}
            y={Math.min(draft.from.y, draft.to.y)}
            width={Math.abs(draft.to.x - draft.from.x)}
            height={Math.abs(draft.to.y - draft.from.y)}
          />
        )}
        {draft?.kind === "freehand" &&
          (tool === "lassoSelect" || tool === "lassoDelete" ? (
            <polygon
              className={
                tool === "lassoSelect"
                  ? styles.selectRegion
                  : styles.deleteRegion
              }
              points={draft.points.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          ) : (
            <polyline
              points={draft.points.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          ))}
      </svg>
      {draft?.kind === "text" && (
        <input
          className={styles.textInput}
          style={{
            left: (draft.at.x * display.width) / image.width,
            top: (draft.at.y * display.height) / image.height,
          }}
          // biome-ignore lint/a11y/noAutofocus: 클릭한 자리에 바로 글을 쓰는 입력이다.
          autoFocus
          value={text}
          maxLength={200}
          placeholder="메모 입력 후 Enter"
          onChange={(e) => setText(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitText();
            if (e.key === "Escape") setDraft(undefined);
          }}
          onBlur={() => setDraft(undefined)}
        />
      )}
    </div>
  );
}
