// DB 행 → API 모양(PostSummary·PostDetail). 목록은 게시물 수와 상관없이 쿼리 몇 번으로 센다(N+1 없음).

import type {
  PostDetail,
  PostPermissions,
  PostSummary,
} from "../../services/feed/modules/posts/schemas";
import type { OpCtx } from "../context";
import { day, iso } from "../time";
import { type PostRow, toRef } from "./load";
import {
  CLOSED_STATUSES,
  canDelete,
  canEdit,
  canTransition,
  categoryOf,
  type PostRoles,
  reachableStatuses,
} from "./workflow";

/** ids 순서대로 요약을 만든다. 지운 게시물은 빠진다 */
export async function loadSummaries(
  ctx: OpCtx,
  ids: string[],
): Promise<PostSummary[]> {
  if (ids.length === 0) return [];
  const [rows, stakeholders, comments, children, blocked] = await Promise.all([
    ctx.db
      .selectFrom("posts")
      .selectAll()
      .where("id", "in", ids)
      .where("deleted_at", "is", null)
      .execute(),
    ctx.db
      .selectFrom("post_stakeholders")
      .select(["post_id", "user_id"])
      .where("post_id", "in", ids)
      .orderBy("user_id")
      .execute(),
    ctx.db
      .selectFrom("comments")
      .select((eb) => ["post_id", eb.fn.countAll<number>().as("n")])
      .where("post_id", "in", ids)
      .where("deleted_at", "is", null)
      .groupBy("post_id")
      .execute(),
    ctx.db
      .selectFrom("posts")
      .select((eb) => [
        "parent_id",
        eb.fn.countAll<number>().as("total"),
        eb.fn
          .countAll<number>()
          .filterWhere("status", "in", CLOSED_STATUSES)
          .as("done"),
      ])
      .where("parent_id", "in", ids)
      .where("deleted_at", "is", null)
      .groupBy("parent_id")
      .execute(),
    ctx.db
      .selectFrom("post_relations as r")
      .innerJoin("posts as b", "b.id", "r.from_id")
      .select("r.to_id")
      .distinct()
      .where("r.to_id", "in", ids)
      .where("r.kind", "=", "blocks")
      .where("b.deleted_at", "is", null)
      .where("b.status", "not in", CLOSED_STATUSES)
      .execute(),
  ]);
  const stakeholderIds = new Map<string, string[]>();
  for (const s of stakeholders)
    stakeholderIds.set(s.post_id, [
      ...(stakeholderIds.get(s.post_id) ?? []),
      s.user_id,
    ]);
  const commentCount = new Map(comments.map((c) => [c.post_id, Number(c.n)]));
  const childCount = new Map(children.map((c) => [c.parent_id, c]));
  const blockedIds = new Set(blocked.map((b) => b.to_id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    const child = childCount.get(id);
    return [
      toSummary(row, {
        stakeholderIds: stakeholderIds.get(id) ?? [],
        commentCount: commentCount.get(id) ?? 0,
        childCount: Number(child?.total ?? 0),
        childResolvedCount: Number(child?.done ?? 0),
        blocked: blockedIds.has(id),
      }),
    ];
  });
}

