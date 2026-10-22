import { z } from "@hono/zod-openapi";
import {
  AggFnSchema,
  ColumnNameSchema,
  ColumnTypeSchema,
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
  .enum([
    "scatter",
    "bar",
    "boxplot",
    "line",
    "sankey",
    "heatmap",
    "treemap",
    "candle",
    "gantt",
    "pie",
    "radar",
    "histogram",
    "waterfall",
    "funnel",
  ])
  .openapi("ChartType");

// ── 차트 속성(옵션) ──────────────────────────────────────────────
// 모양은 server/render/options.ts의 ChartOptions를 따른다. 저장하는 값은 모든 필드가 선택인 부분 값이다.

const num = (min: number, max: number) =>
  finite.pipe(z.number().min(min).max(max));
const text = (max = 80) => z.string().max(max);
const opt = <T extends z.ZodRawShape>(shape: T) => z.object(shape).partial();

const PointShapeSchema = z
  .enum(["circle", "square", "triangle", "diamond", "cross"])
  .openapi("PointShape");

const AxisOptionsSchema = opt({
  visible: z.boolean(),
  title: opt({ visible: z.boolean(), text: text() }),
  min: orNull(finite),
  max: orNull(finite),
  log: z.boolean(),
  line: opt({ visible: z.boolean(), width: num(0, 10), color: HexColorSchema }),
  grid: opt({ visible: z.boolean(), width: num(0, 10), color: HexColorSchema }),
  tick: opt({
    visible: z.boolean(),
    count: num(1, 20),
    length: num(0, 20),
    color: HexColorSchema,
  }),
  label: opt({
    visible: z.boolean(),
    angle: num(-90, 90),
    fontSize: num(6, 40),
    color: HexColorSchema,
  }),
  decimals: orNull(num(0, 10)),
  dateFormat: text(40),
}).openapi("AxisOptions");

export const ChartOptionsSchema = opt({
  title: opt({
    visible: z.boolean(),
    text: text(),
    subtitle: text(),
    fontSize: num(6, 40),
    bold: z.boolean(),
    color: HexColorSchema,
    align: z.enum(["left", "center", "right"]),
  }),
  axes: opt({ x: AxisOptionsSchema, y: AxisOptionsSchema }),
  legend: opt({
    visible: z.boolean(),
    border: z.boolean(),
    borderColor: HexColorSchema,
    reverse: z.boolean(),
    fontSize: num(6, 40),
    fontColor: HexColorSchema,
  }),
  panel: opt({
    backColor: HexColorSchema,
    gradient: z.boolean(),
    border: z.boolean(),
    borderColor: HexColorSchema,
    margin: opt({
      top: num(0, 200),
      right: num(0, 200),
      bottom: num(0, 200),
      left: num(0, 200),
    }),
  }),
  palette: opt({
    gradient: z.boolean(),
    start: HexColorSchema,
    middle: z.union([HexColorSchema, z.literal("")]),
    end: HexColorSchema,
    steps: num(0, 64),
    reverse: z.boolean(),
  }),
  shape: opt({
    type: PointShapeSchema,
    style: z.enum(["both", "border", "brush"]),
    transparency: num(0, 1),
    borderWidth: num(0, 10),
  }),
  size: opt({
    pointAuto: z.boolean(),
    pointFixed: num(0.5, 40),
    pointMin: num(0.5, 40),
    pointMax: num(0.5, 40),
    fontAuto: z.boolean(),
    fontMin: num(6, 40),
    fontMax: num(6, 40),
    lineWidth: num(0.5, 10),
  }),
  pointLabel: opt({
    visible: z.boolean(),
    position: z.enum(["top", "center", "bottom"]),
    angle: num(-90, 90),
    fontSize: num(6, 40),
    color: HexColorSchema,
    prefix: text(20),
    suffix: text(20),
    decimals: orNull(num(0, 10)),
    box: opt({
      visible: z.boolean(),
      background: HexColorSchema,
      border: HexColorSchema,
    }),
  }),
  score: opt({
    visible: z.boolean(),
    kinds: z.array(z.enum(["rscore", "fscore", "zscore", "cpk"])).max(4),
    ucl: orNull(finite),
    lcl: orNull(finite),
    fontSize: num(6, 40),
    fontColor: HexColorSchema,
    backColor: HexColorSchema,
    borderColor: HexColorSchema,
    borderWidth: num(0, 10),
  }),
  prediction: opt({
    enabled: z.boolean(),
    method: z.enum(["sma", "ses", "des", "holtWinters"]),
    period: num(1, 500),
    showInterval: z.boolean(),
    description: z.boolean(),
    window: num(2, 500),
    alpha: orNull(num(0, 1)),
    beta: orNull(num(0, 1)),
    gamma: orNull(num(0, 1)),
    seasonLength: num(2, 500),
    trend: z.enum(["additive", "multiplicative"]),
    seasonal: z.enum(["additive", "multiplicative"]),
    damped: z.boolean(),
  }),
  value: opt({
    nullNumeric: orNull(finite),
    outlier: z.boolean(),
    outlierMethod: z.enum(["iqr", "sigma"]),
    outlierK: num(0, 10),
  }),
  focus: opt({
    enabled: z.boolean(),
    target: z.enum(["x", "y"]),
    operator: z.enum([">", ">=", "<", "<=", "=", "!="]),
    value: finite,
    color: HexColorSchema,
    shape: PointShapeSchema,
    size: num(0.5, 40),
    legendSingleColor: z.boolean(),
  }),
  tooltip: opt({
    title: text(),
    fontSize: num(6, 40),
    fontColor: HexColorSchema,
    background: HexColorSchema,
    transparency: num(0, 1),
    round: z.boolean(),
    border: z.boolean(),
    borderColor: HexColorSchema,
    prefix: text(20),
    suffix: text(20),
    decimals: orNull(num(0, 10)),
  }),
  expression: opt({ x: text(120), y: text(120) }),
}).openapi("ChartOptions");

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
    /** 차트 속성. 차트가 쓰지 않는 구역은 저장하지 않는다. */
    options: ChartOptionsSchema.optional(),
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
    /** 세 번째 값 컬럼. 쓰는 차트만 고른다. 예전 history에는 없다. */
    z: orNull(ColumnNameSchema).optional(),
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
    /** item 개별 차트 속성 */
    options: ChartOptionsSchema.optional(),
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
    /** item에 따로 정한 차트 속성. 없으면 공통 속성을 따른다. */
    options: ChartOptionsSchema.optional(),
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
    /** item 개별 차트 속성 전체를 바꾼다. null이면 지우고 공통 속성을 따른다. */
    z.object({ options: orNull(ChartOptionsSchema) }),
  ])
  .openapi("ItemPropsRequest");

