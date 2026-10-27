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
import { tv } from "@/shared/lib/tw";
import { showAlert } from "@/shared/ui/AlertDialog";

const drawLayer = tv({
  base: "relative cursor-crosshair touch-none select-none",
  variants: {
    tool: {
      text: "cursor-text",
      pan: "cursor-grab active:cursor-grabbing",
    },
  },
});

// 선택·삭제·확대 영역의 점선 사각형(또는 올가미). 선택 중인 영역은 반투명 바탕으로 칠해 고르는 곳을 보인다.
const selectRegion =
  "fill-accent/15 stroke-[1.5] stroke-accent [stroke-dasharray:4_3]";
// 선택하는 동안 그림 영역에서 고르는 곳 밖을 PNG 바탕색(chart-paper, 테마를 따른다)으로 덮는다. 다 그린 PNG의 선택 밖 모습(dimOutside)을 미리 보여준다.
const selectOutside = "fill-chart-paper/70 stroke-none";
const deleteRegion =
  "fill-danger/10 stroke-[1.5] stroke-danger [stroke-dasharray:4_3]";
const zoomRect = "fill-accent/12 stroke-1 stroke-accent";

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

/** 두 꼭짓점으로 정한 사각형의 SVG path */
function rectPath(a: Point, b: Point) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return `M${x} ${y}h${Math.abs(b.x - a.x)}v${Math.abs(b.y - a.y)}h${-Math.abs(b.x - a.x)}Z`;
}

/** 자유형 점들을 이어 닫은 SVG path */
function polygonPath(points: readonly Point[]) {
  return `M${points.map((p) => `${p.x} ${p.y}`).join("L")}Z`;
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

  /** 좌표를 바꿀 metadata. 받지 못하면(지운 데이터 등) 알리고 undefined를 준다. */
  const getMeta = async (): Promise<ItemMeta | undefined> => {
    if (meta.data) return meta.data;
    try {
      return await client.fetchQuery(itemMetaQuery(image.url));
    } catch (err) {
      showAlert(
        `차트 정보를 읽지 못했습니다: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  };

  // 선택하는 동안 고르는 영역(PNG 좌표 path). 그림 영역에서 이 밖을 덮는다.
  const selecting =
    draft?.kind === "drag" && tool === "rectSelect"
      ? rectPath(draft.from, draft.to)
      : draft?.kind === "freehand" && tool === "lassoSelect"
        ? polygonPath(draft.points)
        : undefined;
  const plot = meta.data?.plot ?? {
    left: 0,
    top: 0,
    width: image.width,
    height: image.height,
  };

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
    if (!m) return;
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
    const m = await getMeta();
    if (!m) return;
    const [x, y] = pxToData(m, at);
    onAction({ type: "addShape", shape: { type: "text", x, y, text: value } });
  };

  return (
    <div
      ref={ref}
      className={drawLayer({
        tool: tool === "text" || tool === "pan" ? tool : undefined,
      })}
      style={{ width: display.width, height: display.height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="application"
      aria-label={`${alt} 위에 ${TOOL_LABELS[tool]}`}
    >
      {/* 이동하는 동안 그림은 그대로 두고 커서(grab)만 바꾼다. 놓으면 서버가 옮긴 범위로 다시 그린다. */}
      {/* resize 대기 중에는 기존 PNG를 칸 크기에 맞게 늘리거나 줄여 보여준다. */}
      <ChartImage
        data={image}
        alt={alt}
        className="pointer-events-none size-full"
      />
      {overlay}
      <svg
        className="pointer-events-none absolute inset-0 size-full fill-chart-ink-soft stroke-chart-ink stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
        viewBox={`0 0 ${image.width} ${image.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {selecting && (
          <path
            className={selectOutside}
            fillRule="evenodd"
            d={`${rectPath(
              { x: plot.left, y: plot.top },
              { x: plot.left + plot.width, y: plot.top + plot.height },
            )} ${selecting}`}
          />
        )}
        {draft?.kind === "drag" && tool === "line" && (
          <line
            className="fill-none"
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
                ? zoomRect
                : tool === "rectSelect"
                  ? selectRegion
                  : tool === "rectDelete"
                    ? deleteRegion
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
              className={tool === "lassoSelect" ? selectRegion : deleteRegion}
              points={draft.points.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          ) : (
            <polyline
              className="fill-none"
              points={draft.points.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          ))}
      </svg>
      {draft?.kind === "text" && (
        <input
          className="absolute w-40 -translate-y-1/2 rounded-sm border border-accent bg-elevated px-1.5 py-1 text-xs"
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
            // 실패는 getMeta가 알린다.
            if (e.key === "Enter") void submitText();
            if (e.key === "Escape") setDraft(undefined);
          }}
          onBlur={() => setDraft(undefined)}
        />
      )}
    </div>
  );
}
