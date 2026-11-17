// analytics 보드 저장소. 사용자당 보드 하나를 PGlite(IndexedDB)에 JSON 한 덩어리로 둔다 (DB Worker 안).
// 칸의 그린 차트는 서버 메모리에만 있으므로, 저장할 때 그 차트의 설정·item 상태를 `drawn`으로 고정해 두고
// 다시 열 때 그 값으로 새로 그린다.

import type {
  AnalyticsBoard,
  AnalyticsLayoutNode,
  AnalyticsPanel,
  ChartSpec,
  ItemRestore,
  SaveAnalyticsBoardRequest,
} from "../api/types";
import type { Db } from "../db/database";

/** 보드 한 장의 칸 수 한도 */
export const MAX_BOARD_PANELS = 9;
/** 비율 합이 1에서 이만큼 벗어나도 받는다 (소수 계산 오차) */
const RATIO_TOLERANCE = 1e-3;

/** DB에 두는 모양. updatedAt은 컬럼에 따로 둔다. */
export type StoredBoardBody = Omit<AnalyticsBoard, "updatedAt">;

export async function openBoards(db: Db) {
  await db.schema
    .createTable("analytics_boards")
    .ifNotExists()
    .addColumn("user_id", "text", (c) => c.primaryKey())
    .addColumn("body", "jsonb", (c) => c.notNull())
    .addColumn("updated_at", "double precision", (c) => c.notNull())
    .execute();
}

export async function getBoard(
  db: Db,
  userId: string,
): Promise<AnalyticsBoard | null> {
  const row = await db
    .selectFrom("analytics_boards")
    .select(["body", "updated_at"])
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return row ? { ...row.body, updatedAt: row.updated_at } : null;
}

/** 있으면 통째로 바꾼다. */
export async function saveBoard(
  db: Db,
  userId: string,
  body: StoredBoardBody,
  updatedAt: number,
) {
  const json = JSON.stringify(body);
  await db
    .insertInto("analytics_boards")
    .values({ user_id: userId, body: json, updated_at: updatedAt })
    .onConflict((oc) =>
      oc.column("user_id").doUpdateSet({ body: json, updated_at: updatedAt }),
    )
    .execute();
}

/** 지웠으면 true */
export async function deleteBoard(db: Db, userId: string) {
  const result = await db
    .deleteFrom("analytics_boards")
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

// ── 검증과 고정 (Worker 밖에서도 쓰는 순수 함수) ─────────────────

/** 트리의 leaf id를 깊이 우선 순서로 */
export function layoutPanelIds(node: AnalyticsLayoutNode): string[] {
  return node.type === "leaf"
    ? [node.panelId]
    : node.children.flatMap(layoutPanelIds);
}

/** 트리 모양의 문제. split마다 자식 2개 이상, 비율 수가 자식 수와 같고 합이 1 */
function treeIssue(node: AnalyticsLayoutNode): string | undefined {
  if (node.type === "leaf") return undefined;
  if (node.children.length < 2) return "split must have two or more children";
  if (node.ratios.length !== node.children.length)
    return "ratios must match children";
  const sum = node.ratios.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > RATIO_TOLERANCE) return "ratios must sum to 1";
  for (const child of node.children) {
    const issue = treeIssue(child);
    if (issue) return issue;
  }
  return undefined;
}

/**
 * 저장 요청의 필드 사이 규칙. 문제가 없으면 undefined.
 * leaf와 칸이 1:1, 칸 1~9개, 활성 칸과 따를 칸은 있는 칸, 칸은 split 없는 차트 한 장(grid 1×1).
 */
export function boardIssue(
  board: Pick<SaveAnalyticsBoardRequest, "layout" | "activePanelId"> & {
    panels: readonly Pick<AnalyticsPanel, "id" | "draft" | "link">[];
  },
): string | undefined {
  const tree = treeIssue(board.layout);
  if (tree) return tree;
  const leaves = layoutPanelIds(board.layout);
  const ids = board.panels.map((p) => p.id);
  if (ids.length < 1 || ids.length > MAX_BOARD_PANELS)
    return `a board has 1 to ${MAX_BOARD_PANELS} panels`;
  const unique = new Set(ids);
  if (unique.size !== ids.length) return "duplicate panel id";
  if (
    leaves.length !== ids.length ||
    new Set(leaves).size !== leaves.length ||
    leaves.some((id) => !unique.has(id))
  )
    return "layout leaves must match panels";
  if (!unique.has(board.activePanelId)) return "unknown active panel";
  for (const panel of board.panels) {
    const { grid, splitBy } = panel.draft;
    if (splitBy.length > 0 || grid.rows !== 1 || grid.cols !== 1)
      return "a panel draws one chart (grid 1x1, no split)";
    const follow = panel.link?.follow;
    if (follow !== undefined && (follow === panel.id || !unique.has(follow)))
      return "link must follow another panel";
  }
  return undefined;
}

export type DrawnChart = {
  spec: ChartSpec;
  restore: Record<string, ItemRestore>;
};

/**
 * 저장 요청의 칸에 `drawn`을 붙인다. chartId가 있으면 그 차트의 지금 상태로 고정하고,
 * 모르는 차트(새로고침으로 사라짐 등)면 같은 칸의 이전 값을 그대로 둔다. chartId가 없으면 그린 적 없는 칸이다.
 */
export function resolvePanels(
  panels: SaveAnalyticsBoardRequest["panels"],
  previous: AnalyticsBoard | null,
  drawnOf: (chartId: string) => DrawnChart | undefined,
): AnalyticsPanel[] {
  const before = new Map(previous?.panels.map((p) => [p.id, p.drawn]));
  return panels.map(({ chartId, ...panel }) => {
    if (chartId === undefined) return panel;
    const drawn = drawnOf(chartId) ?? before.get(panel.id);
    return drawn ? { ...panel, drawn } : panel;
  });
}
