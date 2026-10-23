// 피드 posts 모듈: 게시물(이슈) 만들기·고치기·전이·관계·체크리스트·구독·목록.
// 전이 규칙은 posts/workflow.ts, 실행은 posts/status.ts, 목록 필터는 posts/query.ts.

import type { z } from "@hono/zod-openapi";
import { sql, type Updateable } from "kysely";
import type {
  BulkUpdateRequest,
  BulkUpdateResponse,
  CreatePostRequestSchema,
  FeedEvent,
  MyWorkSummary,
  PostDetail,
  PostQueryRequestSchema,
  PostSummary,
  TransitionRequest,
  UpdatePostRequest,
} from "../services/feed/modules/posts/schemas";
import { resolveGroup } from "./access";
import {
  type Actor,
  defineOps,
  FeedError,
  newId,
  type OpCtx,
  requireActor,
} from "./context";
import type { PostsTable, RelationKind } from "./db";
import { type EventInput, recordEvent } from "./events";
import {
  assertActiveUsers,
  assertInGroup,
  autoSubscribe,
  findPost,
  type PostRow,
  postRoles,
} from "./posts/load";
import { loadDetail, loadSummaries } from "./posts/mapper";
import { hasAutoProgress, recomputeProgress } from "./posts/progress";
import { countPosts, orderPosts, postWhere } from "./posts/query";
import { changeStatus } from "./posts/status";
import { canDelete, canEdit } from "./posts/workflow";
import { day, iso, localDay } from "./time";

type CreateArgs = z.input<typeof CreatePostRequestSchema>;
type QueryArgs = z.input<typeof PostQueryRequestSchema>;
type PostArgs = { postId: string };
type ItemArgs = PostArgs & { itemId: string };
type RelationArgs = PostArgs & { toId: string; kind: RelationKind };

async function detailOf(ctx: OpCtx, actor: Actor, idOrKey: string) {
  const post = await findPost(ctx, idOrKey);
  return loadDetail(ctx, post, await postRoles(ctx, post, actor), actor.id);
}

/** 고칠 수 있는 사람(작성자·담당자·요청자·이해관계자·그룹 관리자)만 통과 */
async function requireEditor(ctx: OpCtx, actor: Actor, post: PostRow) {
  if (!canEdit(await postRoles(ctx, post, actor)))
    throw new FeedError(403, "이 게시물을 고칠 권한이 없습니다");
}

const toJson = (value: unknown) =>
  value == null ? null : JSON.stringify(value);
const sameJson = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v) => b.includes(v));

async function stakeholdersOf(ctx: OpCtx, postId: string) {
  const rows = await ctx.db
    .selectFrom("post_stakeholders")
    .select("user_id")
    .where("post_id", "=", postId)
    .execute();
  return rows.map((r) => r.user_id);
}

