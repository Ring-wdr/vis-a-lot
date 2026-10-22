import { z } from "@hono/zod-openapi";
import {
  AggFnSchema,
  ColumnNameSchema,
  DatasetIdSchema,
  FiltersSchema,
} from "../common/dataset";

/**
 * 컴포넌트로 등록한 스키마에 .nullable()을 붙이면 null이 컴포넌트 자체에 섞여 들어가므로
 * 쓰는 자리에서 null과 묶는다.
 */
const orNull = <T extends z.ZodType>(schema: T) => z.union([schema, z.null()]);

const finite = z.number().refine(Number.isFinite, "must be finite");
const range = z.tuple([finite, finite]);

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "must be #rrggbb")
  .openapi("HexColor", { example: "#2a78d6" });

/** legend 값 → 색. legend 값 8개와 새 범례 8개까지라 그 이상은 잘못된 요청으로 본다. */
const ColorMapSchema = z
  .record(z.string(), HexColorSchema)
  .refine((m) => Object.keys(m).length <= 16, "at most 16 legend colors");

export const ChartTypeSchema = z
  .enum(["scatter", "bar", "boxplot"])
  .openapi("ChartType");

export const LegendPositionSchema = z
  .enum(["top", "bottom", "left", "right"])
  .openapi("LegendPosition");

export const CommonPropsSchema = z
  .object({
    /** legend가 없을 때의 색 */
    color: HexColorSchema,
    /** legend 값별 색. 없는 값은 팔레트 순서대로 기본 색을 쓴다. */
    legendColors: ColorMapSchema.optional(),
    /** legend 위치. 없으면 위 */
    legendPosition: LegendPositionSchema.optional(),
  })
  .openapi("CommonProps");

/** item grid. 행과 열을 따로 고른다 (1..10 x 1..10). */
export const GridSchema = z
  .object({
    rows: z.number().int().min(1).max(10),
    cols: z.number().int().min(1).max(10),
  })
  .openapi("Grid");

export const ChartSpecSchema = z
  .object({
    /** 데이터셋 id (샘플 iot-100k …, 업로드 up-…) */
    dataset: DatasetIdSchema,
    chartType: ChartTypeSchema,
    x: ColumnNameSchema,
    y: ColumnNameSchema,
    /** bar의 통계 함수 */
    agg: AggFnSchema,
    /** 색을 나눌 범주 컬럼. null이면 한 가지 색 */
    legend: orNull(ColumnNameSchema),
    /** 클릭한 순서가 곧 조합 순서다. */
    splitBy: z.array(ColumnNameSchema),
    splitSeparator: z.string().max(5),
    tooltip: z.array(ColumnNameSchema),
    grid: GridSchema,
    common: CommonPropsSchema,
    /** draw할 때 적용하는 데이터 필터. 예전 history에는 없을 수 있다. */
    filters: FiltersSchema.optional(),
  })
  .openapi("ChartSpec");

export const ItemSizeSchema = z
  .object({
    width: z.number().min(50).max(2000),
    height: z.number().min(50).max(2000),
  })
  .openapi("ItemSize");

export const ItemViewSchema = z
  .object({ x: range, y: range })
  .openapi("ItemView");

export const ShapeSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("rect"),
      x0: finite,
      y0: finite,
      x1: finite,
      y1: finite,
    }),
    z.object({
      type: z.literal("line"),
      x0: finite,
      y0: finite,
      x1: finite,
      y1: finite,
    }),
    z.object({
      type: z.literal("freehand"),
      points: z
        .array(z.tuple([finite, finite]))
        .min(2)
        .max(5000),
    }),
    z.object({
      type: z.literal("text"),
      x: finite,
      y: finite,
      text: z
        .string()
        .max(200)
        .refine((t) => t.trim().length > 0, "empty text"),
    }),
  ])
  .openapi("Shape");