// ── 데이터 표 / 다운로드 ─────────────────────────────────────────

export const ItemRowsRequestSchema = z
  .object({
    offset: z.number().int().min(0),
    limit: z.number().int().min(1).max(500),
    /** 없으면 저장된 순서 */
    sort: z.object({ column: ColumnNameSchema, desc: z.boolean() }).optional(),
  })
  .openapi("ItemRowsRequest");

const ItemRowsColumnsSchema = z.array(
  z.object({
    name: ColumnNameSchema,
    label: z.string(),
    type: ColumnTypeSchema,
  }),
);

export const ItemRowsResponseSchema = z
  .object({
    /** 데이터셋의 모든 컬럼 (스키마 순서) */
    columns: ItemRowsColumnsSchema,
    /** 컬럼 순서대로의 값. 시각은 epoch ms */
    rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
    /** 조건에 맞는 전체 행 수 */
    total: z.number(),
    /** 선택 영역 안의 행만 담았는지 */
    selected: z.boolean(),
    /** 적용한 draw 시점 필터 수 (화면에 지금 보이는 필터가 아니다) */
    filterCount: z.number().int(),
  })
  .openapi("ItemRowsResponse");

export const SampleRowsResponseSchema = z
  .object({
    /** 데이터셋의 모든 컬럼 (스키마 순서) */
    columns: ItemRowsColumnsSchema,
    rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
    /** 샘플 안의 행 수 (최대 30,000) */
    total: z.number(),
    /** draw 시점 필터에 맞는 전체 행 수 */
    population: z.number(),
    /** 전체가 상한보다 많아 샘플로 줄였는지 */
    sampled: z.boolean(),
    filterCount: z.number().int(),
  })
  .openapi("SampleRowsResponse");

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
    /** line도 같은 행 단위 점 metadata를 쓴다. */
    chartType: z.enum(["scatter", "line"]),
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

