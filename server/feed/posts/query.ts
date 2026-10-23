// 목록 필터(PostFilter) → where 절. 배열은 필드 안에서 OR, 필드끼리 AND. 비어 있는 조건은 거르지 않는다.

import {
  type Expression,
  type ExpressionBuilder,
  type SelectQueryBuilder,
  type SqlBool,
  sql,
} from "kysely";
import type {
  PostFilter,
  PostQueryRequest,
} from "../../services/feed/modules/posts/schemas";
import { visibleGroupIds } from "../access";
import type { Actor, OpCtx } from "../context";
import type { FeedDatabase } from "../db";
import { localDay } from "../time";
import { OPEN_STATUSES, STATUS_ORDER, statusesOf } from "./workflow";

/** 'YYYY-MM-DD' → date 비교값 (date 컬럼은 읽으면 Date라 타입을 맞춘다) */
const asDay = (value: string) => sql<Date>`${value}::date`;

type PostsEb = ExpressionBuilder<FeedDatabase, "posts">;
type PostsQb<O> = SelectQueryBuilder<FeedDatabase, "posts", O>;

/** 지금 사용자가 그룹 관리자인 그룹. 시스템 관리자는 전부라 'all' */
async function adminGroupIds(ctx: OpCtx, actor: Actor) {
  if (actor.isAdmin) return "all" as const;
  const rows = await ctx.db
    .selectFrom("group_members")
    .select("group_id")
    .where("user_id", "=", actor.id)
    .where("role", "=", "admin")
    .execute();
  return rows.map((r) => r.group_id);
}

/** 승인할 사람 조건: 요청자, 요청자가 없으면 작성자, 또는 그룹 관리자 */
function reviewerWhere(
  eb: PostsEb,
  actor: Actor,
  admin: string[] | "all",
): Expression<SqlBool> {
  if (admin === "all") return eb.lit(true);
  const conds = [
    eb("posts.requester_id", "=", actor.id),
    eb.and([
      eb("posts.requester_id", "is", null),
      eb("posts.author_id", "=", actor.id),
    ]),
  ];
  if (admin.length) conds.push(eb("posts.group_id", "in", admin));
  return eb.or(conds);
}

