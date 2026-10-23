// 피드 search 모듈: 커맨드 팔레트의 게시물 찾기.
// 이슈 키(정확 → 앞부분·번호 일부 → 포함) → 제목 → 본문 → 댓글 순으로 모으고, 한 게시물은 가장 앞선 곳 하나로만 낸다.
// 볼 수 있는 그룹의 지우지 않은 게시물만 본다.

import { sql } from "kysely";
import type { SearchHit } from "../services/feed/modules/search/schemas";
import { visibleGroupIds } from "./access";
import { defineOps, type OpCtx, requireActor } from "./context";
import { toRef } from "./posts/load";

export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 50;
/** 본문·댓글은 JSON 글자로 먼저 거른 뒤 글만 뽑아 다시 확인하므로 넉넉히 가져온다 */
const CANDIDATES = 200;
const SNIPPET_LENGTH = 60;

type MatchedIn = SearchHit["matchedIn"];

/** Tiptap JSON → 글. 블록 사이는 띄어 쓴다 */
export function tiptapText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(tiptapText).join(" ");
  if (typeof node !== "object") return "";
  const n = node as { type?: unknown; text?: unknown; content?: unknown };
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (n.type === "hardBreak") return " ";
  return tiptapText(n.content);
}

/** 찾은 곳 주변 약 60자. 앞뒤가 잘리면 …를 붙인다. 없으면 null */
export function snippetOf(text: string, q: string): string | null {
  const flat = text.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return null;
  const pad = Math.max(0, Math.floor((SNIPPET_LENGTH - q.length) / 2));
  const start = Math.max(0, at - pad);
  const end = Math.min(flat.length, start + Math.max(SNIPPET_LENGTH, q.length));
  const head = start > 0 ? "…" : "";
  const tail = end < flat.length ? "…" : "";
  return `${head}${flat.slice(start, end).trim()}${tail}`;
}

const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

/** 이슈 키 순위: 0 정확, 1 앞부분(fd-1 → FD-1, FD-10), 2 번호 앞부분(12 → FD-12, FD-120), 3 포함 */
function keyRank(key: string, q: string) {
  const k = key.toLowerCase();
  const s = q.toLowerCase();
  if (k === s) return 0;
  if (k.startsWith(s)) return 1;
  const num = k.slice(k.indexOf("-") + 1);
  if (/^\d+$/.test(s) && num.startsWith(s)) return 2;
  return 3;
}

async function search(ctx: OpCtx, q: string, limit: number) {
  const groups = await visibleGroupIds(ctx);
  if (groups.length === 0) return [];
  const pattern = likePattern(q);
  const base = () =>
    ctx.db
      .selectFrom("posts")
      .select([
        "posts.id",
        "posts.key",
        "posts.title",
        "posts.status",
        "posts.group_id",
        "posts.seq",
      ])
      .where("posts.deleted_at", "is", null)
      .where("posts.group_id", "in", groups);

  const [keyRows, titleRows, bodyRows, commentRows] = await Promise.all([
    /\s/.test(q)
      ? Promise.resolve([])
      : base().where("posts.key", "ilike", pattern).limit(CANDIDATES).execute(),
    base()
      .where("posts.title", "ilike", pattern)
      .orderBy("posts.updated_at", "desc")
      .limit(CANDIDATES)
      .execute(),
    base()
      .select("posts.body")
      .where(sql`${sql.ref("posts.body")}::text`, "ilike", pattern)
      .orderBy("posts.updated_at", "desc")
      .limit(CANDIDATES)
      .execute(),
    base()
      .innerJoin("comments as c", "c.post_id", "posts.id")
      .select("c.body as comment_body")
      .where("c.deleted_at", "is", null)
      .where(sql`${sql.ref("c.body")}::text`, "ilike", pattern)
      .orderBy("c.created_at", "desc")
      .limit(CANDIDATES)
      .execute(),
  ]);

  const hits = new Map<string, SearchHit>();
  const add = (
    row: Parameters<typeof toRef>[0],
    matchedIn: MatchedIn,
    snippet: string | null,
  ) => {
    if (hits.has(row.id)) return;
    hits.set(row.id, { ...toRef(row), matchedIn, snippet });
  };

  keyRows
    .map((row) => ({ row, rank: keyRank(row.key, q) }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.row.key.length - b.row.key.length ||
        a.row.key.localeCompare(b.row.key),
    )
    .forEach(({ row }) => {
      add(row, "key", null);
    });
  for (const row of titleRows) add(row, "title", null);
  for (const row of bodyRows) {
    const snippet = snippetOf(tiptapText(row.body), q);
    if (snippet) add(row, "body", snippet);
  }
  for (const row of commentRows) {
    const snippet = snippetOf(tiptapText(row.comment_body), q);
    if (snippet) add(row, "comment", snippet);
  }
  return [...hits.values()].slice(0, limit);
}

export const searchOps = defineOps({
  "search.posts": async (
    ctx,
    args: { q: string; limit?: number },
  ): Promise<{ hits: SearchHit[] }> => {
    requireActor(ctx);
    const q = args.q.trim();
    if (!q) return { hits: [] };
    const limit = Math.min(
      Math.max(1, args.limit ?? SEARCH_DEFAULT_LIMIT),
      SEARCH_MAX_LIMIT,
    );
    return { hits: await search(ctx, q, limit) };
  },
});