function toSummary(
  row: PostRow,
  extra: Pick<
    PostSummary,
    | "stakeholderIds"
    | "commentCount"
    | "childCount"
    | "childResolvedCount"
    | "blocked"
  >,
): PostSummary {
  return {
    id: row.id,
    key: row.key,
    groupId: row.group_id,
    teamId: row.team_id,
    postTypeId: row.post_type_id,
    format: row.format,
    title: row.title,
    status: row.status,
    category: categoryOf(row.status),
    priority: row.priority,
    progress: row.progress,
    authorId: row.author_id,
    assigneeId: row.assignee_id,
    requesterId: row.requester_id,
    stakeholderIds: extra.stakeholderIds,
    parentId: row.parent_id,
    dueDate: day(row.due_date),
    holdUntil: day(row.hold_until),
    closeReason: row.close_reason,
    tags: row.tags,
    thumbnail: row.thumbnail,
    pinnedAt: iso(row.pinned_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    resolvedAt: iso(row.resolved_at),
    commentCount: extra.commentCount,
    childCount: extra.childCount,
    childResolvedCount: extra.childResolvedCount,
    blocked: extra.blocked,
  };
}

export function permissionsOf(
  post: Pick<PostRow, "status">,
  roles: PostRoles,
): PostPermissions {
  const { status } = post;
  return {
    edit: canEdit(roles),
    transitions: reachableStatuses(status, roles),
    requestReview:
      status === "in_progress" && canTransition("requestReview", roles),
    approve: status === "in_review" && canTransition("approve", roles),
    reject: status === "in_review" && canTransition("reject", roles),
    reopen: categoryOf(status) === "closed" && canTransition("reopen", roles),
    delete: canDelete(roles),
  };
}

export async function loadDetail(
  ctx: OpCtx,
  post: PostRow,
  roles: PostRoles,
  actorId: string,
): Promise<PostDetail> {
  const [summary] = await loadSummaries(ctx, [post.id]);
  const refColumns = ["id", "key", "title", "status", "group_id"] as const;
  const [checklist, outgoing, incoming, parent, children, attachments, sub] =
    await Promise.all([
      ctx.db
        .selectFrom("checklist_items")
        .select(["id", "text", "done", "sort"])
        .where("post_id", "=", post.id)
        .orderBy("sort")
        .orderBy("id")
        .execute(),
      ctx.db
        .selectFrom("post_relations as r")
        .innerJoin("posts as o", "o.id", "r.to_id")
        .select([
          "r.kind",
          "o.id",
          "o.key",
          "o.title",
          "o.status",
          "o.group_id",
        ])
        .where("r.from_id", "=", post.id)
        .where("o.deleted_at", "is", null)
        .orderBy("o.key")
        .execute(),
      ctx.db
        .selectFrom("post_relations as r")
        .innerJoin("posts as o", "o.id", "r.from_id")
        .select([
          "r.kind",
          "o.id",
          "o.key",
          "o.title",
          "o.status",
          "o.group_id",
        ])
        .where("r.to_id", "=", post.id)
        .where("o.deleted_at", "is", null)
        .orderBy("o.key")
        .execute(),
      post.parent_id
        ? ctx.db
            .selectFrom("posts")
            .select(refColumns)
            .where("id", "=", post.parent_id)
            .where("deleted_at", "is", null)
            .executeTakeFirst()
        : undefined,
      ctx.db
        .selectFrom("posts")
        .select(refColumns)
        .where("parent_id", "=", post.id)
        .where("deleted_at", "is", null)
        .orderBy("seq")
        .execute(),
      ctx.db
        .selectFrom("attachments")
        .select(["id", "kind", "name", "url"])
        .where("post_id", "=", post.id)
        .orderBy("id")
        .execute(),
      ctx.db
        .selectFrom("post_subscribers")
        .select("muted")
        .where("post_id", "=", post.id)
        .where("user_id", "=", actorId)
        .executeTakeFirst(),
    ]);
  return {
    ...summary,
    body: post.body ?? null,
    payload: post.payload ?? null,
    reopenCount: post.reopen_count,
    checklist,
    relations: [
      ...outgoing.map((r) => ({
        kind: r.kind,
        direction: "outgoing" as const,
        post: toRef(r),
      })),
      ...incoming.map((r) => ({
        kind: r.kind,
        direction: "incoming" as const,
        post: toRef(r),
      })),
    ],
    parent: parent ? toRef(parent) : null,
    children: children.map(toRef),
    attachments,
    subscribed: !!sub && !sub.muted,
    permissions: permissionsOf(post, roles),
  };
}