/** 필터를 where 콜백으로. 볼 수 있는 그룹·지우지 않은 것은 항상 건다 */
export async function postWhere(ctx: OpCtx, actor: Actor, f: PostFilter) {
  const visible = await visibleGroupIds(ctx);
  const admin = f.mine === "review" ? await adminGroupIds(ctx, actor) : [];
  const today = localDay(ctx.now);
  return (eb: PostsEb) => {
    const conds: Expression<SqlBool>[] = [eb("posts.deleted_at", "is", null)];
    conds.push(
      visible.length ? eb("posts.group_id", "in", visible) : eb.lit(false),
    );
    if (f.groupIds?.length) conds.push(eb("posts.group_id", "in", f.groupIds));
    if (f.teamIds?.length) conds.push(eb("posts.team_id", "in", f.teamIds));
    if (f.statuses?.length) conds.push(eb("posts.status", "in", f.statuses));
    if (f.categories?.length) {
      const statuses = statusesOf(f.categories);
      conds.push(
        statuses.length ? eb("posts.status", "in", statuses) : eb.lit(false),
      );
    }
    if (f.priorities?.length)
      conds.push(eb("posts.priority", "in", f.priorities));
    if (f.assigneeIds?.length)
      conds.push(eb("posts.assignee_id", "in", f.assigneeIds));
    if (f.requesterIds?.length)
      conds.push(eb("posts.requester_id", "in", f.requesterIds));
    if (f.authorIds?.length)
      conds.push(eb("posts.author_id", "in", f.authorIds));
    if (f.postTypeIds?.length)
      conds.push(eb("posts.post_type_id", "in", f.postTypeIds));
    if (f.formats?.length) conds.push(eb("posts.format", "in", f.formats));
    if (f.stakeholderIds?.length) {
      const ids = f.stakeholderIds;
      conds.push(
        eb.exists(
          eb
            .selectFrom("post_stakeholders as s")
            .select("s.user_id")
            .whereRef("s.post_id", "=", "posts.id")
            .where("s.user_id", "in", ids),
        ),
      );
    }
    if (f.tags?.length)
      conds.push(
        eb.or(
          f.tags.map(
            (tag) => sql<SqlBool>`${tag} = any(${eb.ref("posts.tags")})`,
          ),
        ),
      );
    if (f.dueFrom) conds.push(eb("posts.due_date", ">=", asDay(f.dueFrom)));
    if (f.dueTo) conds.push(eb("posts.due_date", "<=", asDay(f.dueTo)));
    if (f.overdue)
      conds.push(
        eb("posts.status", "in", OPEN_STATUSES),
        eb("posts.due_date", "<", asDay(today)),
      );
    if (f.q?.trim()) {
      const pattern = `%${f.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      conds.push(
        eb.or([
          eb("posts.title", "ilike", pattern),
          eb(sql`${eb.ref("posts.body")}::text`, "ilike", pattern),
        ]),
      );
    }
    switch (f.mine) {
      case "assigned":
        conds.push(eb("posts.assignee_id", "=", actor.id));
        break;
      case "requested":
        conds.push(eb("posts.requester_id", "=", actor.id));
        break;
      case "review":
        conds.push(
          eb("posts.status", "=", "in_review"),
          reviewerWhere(eb, actor, admin),
        );
        break;
      case "stakeholder":
        conds.push(
          eb.exists(
            eb
              .selectFrom("post_stakeholders as s")
              .select("s.user_id")
              .whereRef("s.post_id", "=", "posts.id")
              .where("s.user_id", "=", actor.id),
          ),
        );
        break;
    }
    if (f.followedAuthors)
      conds.push(
        eb(
          "posts.author_id",
          "in",
          eb
            .selectFrom("user_follows")
            .select("followee_id")
            .where("follower_id", "=", actor.id),
        ),
      );
    if (f.parentId) {
      const parentId = f.parentId;
      conds.push(
        eb(
          "posts.parent_id",
          "in",
          eb
            .selectFrom("posts as pp")
            .select("pp.id")
            .where((e) =>
              e.or([e("pp.id", "=", parentId), e("pp.key", "=", parentId)]),
            ),
        ),
      );
    }
    return eb.and(conds);
  };
}

type Sort = Pick<PostQueryRequest, "sort" | "pinnedFirst">;

/** 정렬. 기한은 비어 있는 것을 끝에, 같으면 번호 큰 것부터 */
export function orderPosts<O>(qb: PostsQb<O>, { sort, pinnedFirst }: Sort) {
  const dir = sort.dir;
  if (pinnedFirst)
    qb = qb
      .orderBy(sql`${sql.ref("posts.pinned_at")} is null`)
      .orderBy("posts.pinned_at", "desc");
  switch (sort.field) {
    case "updatedAt":
      qb = qb.orderBy("posts.updated_at", dir);
      break;
    case "createdAt":
      qb = qb.orderBy("posts.created_at", dir);
      break;
    case "dueDate":
      qb = qb.orderBy("posts.due_date", (ob) =>
        (dir === "asc" ? ob.asc() : ob.desc()).nullsLast(),
      );
      break;
    case "priority":
      qb = qb.orderBy("posts.priority", dir);
      break;
    case "key":
      qb = qb
        .orderBy(sql`split_part(${sql.ref("posts.key")}, '-', 1)`, dir)
        .orderBy("posts.seq", dir);
      break;
    case "title":
      qb = qb.orderBy("posts.title", dir);
      break;
    case "status":
      qb = qb.orderBy(
        sql`array_position(array[${sql.join(STATUS_ORDER)}]::text[], ${sql.ref("posts.status")})`,
        dir,
      );
      break;
  }
  return qb.orderBy("posts.seq", "desc").orderBy("posts.key", "desc");
}

export async function countPosts(ctx: OpCtx, actor: Actor, f: PostFilter) {
  const row = await ctx.db
    .selectFrom("posts")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where(await postWhere(ctx, actor, f))
    .executeTakeFirstOrThrow();
  return Number(row.n);
}