/** 차트 위 영역 (데이터 좌표). 자유형은 시작점과 끝점을 이어 닫는다. */
export const RegionSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("rect"),
      x0: finite,
      y0: finite,
      x1: finite,
      y1: finite,
    }),
    z.object({
      type: z.literal("lasso"),
      points: z
        .array(z.tuple([finite, finite]))
        .min(3)
        .max(2000),
    }),
  ])
  .openapi("Region");

/** 이름 붙인 영역 (즐겨찾기, 새 범례). 이름은 item 안에서 겹치지 않는다. */
const RegionNameSchema = z
  .string()
  .max(40)
  .refine((t) => t.trim().length > 0, "empty name");

export const FavoriteSchema = z
  .object({ name: RegionNameSchema, region: RegionSchema })
  .openapi("Favorite");

export const LegendGroupSchema = z
  .object({
    name: RegionNameSchema,
    color: HexColorSchema,
    region: RegionSchema,
  })
  .openapi("LegendGroup");

/** 복원할 item 상태. split 조합 키에 붙는다. */
export const ItemRestoreSchema = z
  .object({
    view: ItemViewSchema.optional(),
    shapes: z.array(ShapeSchema),
    selection: RegionSchema.optional(),
    favorites: z.array(FavoriteSchema).max(20).optional(),
    legendGroups: z.array(LegendGroupSchema).max(8).optional(),
    /** 지운 영역 (scatter). 영역 안의 점은 그리지도, 세지도 않는다. */
    deletions: z.array(RegionSchema).max(50).optional(),
    color: HexColorSchema.optional(),
    legendColors: ColorMapSchema.optional(),
    legendPosition: LegendPositionSchema.optional(),
    /** legend 체크박스로 끈 값 */
    hiddenLegend: z.array(z.string()).max(16).optional(),
  })
  .openapi("ItemRestore");

export const CreateChartRequestSchema = z
  .object({
    spec: ChartSpecSchema,
    itemSize: ItemSizeSchema,
    /** history 복원이나 공유 링크로 열 때, 키별 확대·도형·개별 색 */
    restore: z.record(z.string(), ItemRestoreSchema).optional(),
    /** 이어서 기록할 history. 없으면 새로 만든다. */
    historyId: z.string().optional(),
    /** false면 history에 남기지 않는다 (history 다시 보기). historyId는 빈 문자열로 온다. */
    record: z.boolean().optional(),
  })
  .openapi("CreateChartRequest");

export const CreateChartResponseSchema = z
  .object({ chartId: z.string(), jobId: z.string(), historyId: z.string() })
  .openapi("CreateChartResponse");

export const ItemJobResponseSchema = z
  .object({ jobId: z.string() })
  .openapi("ItemJobResponse");

const TERMINAL = ["success", "failed", "cancelled"] as const;
export const JobStatusSchema = z
  .enum(["init", "progress", ...TERMINAL])
  .openapi("JobStatus");
export const ItemStatusSchema = z
  .enum(["queued", "running", ...TERMINAL])
  .openapi("ItemStatus");
export const ItemStageSchema = z
  .enum(["query", "aggregate", "render", "encode"])
  .openapi("ItemStage");

export const ChartImageSchema = z
  .object({ url: z.string(), width: z.number(), height: z.number() })
  .openapi("ChartImage");

export const ItemStateSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    status: ItemStatusSchema,
    stage: ItemStageSchema.optional(),
    /** 현재 단계 안에서의 진행률 0..1 */
    stageProgress: z.number(),
    image: ChartImageSchema.optional(),
    /** 고정 크기 섬네일. 크게 보기 화면 하단 목록에 쓴다. */
    thumbnail: ChartImageSchema.optional(),
    /** 그림 내용(확대·도형·색)이 바뀔 때마다 올라간다. 크기만 바뀌면 그대로다. */
    revision: z.number().int(),
    error: z.string().optional(),
    /** 확대 중인지. 축소/초기화 버튼 활성화에 쓴다. */
    zoomed: z.boolean(),
    shapeCount: z.number(),
    /** 실제로 그린 색 */
    color: z.string(),
    /** 개별 색을 지정했는지 */
    customColor: z.boolean(),
    /** item에 따로 정한 legend 위치. 없으면 공통 속성을 따른다. */
    legendPosition: LegendPositionSchema.optional(),
    /** 선택 영역 안의 점(막대/상자) 수. 선택이 없으면 없다. */
    selectedCount: z.number().optional(),
    favorites: z.array(FavoriteSchema),
    /** 선택 영역으로 만든 새 범례 */
    legendGroups: z.array(z.object({ name: z.string(), color: z.string() })),
    /** 지운 영역 수. 되돌리기 버튼 활성화에 쓴다. */
    deletionCount: z.number(),
  })
  .openapi("ItemState");

