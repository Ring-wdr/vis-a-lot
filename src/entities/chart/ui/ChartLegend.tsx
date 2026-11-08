import { useLingui } from "@lingui/react/macro";
import type { ChartImage, LegendMeta } from "@/shared/api/types";
import "../config/messages";

type Layout = NonNullable<LegendMeta["layout"]>;
type Entry = LegendMeta["entries"][number];

const text =
  "absolute -translate-y-1/2 truncate whitespace-nowrap leading-none";

/** 색 표시(●). 끈 값은 속이 빈 테두리만 그린다 (PNG와 같은 모양). */
function Marker({ entry, layout }: { entry: Entry; layout: Layout }) {
  const r = layout.marker;
  const size = entry.visible ? (r - 1) * 2 : r * 2 - 0.5;
  return (
    <span
      aria-hidden="true"
      className="absolute box-border -translate-1/2 rounded-full"
      style={{
        left: entry.marker.x,
        top: entry.marker.y,
        width: size,
        height: size,
        ...(entry.visible
          ? { background: entry.color }
          : { border: `1.5px solid ${entry.color}` }),
      }}
    />
  );
}

/**
 * PNG에 그려진 legend를 metadata대로 DOM으로 다시 그려 그 자리에 겹친다.
 * 글자가 화면 해상도로 그려져 확대·축소된 PNG에서도 선명하고, 값이 실제 글자로 남는다.
 * 좌표는 PNG(CSS 픽셀) 좌표이고, 보이는 크기가 다르면(resize 대기 중) 통째로 늘리거나 줄인다.
 */
export function ChartLegend({
  legend,
  image,
  display,
}: {
  legend: LegendMeta;
  image: ChartImage;
  display: { width: number; height: number };
}) {
  const { t } = useLingui();
  const { layout, box, title } = legend;
  if (!layout || legend.entries.length === 0) return null;
  const sx = display.width / image.width;
  const sy = display.height / image.height;

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 origin-top-left font-chart"
      style={{
        width: image.width,
        height: image.height,
        transform: `scale(${sx}, ${sy})`,
        fontSize: layout.fontSize,
      }}
    >
      {/* 캔버스는 0.5px 안쪽에 1px 테두리를 긋는다. border-box로 같은 바깥 크기를 덮는다. */}
      <div
        className="absolute box-border rounded"
        style={{
          left: box.x,
          top: box.y,
          width: box.width + 1,
          height: box.height + 1,
          background: layout.surface,
          border: layout.borderColor
            ? `1px solid ${layout.borderColor}`
            : undefined,
        }}
      />
      <span
        aria-hidden="true"
        className={text}
        style={{
          left: layout.title.x,
          top: layout.title.y,
          maxWidth: layout.title.maxWidth + 1,
          color: layout.titleColor,
        }}
      >
        {legend.title}
      </span>
      <ul aria-label={t`${title} 범례`}>
        {legend.entries.map((entry) => {
          const labelX = entry.marker.x + layout.marker + 4;
          return (
            <li key={entry.value}>
              <Marker entry={entry} layout={layout} />
              <span
                className={text}
                style={{
                  left: labelX,
                  top: entry.marker.y,
                  maxWidth: entry.rect.x + entry.rect.width - labelX,
                  color: entry.visible ? layout.textColor : layout.mutedColor,
                }}
              >
                {entry.value}
                {!entry.visible && (
                  <span className="sr-only">{` ${t`(숨김)`}`}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {layout.more && (
        <span
          className={text}
          style={{
            left: layout.more.x,
            top: layout.more.y,
            color: layout.mutedColor,
          }}
        >
          +{legend.hidden}
        </span>
      )}
    </div>
  );
}