/** 필드 고치기 (update·bulkUpdate 공용). 검증을 모두 마친 뒤 쓴다 */
async function applyUpdate(
  ctx: OpCtx,
  actor: Actor,
  post: PostRow,
  patch: UpdatePostRequest,
) {
  await requireEditor(ctx, actor, post);
  await assertActiveUsers(ctx, [
    patch.assigneeId,
    patch.requesterId,
    ...(patch.stakeholderIds ?? []),
  ]);
  await assertInGroup(ctx, post.group_id, patch);
  const changed = <T>(next: T | undefined, prev: T): next is T =>
    next !== undefined && next !== prev;
  if (
    changed(patch.progress, post.progress) &&
    (await hasAutoProgress(ctx, post.id))
  )
    throw new FeedError(
      400,
      "하위 이슈나 체크리스트가 있으면 진행률은 자동으로 계산됩니다",
    );

  const set: Updateable<PostsTable> = {};
  const events: EventInput[] = [];
  const involved: (string | null)[] = [];
  if (changed(patch.title, post.title)) set.title = patch.title;
  if (patch.body !== undefined && !sameJson(patch.body, post.body))
    set.body = toJson(patch.body);
  if (patch.payload !== undefined && !sameJson(patch.payload, post.payload))
    set.payload = toJson(patch.payload);
  if (changed(patch.thumbnail, post.thumbnail)) set.thumbnail = patch.thumbnail;
  if (changed(patch.format, post.format)) set.format = patch.format;
  if (changed(patch.postTypeId, post.post_type_id))
    set.post_type_id = patch.postTypeId;
  if (changed(patch.teamId, post.team_id)) set.team_id = patch.teamId;
  if (patch.tags && !sameSet(patch.tags, post.tags)) set.tags = patch.tags;
  if (changed(patch.requesterId, post.requester_id)) {
    set.requester_id = patch.requesterId;
    involved.push(patch.requesterId);
  }
  if (changed(patch.assigneeId, post.assignee_id)) {
    set.assignee_id = patch.assigneeId;
    involved.push(patch.assigneeId);
    events.push({
      postId: post.id,
      kind: "assignee",
      oldValue: post.assignee_id,
      newValue: patch.assigneeId,
    });
  }
  if (changed(patch.priority, post.priority)) {
    set.priority = patch.priority;
    events.push({
      postId: post.id,
      kind: "priority",
      oldValue: String(post.priority),
      newValue: String(patch.priority),
    });
  }
  const due = day(post.due_date);
  if (changed(patch.dueDate, due)) {
    set.due_date = patch.dueDate;
    events.push({
      postId: post.id,
      kind: "due",
      oldValue: due,
      newValue: patch.dueDate,
    });
  }
  if (changed(patch.progress, post.progress)) {
    set.progress = patch.progress;
    events.push({
      postId: post.id,
      kind: "progress",
      oldValue: String(post.progress),
      newValue: String(patch.progress),
    });
  }
  let stakeholdersChanged = false;
  if (patch.stakeholderIds) {
    const next = [...new Set(patch.stakeholderIds)];
    const prev = await stakeholdersOf(ctx, post.id);
    if (!sameSet(next, prev)) {
      stakeholdersChanged = true;
      await ctx.db
        .deleteFrom("post_stakeholders")
        .where("post_id", "=", post.id)
        .execute();
      if (next.length)
        await ctx.db
          .insertInto("post_stakeholders")
          .values(next.map((user_id) => ({ post_id: post.id, user_id })))
          .execute();
      involved.push(...next.filter((id) => !prev.includes(id)));
    }
  }
  if (Object.keys(set).length === 0 && !stakeholdersChanged) return;
  set.updated_at = ctx.now;
  await ctx.db
    .updateTable("posts")
    .set(set)
    .where("id", "=", post.id)
    .execute();
  // 새로 엮인 사람을 먼저 구독시켜 배정 알림을 받게 한다
  await autoSubscribe(ctx, post.id, involved);
  for (const event of events) await recordEvent(ctx, event);
}

async function touch(ctx: OpCtx, postId: string) {
  await ctx.db
    .updateTable("posts")
    .set({ updated_at: ctx.now })
    .where("id", "=", postId)
    .execute();
}

async function findItem(ctx: OpCtx, post: PostRow, itemId: string) {
  const item = await ctx.db
    .selectFrom("checklist_items")
    .selectAll()
    .where("id", "=", itemId)
    .where("post_id", "=", post.id)
    .executeTakeFirst();
  if (!item)
    throw new FeedError(404, `모르는 체크리스트 항목입니다: ${itemId}`);
  return item;
}

async function checklistEvent(
  ctx: OpCtx,
  postId: string,
  text: string,
  newValue: "done" | "undone" | "added" | "removed",
) {
  await recordEvent(ctx, { postId, kind: "checklist", field: text, newValue });
}