export const JobStateResponseSchema = z
  .object({
    jobId: z.string(),
    chartId: z.string(),
    /** 상태가 바뀔 때마다 올라간다. long polling의 since 값으로 돌려보낸다. */
    version: z.number(),
    status: JobStatusSchema,
    /** job 전체 단계: 데이터셋 준비 → 데이터 조회 → item 렌더 */
    phase: z.enum(["dataset", "query", "render"]),
    /** dataset 단계에서는 생성 행 수, 그 뒤로는 끝난 item 수 */
    progress: z.object({ done: z.number(), total: z.number() }),
    /** 조회가 끝나기 전에는 item 개수를 모른다. */
    totalItems: z.number().nullable(),
    page: z.number(),
    pageSize: z.number(),
    /** items[0]의 전체 순번 */
    offset: z.number(),
    items: z.array(ItemStateSchema),
    /** job이 failed로 끝난 이유 (예: split 조합 개수 초과) */
    error: z.string().optional(),
    /** draw(조회부터) 또는 redraw(그린 item 다시 그리기) */
    kind: z.enum(["draw", "redraw"]),
    /** job 전체의 상태별 item 수 */
    counts: z.object({
      queued: z.number(),
      running: z.number(),
      success: z.number(),
      failed: z.number(),
      cancelled: z.number(),
    }),
    /** epoch ms. 경과 시간, 처리 속도, 남은 시간 계산용 */
    timing: z.object({
      createdAt: z.number(),
      renderStartedAt: z.number().optional(),
      endedAt: z.number().optional(),
    }),
    /** 병렬로 그리는 Render Worker 수 */
    renderWorkers: z.number(),
  })
  .openapi("JobStateResponse");

export const JobQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(0).max(100).default(9),
  /** 지정하면 page 대신 이 순번부터 pageSize개를 준다. */
  offset: z.coerce.number().int().min(0).optional(),
  /** 지정하면 그 item들만 (item 단위 다시 그리기) */
  items: z
    .string()
    .optional()
    .openapi({ description: "쉼표로 구분한 item 키" }),
  since: z.coerce.number().default(-1),
});

export const DetailRequestSchema = z
  .object({ itemSize: ItemSizeSchema })
  .openapi("DetailRequest");

/** 그 크기로 그려 둔 PNG가 있으면 image, 없으면 그리는 job */
export const DetailResponseSchema = z
  .union([
    z.object({ image: ChartImageSchema }),
    z.object({ jobId: z.string() }),
  ])
  .openapi("DetailResponse");

export const ViewRequestSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("zoomIn"), x: range, y: range }),
    z.object({ type: z.literal("zoomOut"), ratio: z.number().gt(1).max(10) }),
    z.object({ type: z.literal("reset") }),
    /** 이동: 보이는 범위를 데이터 값 기준으로 (dx, dy)만큼 옮긴다. */
    z.object({ type: z.literal("pan"), dx: finite, dy: finite }),
  ])
  .openapi("ViewRequest");

export const DeletionRequestSchema = z
  .object({ region: RegionSchema })
  .openapi("DeletionRequest");

export const SelectionRequestSchema = z
  .object({ region: orNull(RegionSchema) })
  .openapi("SelectionRequest");