export const SankeyMetaSchema = z
  .object({
    chartType: z.literal("sankey"),
    plot: PlotSchema,
    /** 고정 좌표 공간 [0, plot.width]. 이동·확대가 없다. */
    x: AxisMetaSchema,
    /** 고정 좌표 공간 [0, plot.height] (아래가 0) */
    y: AxisMetaSchema,
    agg: AggFnSchema,
    /** 놓인 노드. 좌표는 PNG 좌표다. */
    nodes: z.array(
      z.object({
        name: z.string(),
        side: z.enum(["source", "target"]),
        x0: z.number(),
        y0: z.number(),
        x1: z.number(),
        y1: z.number(),
        /** 들어오는 흐름 합 */
        in: z.number(),
        /** 나가는 흐름 합 */
        out: z.number(),
        /** 출발 노드의 legend 인덱스 */
        legend: z.number().optional(),
      }),
    ),
    /** 흐름. source·target은 nodes 인덱스, y0·y1은 양 끝의 가운데 y, width는 굵기(px) */
    links: z.array(
      z.object({
        source: z.number(),
        target: z.number(),
        value: z.number(),
        y0: z.number(),
        y1: z.number(),
        width: z.number(),
      }),
    ),
    selected: z.number().optional(),
    legend: LegendMetaSchema.optional(),
  })
  .openapi("SankeyMeta");

export const HeatmapMetaSchema = z
  .object({
    chartType: z.literal("heatmap"),
    plot: PlotSchema,
    /** x 범주 인덱스 공간 */
    x: AxisMetaSchema,
    /** y 범주 인덱스 공간 (0이 아래) */
    y: AxisMetaSchema,
    xTitle: z.string(),
    yTitle: z.string(),
    xCategories: z.array(z.string()),
    /** 시계열 x: 구간 시작 시각(epoch ms)과 구간 길이 */
    xStarts: z.array(z.number()).optional(),
    timeBin: z.number().optional(),
    yCategories: z.array(z.string()),
    /** [x][y] 집계값 */
    cells: z.array(z.array(z.number().nullable())),
    agg: AggFnSchema,
    /** 색 척도의 값 범위 */
    colorDomain: range,
    selected: z.number().optional(),
    /** 선택 영역으로 만든 새 범례 */
    legend: LegendMetaSchema.optional(),
  })
  .openapi("HeatmapMeta");

const TreemapNodeSchema = z.object({
  name: z.string(),
  /** legend 인덱스 (legend가 없으면 0) */
  g: z.number(),
  value: z.number(),
  /** 레이아웃 좌표 [0,1]. y0이 아래, y1이 위 */
  x0: z.number(),
  y0: z.number(),
  x1: z.number(),
  y1: z.number(),
});

export const TreemapMetaSchema = z
  .object({
    chartType: z.literal("treemap"),
    plot: PlotSchema,
    /** 레이아웃 좌표 [0,1] */
    x: AxisMetaSchema,
    y: AxisMetaSchema,
    agg: AggFnSchema,
    /** 보이는 잎 값의 합 */
    total: z.number(),
    leaves: z.array(TreemapNodeSchema),
    /** legend가 있을 때의 부모 묶음 */
    parents: z.array(TreemapNodeSchema),
    selected: z.number().optional(),
    legend: LegendMetaSchema.optional(),
  })
  .openapi("TreemapMeta");