/** 관계 대상. 자기 자신은 400 */
async function relationTarget(ctx: OpCtx, post: PostRow, toId: string) {
  const other = await findPost(ctx, toId);
  if (other.id === post.id)
    throw new FeedError(400, "자기 자신과는 관계를 맺을 수 없습니다");
  return other;
}

export const postsOps = defineOps({
  "posts.query": async (
    ctx,
    args: QueryArgs = {},
  ): Promise<{ posts: PostSummary[]; total: number }> => {
    const actor = requireActor(ctx);
    const filter = args.filter ?? {};
    const where = await postWhere(ctx, actor, filter);
    const total = await countPosts(ctx, actor, filter);
    const rows = await orderPosts(
      ctx.db.selectFrom("posts").select("posts.id").where(where),
      {
        sort: args.sort ?? { field: "updatedAt", dir: "desc" },
        pinnedFirst: args.pinnedFirst ?? false,
      },
    )
      .limit(args.limit ?? 100)
      .offset(args.offset ?? 0)
      .execute();
    return {
      posts: await loadSummaries(
        ctx,
        rows.map((r) => r.id),
      ),
      total,
    };
  },

  "posts.mySummary": async (ctx): Promise<MyWorkSummary> => {
    const actor = requireActor(ctx);
    return {
      assigned: await countPosts(ctx, actor, {
        mine: "assigned",
        categories: ["open"],
      }),
      awaitingReview: await countPosts(ctx, actor, { mine: "review" }),
      dueSoon: await countPosts(ctx, actor, {
        mine: "assigned",
        categories: ["open"],
        dueTo: localDay(ctx.now, 3),
      }),
    };
  },

  "posts.get": async (ctx, args: PostArgs): Promise<PostDetail> =>
    detailOf(ctx, requireActor(ctx), args.postId),

  "posts.create": async (ctx, args: CreateArgs): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    // 볼 수 없는 그룹(비공개 그룹의 비멤버)은 404. 공개 그룹은 누구나 올린다
    const group = await resolveGroup(ctx, args.groupId);
    const stakeholderIds = [...new Set(args.stakeholderIds ?? [])];
    await assertActiveUsers(ctx, [
      args.assigneeId,
      args.requesterId,
      ...stakeholderIds,
    ]);
    await assertInGroup(ctx, group.id, args);
    if (args.parentId) {
      const parent = await findPost(ctx, args.parentId);
      if (parent.group_id !== group.id)
        throw new FeedError(400, "상위 이슈는 같은 그룹이어야 합니다");
      args = { ...args, parentId: parent.id };
    }

    const { next_seq } = await ctx.db
      .updateTable("groups")
      .set((eb) => ({ next_seq: eb("next_seq", "+", 1) }))
      .where("id", "=", group.id)
      .returning("next_seq")
      .executeTakeFirstOrThrow();
    const seq = next_seq - 1;
    const id = newId("p");
    await ctx.db
      .insertInto("posts")
      .values({
        id,
        group_id: group.id,
        seq,
        key: `${group.key_prefix}-${seq}`,
        team_id: args.teamId ?? null,
        post_type_id: args.postTypeId ?? null,
        format: args.format ?? "image",
        title: args.title,
        body: toJson(args.body),
        priority: args.priority ?? 2,
        author_id: actor.id,
        assignee_id: args.assigneeId ?? null,
        requester_id: args.requesterId ?? null,
        parent_id: args.parentId ?? null,
        due_date: args.dueDate ?? null,
        thumbnail: args.thumbnail ?? null,
        payload: toJson(args.payload),
        tags: args.tags ?? [],
        created_at: ctx.now,
        updated_at: ctx.now,
      })
      .execute();
    if (stakeholderIds.length)
      await ctx.db
        .insertInto("post_stakeholders")
        .values(stakeholderIds.map((user_id) => ({ post_id: id, user_id })))
        .execute();
    const checklist = args.checklist ?? [];
    if (checklist.length)
      await ctx.db
        .insertInto("checklist_items")
        .values(
          checklist.map((text, sort) => ({
            id: newId("ci"),
            post_id: id,
            text,
            sort,
          })),
        )
        .execute();
    const attachments = args.attachments ?? [];
    if (attachments.length)
      await ctx.db
        .insertInto("attachments")
        .values(attachments.map((a) => ({ id: newId("a"), post_id: id, ...a })))
        .execute();
    await autoSubscribe(ctx, id, [
      actor.id,
      args.assigneeId,
      args.requesterId,
      ...stakeholderIds,
    ]);
    await recordEvent(ctx, { postId: id, kind: "created" });
    if (args.assigneeId)
      await recordEvent(ctx, {
        postId: id,
        kind: "assignee",
        oldValue: null,
        newValue: args.assigneeId,
      });
    await recomputeProgress(ctx, args.parentId ?? null);
    return detailOf(ctx, actor, id);
  },

  "posts.update": async (
    ctx,
    args: PostArgs & UpdatePostRequest,
  ): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const { postId, ...patch } = args;
    const post = await findPost(ctx, postId);
    await applyUpdate(ctx, actor, post, patch);
    return detailOf(ctx, actor, post.id);
  },

  "posts.delete": async (ctx, args: PostArgs): Promise<void> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    if (!canDelete(await postRoles(ctx, post, actor)))
      throw new FeedError(403, "작성자나 그룹 관리자만 지울 수 있습니다");
    await ctx.db
      .updateTable("posts")
      .set({ deleted_at: ctx.now })
      .where("id", "=", post.id)
      .execute();
    await recomputeProgress(ctx, post.parent_id);
  },

  "posts.transition": async (
    ctx,
    args: PostArgs & TransitionRequest,
  ): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await changeStatus(ctx, actor, post, args);
    return detailOf(ctx, actor, post.id);
  },

  "posts.requestReview": async (ctx, args: PostArgs): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await changeStatus(ctx, actor, post, { to: "in_review" }, "requestReview");
    return detailOf(ctx, actor, post.id);
  },

  "posts.approve": async (ctx, args: PostArgs): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await changeStatus(ctx, actor, post, { to: "resolved" }, "approve");
    return detailOf(ctx, actor, post.id);
  },

  "posts.reject": async (
    ctx,
    args: PostArgs & { comment: string },
  ): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await changeStatus(
      ctx,
      actor,
      post,
      { to: "in_progress", comment: args.comment },
      "reject",
    );
    return detailOf(ctx, actor, post.id);
  },

  "posts.reopen": async (ctx, args: PostArgs): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await changeStatus(ctx, actor, post, { to: "unresolved" }, "reopen");
    return detailOf(ctx, actor, post.id);
  },

  "posts.pin": async (
    ctx,
    args: PostArgs & { on: boolean },
  ): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await ctx.db
      .updateTable("posts")
      .set({ pinned_at: args.on ? ctx.now : null })
      .where("id", "=", post.id)
      .execute();
    return detailOf(ctx, actor, post.id);
  },

  "posts.bulkUpdate": async (
    ctx,
    args: BulkUpdateRequest,
  ): Promise<BulkUpdateResponse> => {
    const actor = requireActor(ctx);
    const { status, ...fields } = args.patch;
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    ) as UpdatePostRequest;
    const result: BulkUpdateResponse = { updated: [], failed: [] };
    for (const id of args.ids) {
      // 게시물마다 savepoint: 하나가 실패해도 그 게시물의 쓰기만 되돌린다
      await sql`savepoint bulk_post`.execute(ctx.db);
      try {
        let post = await findPost(ctx, id);
        if (Object.keys(patch).length) {
          await applyUpdate(ctx, actor, post, patch);
          post = await findPost(ctx, post.id);
        }
        if (status && status !== post.status)
          await changeStatus(ctx, actor, post, { to: status });
        await sql`release savepoint bulk_post`.execute(ctx.db);
        result.updated.push(id);
      } catch (err) {
        await sql`rollback to savepoint bulk_post`.execute(ctx.db);
        await sql`release savepoint bulk_post`.execute(ctx.db);
        if (!(err instanceof FeedError)) throw err;
        result.failed.push({ id, error: err.message });
      }
    }
    return result;
  },

  "posts.setParent": async (
    ctx,
    args: PostArgs & { parentId: string | null },
  ): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await requireEditor(ctx, actor, post);
    const parent = args.parentId ? await findPost(ctx, args.parentId) : null;
    if (parent) {
      if (parent.id === post.id)
        throw new FeedError(400, "자기 자신을 상위로 둘 수 없습니다");
      if (parent.group_id !== post.group_id)
        throw new FeedError(400, "상위 이슈는 같은 그룹이어야 합니다");
      // 새 상위의 조상에 이 게시물이 있으면 순환
      let cursor: string | null = parent.parent_id;
      while (cursor) {
        if (cursor === post.id)
          throw new FeedError(400, "상위·하위가 순환합니다");
        const up = await ctx.db
          .selectFrom("posts")
          .select("parent_id")
          .where("id", "=", cursor)
          .executeTakeFirst();
        cursor = up?.parent_id ?? null;
      }
    }
    const nextId = parent?.id ?? null;
    if (nextId !== post.parent_id) {
      const old = post.parent_id
        ? await ctx.db
            .selectFrom("posts")
            .select("key")
            .where("id", "=", post.parent_id)
            .executeTakeFirst()
        : undefined;
      await ctx.db
        .updateTable("posts")
        .set({ parent_id: nextId, updated_at: ctx.now })
        .where("id", "=", post.id)
        .execute();
      await recordEvent(ctx, {
        postId: post.id,
        kind: "relation",
        field: "parent",
        oldValue: old?.key ?? null,
        newValue: parent?.key ?? null,
      });
      await recomputeProgress(ctx, post.parent_id);
      await recomputeProgress(ctx, nextId);
    }
    return detailOf(ctx, actor, post.id);
  },

  "posts.addRelation": async (ctx, args: RelationArgs): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await requireEditor(ctx, actor, post);
    const other = await relationTarget(ctx, post, args.toId);
    const inserted = await ctx.db
      .insertInto("post_relations")
      .values({ from_id: post.id, to_id: other.id, kind: args.kind })
      .onConflict((oc) => oc.doNothing())
      .returning("kind")
      .executeTakeFirst();
    if (inserted) {
      await touch(ctx, post.id);
      await recordEvent(ctx, {
        postId: post.id,
        kind: "relation",
        field: args.kind,
        newValue: other.key,
      });
    }
    return detailOf(ctx, actor, post.id);
  },

  "posts.removeRelation": async (
    ctx,
    args: RelationArgs,
  ): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await requireEditor(ctx, actor, post);
    const other = await relationTarget(ctx, post, args.toId);
    const removed = await ctx.db
      .deleteFrom("post_relations")
      .where("from_id", "=", post.id)
      .where("to_id", "=", other.id)
      .where("kind", "=", args.kind)
      .returning("kind")
      .executeTakeFirst();
    if (removed) {
      await touch(ctx, post.id);
      await recordEvent(ctx, {
        postId: post.id,
        kind: "relation",
        field: args.kind,
        oldValue: other.key,
      });
    }
    return detailOf(ctx, actor, post.id);
  },

  "posts.checklistAdd": async (
    ctx,
    args: PostArgs & { text: string },
  ): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await requireEditor(ctx, actor, post);
    const { max } = await ctx.db
      .selectFrom("checklist_items")
      .select((eb) => eb.fn.max("sort").as("max"))
      .where("post_id", "=", post.id)
      .executeTakeFirstOrThrow();
    await ctx.db
      .insertInto("checklist_items")
      .values({
        id: newId("ci"),
        post_id: post.id,
        text: args.text,
        sort: max == null ? 0 : Number(max) + 1,
      })
      .execute();
    await touch(ctx, post.id);
    await checklistEvent(ctx, post.id, args.text, "added");
    await recomputeProgress(ctx, post.id);
    return detailOf(ctx, actor, post.id);
  },

  "posts.checklistUpdate": async (
    ctx,
    args: ItemArgs & { text?: string; done?: boolean },
  ): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await requireEditor(ctx, actor, post);
    const item = await findItem(ctx, post, args.itemId);
    const text = args.text ?? item.text;
    const doneChanged = args.done !== undefined && args.done !== item.done;
    if (text !== item.text || doneChanged) {
      await ctx.db
        .updateTable("checklist_items")
        .set({ text, done: args.done ?? item.done })
        .where("id", "=", item.id)
        .execute();
      await touch(ctx, post.id);
    }
    if (doneChanged) {
      await checklistEvent(ctx, post.id, text, args.done ? "done" : "undone");
      await recomputeProgress(ctx, post.id);
    }
    return detailOf(ctx, actor, post.id);
  },

  "posts.checklistRemove": async (ctx, args: ItemArgs): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await requireEditor(ctx, actor, post);
    const item = await findItem(ctx, post, args.itemId);
    await ctx.db
      .deleteFrom("checklist_items")
      .where("id", "=", item.id)
      .execute();
    await touch(ctx, post.id);
    await checklistEvent(ctx, post.id, item.text, "removed");
    await recomputeProgress(ctx, post.id);
    return detailOf(ctx, actor, post.id);
  },

  "posts.checklistReorder": async (
    ctx,
    args: PostArgs & { ids: string[] },
  ): Promise<PostDetail> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await requireEditor(ctx, actor, post);
    const items = await ctx.db
      .selectFrom("checklist_items")
      .select("id")
      .where("post_id", "=", post.id)
      .orderBy("sort")
      .orderBy("id")
      .execute();
    const known = new Set(items.map((i) => i.id));
    const unknown = args.ids.find((id) => !known.has(id));
    if (unknown)
      throw new FeedError(400, `이 게시물의 항목이 아닙니다: ${unknown}`);
    // 빠진 항목은 원래 순서대로 뒤에 둔다
    const order = [
      ...new Set(args.ids),
      ...items.map((i) => i.id).filter((id) => !args.ids.includes(id)),
    ];
    for (const [sort, id] of order.entries())
      await ctx.db
        .updateTable("checklist_items")
        .set({ sort })
        .where("id", "=", id)
        .execute();
    await touch(ctx, post.id);
    return detailOf(ctx, actor, post.id);
  },

  "posts.subscribe": async (
    ctx,
    args: PostArgs & { on: boolean },
  ): Promise<{ subscribed: boolean }> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    // 끈 구독도 행(muted)으로 남겨 자동 구독이 되살리지 않게 한다
    await ctx.db
      .insertInto("post_subscribers")
      .values({ post_id: post.id, user_id: actor.id, muted: !args.on })
      .onConflict((oc) =>
        oc.columns(["post_id", "user_id"]).doUpdateSet({ muted: !args.on }),
      )
      .execute();
    return { subscribed: args.on };
  },

  "posts.events": async (
    ctx,
    args: PostArgs,
  ): Promise<{ events: FeedEvent[] }> => {
    requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    const rows = await ctx.db
      .selectFrom("events")
      .selectAll()
      .where("post_id", "=", post.id)
      .orderBy("created_at")
      // 한 트랜잭션의 이력은 시각이 같아 넣은 순서(ctid)로 가른다
      .orderBy(sql`ctid`)
      .execute();
    return {
      events: rows.map((e) => ({
        id: e.id,
        postId: e.post_id,
        actorId: e.actor_id,
        kind: e.kind,
        field: e.field,
        oldValue: e.old_value,
        newValue: e.new_value,
        commentId: e.comment_id,
        createdAt: iso(e.created_at),
      })),
    };
  },
});