/** 지금 선택 영역에 이름을 붙여 즐겨찾기나 새 범례로 남긴다. */
export const NameRequestSchema = z
  .object({ name: RegionNameSchema })
  .openapi("NameRequest");

export const AddShapeRequestSchema = z
  .object({ shape: ShapeSchema })
  .openapi("AddShapeRequest");

export const CommonPropsRequestSchema = z
  .object({ common: CommonPropsSchema })
  .openapi("CommonPropsRequest");

export const GridRequestSchema = z
  .object({ grid: GridSchema, itemSize: ItemSizeSchema })
  .openapi("GridRequest");

export const ResizeRequestSchema = z
  .object({ itemSize: ItemSizeSchema, keys: z.array(z.string()) })
  .openapi("ResizeRequest");

/**
 * 개별 속성. color는 legend가 없을 때의 색, legendColor는 legend 값 하나의 색, legendPosition은 legend 위치,
 * legendVisible은 legend 체크박스로 값 하나를 켜고 끈다.
 * null이면 공통 속성을 따르도록 되돌린다. color: null은 legend 값별 색까지 모두 되돌린다.
 */
export const ItemPropsRequestSchema = z
  .union([
    z.object({ color: orNull(HexColorSchema) }),
    z.object({
      legendColor: z.object({
        value: z.string(),
        color: orNull(HexColorSchema),
      }),
    }),
    z.object({ legendPosition: orNull(LegendPositionSchema) }),
    /** legend 체크박스: 값 하나를 보이거나 숨긴다. */
    z.object({
      legendVisible: z.object({ value: z.string(), visible: z.boolean() }),
    }),
  ])
  .openapi("ItemPropsRequest");

export const TooltipRequestSchema = z
  .object({ rowId: finite, columns: z.array(ColumnNameSchema) })
  .openapi("TooltipRequest");

export const TooltipResponseSchema = z
  .object({
    values: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  })
  .openapi("TooltipResponse");

// ── 툴팁 metadata ───────────────────────────────────────────────

const PlotSchema = z.object({
  left: z.number(),
  top: z.number(),
  width: z.number(),
  height: z.number(),
});

export const AxisMetaSchema = z
  .object({
    kind: z.enum(["number", "time"]),
    /** 데이터 값 기준 범위 (시계열은 epoch ms) */
    domain: range,
  })
  .openapi("AxisMeta");

const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const LegendMetaSchema = z
  .object({
    title: z.string(),
    /** 전체 legend 값과 색 (상자에 다 들어가지 못한 값 포함) */
    values: z.array(z.string()),
    colors: z.array(z.string()),
    box: RectSchema,
    /** 화면에 다 들어가지 못한 항목은 빠지고 hidden 수로만 남는다. */
    entries: z.array(
      z.object({
        value: z.string(),
        color: z.string(),
        index: z.number(),
        rect: RectSchema,
        /** 색 표시(●)의 가운데. 체크박스를 이 자리에 겹친다. */
        marker: z.object({ x: z.number(), y: z.number() }),
        /** 체크박스로 끈 값이면 false */
        visible: z.boolean(),
      }),
    ),
    hidden: z.number(),
  })
  .openapi("LegendMeta");

export const ScatterMetaSchema = z
  .object({
    chartType: z.literal("scatter"),
    /** PNG 안에서 그림 영역의 픽셀 범위 */
    plot: PlotSchema,
    x: AxisMetaSchema,
    y: AxisMetaSchema,
    /** 같은 픽셀 칸에 겹친 점은 첫 점만 남긴다. px/py는 PNG 좌표, x/y는 데이터 값이다. */
    points: z.object({
      px: z.array(z.number()),
      py: z.array(z.number()),
      x: z.array(z.number()),
      y: z.array(z.number()),
      id: z.array(z.number()),
      /** legend 인덱스 (legend가 있을 때만) */
      g: z.array(z.number()).optional(),
    }),
    total: z.number(),
    selected: z.number().optional(),
    legend: LegendMetaSchema.optional(),
  })
  .openapi("ScatterMeta");

