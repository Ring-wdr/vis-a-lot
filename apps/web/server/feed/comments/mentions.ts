// 멘션. Tiptap JSON에서 { type: 'mention', attrs: { id } } 노드를 읽고, 게시물을 볼 수 있는 사람에게만 멘션 이력을 남긴다.
// 댓글과 게시물 설명이 같이 쓴다.

import type { OpCtx } from "../context";
import { recordEvent } from "../events";
import { autoSubscribe, type PostRow } from "../posts/load";

type Node = { type?: unknown; attrs?: { id?: unknown }; content?: unknown };

/** 문서 안 멘션 노드의 사용자 id (처음 나온 순서, 중복 없음) */
export function mentionIds(body: unknown): string[] {
  const ids = new Set<string>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Node;
    if (n.type === "mention" && typeof n.attrs?.id === "string" && n.attrs.id)
      ids.add(n.attrs.id);
    if (Array.isArray(n.content)) for (const child of n.content) walk(child);
  };
  walk(body);
  return [...ids];
}

const PLAIN_NODES = new Set(["doc", "paragraph", "text", "hardBreak"]);

/** 글자나 멘션·이미지 같은 내용 노드가 하나라도 있는 문서 */
export function hasContent(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const n = body as Node & { text?: unknown };
  if (typeof n.text === "string" && n.text.trim()) return true;
  if (typeof n.type === "string" && !PLAIN_NODES.has(n.type)) return true;
  return Array.isArray(n.content) && n.content.some(hasContent);
}

/** Tiptap 문서(doc)인지 */
export function isDoc(body: unknown): boolean {
  return !!body && typeof body === "object" && (body as Node).type === "doc";
}

/** ids 중 게시물을 볼 수 있는 활성 사용자 (비공개 그룹은 멤버와 시스템 관리자) */
export async function usersWhoCanSee(
  ctx: OpCtx,
  post: Pick<PostRow, "group_id">,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  const group = await ctx.db
    .selectFrom("groups")
    .select("is_private")
    .where("id", "=", post.group_id)
    .executeTakeFirstOrThrow();
  const users = await ctx.db
    .selectFrom("users")
    .select(["id", "is_admin"])
    .where("id", "in", ids)
    .where("active", "=", true)
    .execute();
  let ok = users;
  if (group.is_private) {
    const members = new Set(
      (
        await ctx.db
          .selectFrom("group_members")
          .select("user_id")
          .where("group_id", "=", post.group_id)
          .where("user_id", "in", ids)
          .execute()
      ).map((m) => m.user_id),
    );
    ok = users.filter((u) => u.is_admin || members.has(u.id));
  }
  const allowed = new Set(ok.map((u) => u.id));
  return ids.filter((id) => allowed.has(id));
}

/**
 * 새로 멘션된 사람마다 mention 이력(newValue = 사용자 id)을 남기고 구독시킨다.
 * 자기 자신과 볼 수 없는 사람은 뺀다. 이미 있는 구독 행(끈 구독 포함)은 그대로 둔다.
 */
export async function recordMentions(
  ctx: OpCtx,
  post: Pick<PostRow, "id" | "group_id">,
  userIds: string[],
  commentId?: string,
): Promise<string[]> {
  const actorId = ctx.actor?.id;
  const targets = await usersWhoCanSee(
    ctx,
    post,
    userIds.filter((id) => id !== actorId),
  );
  await autoSubscribe(ctx, post.id, targets);
  for (const userId of targets)
    await recordEvent(ctx, {
      postId: post.id,
      kind: "mention",
      newValue: userId,
      commentId,
      extraRecipients: [userId],
    });
  return targets;
}