export const CandleMetaSchema = z
  .object({
    chartType: z.literal("candle"),
    plot: PlotSchema,
    /** 시계열(epoch ms) */
    x: AxisMetaSchema,
    y: AxisMetaSchema,
    /** 구간 길이(ms) */
    interval: z.number(),
    /** 몸통 픽셀 너비 */
    bodyWidth: z.number(),
    /** 그린 캔들 (숨긴 legend 값은 빠진다). t는 구간 시작, g는 legend 인덱스 (상승 0, 하락 1, 새 범례는 그 뒤) */
    candles: z.object({
      t: z.array(z.number()),
      open: z.array(z.number()),
      high: z.array(z.number()),
      low: z.array(z.number()),
      close: z.array(z.number()),
      count: z.array(z.number()),
      g: z.array(z.number()),
    }),
    selected: z.number().optional(),
    legend: LegendMetaSchema.optional(),
  })
  .openapi("CandleMeta");

export const GanttMetaSchema = z
  .object({
    chartType: z.literal("gantt"),
    plot: PlotSchema,
    /** 시계열(epoch ms) */
    x: AxisMetaSchema,
    /** 행 인덱스 공간. 행 i의 가운데는 rows.length - 1 - i */
    y: AxisMetaSchema,
    /** y 컬럼 이름(라벨) */
    rowTitle: z.string(),
    rows: z.array(z.string()),
    /** 막대 픽셀 높이 */
    barHeight: z.number(),
    /** 그린 막대. r 행 번호, s·e 시작·끝, g legend 인덱스, n 행 수, m 같은 픽셀 칸에 합친 막대 수. 행 → 시작 순 */
    bars: z.object({
      r: z.array(z.number()),
      s: z.array(z.number()),
      e: z.array(z.number()),
      g: z.array(z.number()),
      n: z.array(z.number()),
      m: z.array(z.number()),
    }),
    /** 막대가 상한을 넘어 metadata에서 뺀 게 있는지 */
    truncated: z.boolean(),
    selected: z.number().optional(),
    legend: LegendMetaSchema.optional(),
  })
  .openapi("GanttMeta");

const PointSchema = z.object({ x: z.number(), y: z.number() });

export const PieMetaSchema = z
  .object({
    chartType: z.literal("pie"),
    plot: PlotSchema,
    /** 고정 좌표 공간: 그림 영역 픽셀과 1:1 (x는 왼쪽, y는 아래쪽에서의 거리) */
    x: AxisMetaSchema,
    y: AxisMetaSchema,
    /** 원의 중심(PNG 좌표)과 반지름(px) */
    center: PointSchema,
    radius: z.number(),
    /** 보이는 조각만, 그린 순서대로 */
    slices: z.array(
      z.object({
        category: z.string(),
        value: z.number(),
        /** 보이는 조각 합계 대비 비율 */
        ratio: z.number(),
        /** 캔버스 각도(라디안). 12시 방향이 -π/2이고 시계 방향으로 커진다. */
        start: z.number(),
        end: z.number(),
        color: z.string(),
        /** legend 인덱스 */
        index: z.number(),
      }),
    ),
    total: z.number(),
    agg: AggFnSchema.optional(),
    selected: z.number().optional(),
    legend: LegendMetaSchema.optional(),
  })
  .openapi("PieMeta");