export const BoxSummarySchema = z
  .object({
    n: z.number(),
    mean: z.number(),
    q1: z.number(),
    median: z.number(),
    q3: z.number(),
    /** 1.5 IQR 안쪽의 최솟값/최댓값 (수염 끝) */
    lo: z.number(),
    hi: z.number(),
    outlierCount: z.number(),
  })
  .openapi("BoxSummary");

export const CategoryMetaSchema = z
  .object({
    chartType: z.enum(["bar", "boxplot"]),
    plot: PlotSchema,
    /** 범주 인덱스 공간 */
    x: AxisMetaSchema,
    y: AxisMetaSchema,
    categories: z.array(z.string()),
    /** 범주 하나에 놓인 막대/상자 묶음의 픽셀 너비 */
    markWidth: z.number(),
    /** 범주 하나에 나란히 놓는 막대/상자 수 (legend 값 수, 없으면 1) */
    groupCount: z.number(),
    /** 묶음 안에서 막대/상자 사이 간격(px) */
    groupGap: z.number(),
    agg: AggFnSchema.optional(),
    /** [범주][legend 값] */
    bars: z.array(z.array(z.number().nullable())).optional(),
    /** 툴팁용 통계. 이상치 값 목록은 빼고 개수만 둔다. */
    boxes: z.array(z.array(orNull(BoxSummarySchema))).optional(),
    selected: z.number().optional(),
    legend: LegendMetaSchema.optional(),
  })
  .openapi("CategoryMeta");

/** 차트 종류별 metadata */
export const ItemMetaSchema = z
  .union([ScatterMetaSchema, CategoryMetaSchema])
  .openapi("ItemMeta");

// ── history ────────────────────────────────────────────────────

export const HistoryEventTypeSchema = z
  .enum([
    "zoom",
    "shape",
    "undo",
    "clearShapes",
    "color",
    "legend",
    "common",
    "grid",
    "selection",
    "favorite",
    "delete",
  ])
  .openapi("HistoryEventType");

export const HistorySummarySchema = z
  .object({
    id: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
    dataset: DatasetIdSchema,
    generatorVersion: z.number(),
    spec: ChartSpecSchema,
    status: JobStatusSchema,
    itemCount: z.number(),
    /** 상태별 item 수 (cancelled 포함) */
    statusCounts: z.partialRecord(ItemStatusSchema, z.number()),
    eventCounts: z.partialRecord(HistoryEventTypeSchema, z.number()),
    thumbnail: z.string().optional(),
  })
  .openapi("HistorySummary");

export const HistoryItemSchema = ItemRestoreSchema.extend({
  label: z.string(),
  status: ItemStatusSchema,
}).openapi("HistoryItem");

export const HistoryDetailSchema = HistorySummarySchema.extend({
  items: z.record(z.string(), HistoryItemSchema),
  events: z.array(
    z.object({
      type: HistoryEventTypeSchema,
      at: z.number(),
      item: z.string().optional(),
    }),
  ),
}).openapi("HistoryDetail");

export const HistoryListResponseSchema = z
  .object({ entries: z.array(HistorySummarySchema) })
  .openapi("HistoryListResponse");

// ── 운영 ───────────────────────────────────────────────────────

export const ChartHealthSchema = z
  .object({ service: z.literal("chart"), renderWorkers: z.number() })
  .openapi("ChartHealth");

export const DebugRenderRequestSchema = z
  .object({
    chartId: z.string(),
    itemKey: z.string(),
    width: z.number().int().min(50).max(2000),
    height: z.number().int().min(50).max(2000),
    points: z.number().int().min(1).max(5_000_000),
  })
  .openapi("DebugRenderRequest");

export const DebugRenderResponseSchema = z
  .object({
    url: z.string(),
    width: z.number(),
    height: z.number(),
    worker: z.string(),
    renderMs: z.number(),
  })
  .openapi("DebugRenderResponse");
