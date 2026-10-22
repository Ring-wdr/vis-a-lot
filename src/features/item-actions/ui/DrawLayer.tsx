"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  clampToPlot,
  eventToPng,
  type Point,
  pxToData,
} from "@/entities/chart/lib/coords";
import { ChartImage } from "@/entities/chart/ui/ChartImage";
import type { Mode } from "@/entities/workspace/model/workspace-store";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import { itemMetaQuery, useItemMeta } from "@/shared/api/queries";
import type {
  ChartImage as ChartImageData,
  ItemMeta,
} from "@/shared/api/types";
import styles from "@/shared/ui/workspace.module.css";

type DrawMode = Exclude<Mode, "normal">;

type Draft =
  | { kind: "drag"; from: Point; to: Point }
  | { kind: "freehand"; points: Point[] }
  | { kind: "text"; at: Point };

const MIN_DRAG_PX = 4;
const FREEHAND_STEP_PX = 2;

/**
 * 확대와 도형 그리기 레이어. 그리는 동안에는 화면에서 임시 미리보기만 보여주고,
 * 손을 떼면 데이터 좌표로 바꿔 서버에 보낸다. 서버가 PNG에 다시 그려 준다.
 */
export function DrawLayer({
  mode,
  image,
  display,
  alt,
  onAction,
}: {
  mode: DrawMode;
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
    return meta.data ? clampToPlot(meta.data, p) : p;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || draft?.kind === "text") return;
    const p = toPoint(e);
    if (mode === "text") {
      // 이어지는 mousedown이 포커스를 옮겨 방금 띄운 입력창을 닫지 않게 한다.
      e.preventDefault();
      setText("");
      setDraft({ kind: "text", at: p });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft(
      mode === "freehand"
        ? { kind: "freehand", points: [p] }
        : { kind: "drag", from: p, to: p },
    );
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draft || draft.kind === "text") return;
    const p = toPoint(e);
    if (draft.kind === "drag") {
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
    if (
      Math.abs(to.x - from.x) < MIN_DRAG_PX &&
      Math.abs(to.y - from.y) < MIN_DRAG_PX
    )
      return;
    const [x0, y0] = pxToData(m, from);
    const [x1, y1] = pxToData(m, to);
    if (mode === "zoom") {
      onAction({
        type: "view",
        body: { type: "zoomIn", x: [x0, x1], y: [y0, y1] },
      });
    } else if (mode === "rect" || mode === "line") {
      onAction({ type: "addShape", shape: { type: mode, x0, y0, x1, y1 } });
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
      data-mode={mode}
      style={{ width: display.width, height: display.height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="application"
      aria-label={`${alt} 위에 ${mode === "zoom" ? "확대 영역 선택" : "도형 그리기"}`}
    >
      <ChartImage data={image} alt={alt} />
      <svg
        className={styles.drawPreview}
        viewBox={`0 0 ${image.width} ${image.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {draft?.kind === "drag" && mode === "line" && (
          <line
            x1={draft.from.x}
            y1={draft.from.y}
            x2={draft.to.x}
            y2={draft.to.y}
          />
        )}
        {draft?.kind === "drag" && mode !== "line" && (
          <rect
            className={mode === "zoom" ? styles.zoomRect : undefined}
            x={Math.min(draft.from.x, draft.to.x)}
            y={Math.min(draft.from.y, draft.to.y)}
            width={Math.abs(draft.to.x - draft.from.x)}
            height={Math.abs(draft.to.y - draft.from.y)}
          />
        )}
        {draft?.kind === "freehand" && (
          <polyline
            points={draft.points.map((p) => `${p.x},${p.y}`).join(" ")}
          />
        )}
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