export const RadarMetaSchema = z
  .object({
    chartType: z.literal("radar"),
    plot: PlotSchema,
    /** 고정 좌표 공간: 그림 영역 픽셀과 1:1 (x는 왼쪽, y는 아래쪽에서의 거리) */
    x: AxisMetaSchema,
    y: AxisMetaSchema,
    center: PointSchema,
    radius: z.number(),
    /** x 컬럼 라벨 */
    axisTitle: z.string(),
    /** 축(x 범주). 12시부터 시계 방향 */
    axes: z.array(z.string()),
    /** 중심 → 바깥 값 범위 */
    domain: range,
    /** 보이는 계열만 */
    series: z.array(
      z.object({
        name: z.string(),
        color: z.string(),
        /** legend 인덱스 (legend가 없으면 0) */
        index: z.number(),
        /** 축 순서대로의 값 */
        values: z.array(z.number().nullable()),
        /** 꼭짓점의 PNG 좌표. 값이 없는 축은 null */
        points: z.array(z.tuple([z.number(), z.number()]).nullable()),
      }),
    ),
    agg: AggFnSchema.optional(),
    selected: z.number().optional(),
    legend: LegendMetaSchema.optional(),
  })
  .openapi("RadarMeta");

/** 차트 종류별 metadata */
export const HistogramMetaSchema = z
  .object({
    chartType: z.literal("histogram"),
    plot: PlotSchema,
    /** 값 공간 */
    x: AxisMetaSchema,
    /** 개수 */
    y: AxisMetaSchema,
    /** 구간: lo부터 step 간격으로 count개. 마지막 구간만 끝값을 포함한다. */
    bins: z.object({ lo: z.number(), step: z.number(), count: z.number() }),
    /** [구간][legend 값] 개수 */
    counts: z.array(z.array(z.number())),
    /** 구간 하나에 나란히 놓는 막대 수 (legend 값 수, 없으면 1) */
    groupCount: z.number(),
    selected: z.number().optional(),
    legend: LegendMetaSchema.optional(),
  })
  .openapi("HistogramMeta");

export const WaterfallMetaSchema = z
  .object({
    chartType: z.literal("waterfall"),
    plot: PlotSchema,
    /** 막대 인덱스 공간. 마지막 인덱스가 합계 */
    x: AxisMetaSchema,
    y: AxisMetaSchema,
    /** 데이터 범주. 막대 수는 범주 수 + 1(합계)이다. */
    categories: z.array(z.string()),
    /** 막대: start에서 end까지. kind 0 증가, 1 감소, 2 합계 */
    steps: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        kind: z.union([z.literal(0), z.literal(1), z.literal(2)]),
      }),
    ),
    /** 막대의 픽셀 너비 */
    markWidth: z.number(),
    agg: AggFnSchema.optional(),
    selected: z.number().optional(),
    legend: LegendMetaSchema.optional(),
  })
  .openapi("WaterfallMeta");

export const FunnelMetaSchema = z
  .object({
    chartType: z.literal("funnel"),
    plot: PlotSchema,
    /** 고정 좌표: [0, 그림 영역 폭] */
    x: AxisMetaSchema,
    /** 고정 좌표: [0, 그림 영역 높이] (아래에서 위로) */
    y: AxisMetaSchema,
    /** 그린(끄지 않은) 단계만, 위에서 아래 순서 */
    stages: z.array(
      z.object({
        label: z.string(),
        value: z.number(),
        /** legend 인덱스 (단계 순서) */
        index: z.number(),
        /** 막대의 PNG 좌표 */
        rect: RectSchema,
        /** 바로 위 단계 대비 비율 */
        rate: z.number().nullable(),
        /** 첫 단계 대비 비율 */
        share: z.number().nullable(),
      }),
    ),
    agg: AggFnSchema.optional(),
    selected: z.number().optional(),
    legend: LegendMetaSchema.optional(),
  })
  .openapi("FunnelMeta");

export const ItemMetaSchema = z
  .union([
    ScatterMetaSchema,
    CategoryMetaSchema,
    SankeyMetaSchema,
    HeatmapMetaSchema,
    TreemapMetaSchema,
    CandleMetaSchema,
    GanttMetaSchema,
    PieMetaSchema,
    RadarMetaSchema,
    HistogramMetaSchema,
    WaterfallMetaSchema,
    FunnelMetaSchema,
  ])
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
    "options",
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
