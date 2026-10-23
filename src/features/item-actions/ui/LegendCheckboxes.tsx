"use client";

import { supports } from "@/entities/chart/model/chart-kinds";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import { useItemMeta } from "@/shared/api/queries";
import type { ChartImage } from "@/shared/api/types";

/**
 * PNG legend 항목의 색 표시(●) 자리에 체크박스를 겹친다. 위치는 metadata에서 읽는다.
 * 체크를 풀면 그 item에서 그 값을 숨기고 다시 그린다. 상단 도구 줄의 '체크박스 표시'로 켜고 끈다.
 */
export function LegendCheckboxes({
  image,
  display,
  alt,
  disabled,
  onAction,
}: {
  image: ChartImage;
  display: { width: number; height: number };
  alt: string;
  disabled: boolean;
  onAction: (action: ItemAction) => void;
}) {
  // 체크박스 표시를 지원하지 않는 차트(heatmap 등)는 켜 둔 채로 바꿔 그려도 띄우지 않는다.
  const shown = useWorkspace(
    (s) => s.showLegendCheckboxes && supports(s.current?.spec, "checkbox"),
  );
  const meta = useItemMeta(image.url, shown);
  const legend = meta.data?.legend;
  if (!shown || !legend) return null;
  const sx = display.width / image.width;
  const sy = display.height / image.height;

  return (
    // legend 체크박스: 색 표시(●) 가운데에 겹친다. 색 버튼보다 위에 둔다.
    <div className="pointer-events-none absolute inset-0 z-1">
      {legend.entries.map((entry) => (
        <input
          key={entry.value}
          type="checkbox"
          className="pointer-events-auto absolute m-0 size-3 -translate-1/2 cursor-pointer accent-accent"
          style={{ left: entry.marker.x * sx, top: entry.marker.y * sy }}
          aria-label={`${alt} · ${entry.value} 보이기`}
          checked={entry.visible}
          disabled={disabled}
          // 확대·그리기 레이어가 누름을 드래그로 받지 않게 한다.
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) =>
            onAction({
              type: "legendVisible",
              value: entry.value,
              visible: e.currentTarget.checked,
            })
          }
        />
      ))}
    </div>
  );
}
