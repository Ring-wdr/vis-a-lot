// 알림 생성(dispatch). 구독자 × 이벤트 종류 × 알림 설정으로 notifications를 만들고,
// 슬랙·이메일은 outbox에 기록한다. 이벤트 종류 → 알림 종류 대응과 기본 설정도 여기 한 곳에 둔다.

import type {
  NotificationSetting,
  NotifyKind,
} from "../services/feed/modules/notifications/schemas";
import { newId, type OpCtx } from "./context";
import type { PostStatus } from "./db";
import type { EventKind, EventRecord } from "./events";

/** NotifyKindSchema와 같은 순서 (설정 화면 순서) */
export const NOTIFY_KINDS = [
  "assigned",
  "mention",
  "comment",
  "status",
  "review_requested",
  "approved",
  "rejected",
  "due_soon",
  "overdue",
  "hold_resumed",
  "unblocked",
  "children_resolved",
] as const satisfies readonly NotifyKind[];

const NOTIFY_KIND_OF: Partial<Record<EventKind, NotifyKind>> = {
  assignee: "assigned",
  mention: "mention",
  comment: "comment",
  status: "status",
  review_requested: "review_requested",
  approved: "approved",
  rejected: "rejected",
  due_soon: "due_soon",
  overdue: "overdue",
  hold_resumed: "hold_resumed",
  unblocked: "unblocked",
  children_resolved: "children_resolved",
};

/** 이벤트 종류 → 알림 종류. 알리지 않는 이벤트(created, priority 등)는 null */
export function notifyKindOf(eventKind: string): NotifyKind | null {
  return NOTIFY_KIND_OF[eventKind as EventKind] ?? null;
}

const SLACK_DEFAULT = new Set<NotifyKind>([
  "assigned",
  "mention",
  "review_requested",
  "rejected",
  "due_soon",
  "overdue",
]);

/** 저장하지 않은 설정의 기본값 (스펙 알림 표) */
export function defaultSetting(kind: NotifyKind): NotificationSetting {
  return {
    kind,
    inapp: true,
    slack: SLACK_DEFAULT.has(kind),
    email: kind === "overdue",
  };
}

/** scheduler가 만드는 이벤트. actorId가 작성자일 뿐이라 본인에게도 알린다 */
const SYSTEM_KINDS = new Set<NotifyKind>([
  "due_soon",
  "overdue",
  "hold_resumed",
]);
/** 구독자(와 extraRecipients)에게 가는 알림 */
const SUBSCRIBER_KINDS = new Set<NotifyKind>([
  "comment",
  "status",
  "approved",
  "rejected",
]);

const STATUS_LABELS: Record<PostStatus, string> = {
  unresolved: "미해결",
  in_progress: "진행 중",
  in_review: "검토 중",
  resolved: "해결됨",
  on_hold: "보류",
  cancelled: "취소",
};

type DispatchPost = {
  key: string;
  title: string;
  group_id: string;
  is_private: boolean;
  status_names: Partial<Record<PostStatus, string>>;
  author_id: string;
  assignee_id: string | null;
  requester_id: string | null;
};

async function recipientsOf(
  ctx: OpCtx,
  kind: NotifyKind,
  event: EventRecord,
  post: DispatchPost,
  extraRecipients: string[],
): Promise<string[]> {
  const owner = post.assignee_id ?? post.author_id;
  const reviewer = post.requester_id ?? post.author_id;
  const ids: (string | null)[] = [];
  switch (kind) {
    case "assigned":
      ids.push(event.newValue);
      break;
    case "mention":
      ids.push(...extraRecipients);
      break;
    case "review_requested":
    case "children_resolved":
      ids.push(reviewer);
      break;
    case "approved":
    case "rejected":
    case "due_soon":
    case "overdue":
    case "unblocked":
      ids.push(owner);
      break;
    case "hold_resumed":
      ids.push(post.assignee_id, post.author_id);
      break;
  }
  if (SUBSCRIBER_KINDS.has(kind)) {
    const subscribers = await ctx.db
      .selectFrom("post_subscribers")
      .select("user_id")
      .where("post_id", "=", event.postId)
      .where("muted", "=", false)
      .execute();
    ids.push(...subscribers.map((s) => s.user_id), ...extraRecipients);
  }
  const unique = new Set(ids.filter((id): id is string => !!id));
  if (!SYSTEM_KINDS.has(kind)) unique.delete(event.actorId);
  return [...unique];
}

function describe(
  kind: NotifyKind,
  event: EventRecord,
  actorName: string,
  post: DispatchPost,
) {
  const label = (status: string | null) =>
    status
      ? (post.status_names[status as PostStatus] ??
        STATUS_LABELS[status as PostStatus] ??
        status)
      : "";
  switch (kind) {
    case "assigned":
      return `${actorName}님이 담당자로 지정했습니다`;
    case "mention":
      return `${actorName}님이 언급했습니다`;
    case "comment":
      return `${actorName}님이 댓글을 남겼습니다`;
    case "status":
      return `${actorName}님이 상태를 ${label(event.oldValue)} → ${label(event.newValue)}(으)로 바꿨습니다`;
    case "review_requested":
      return `${actorName}님이 완료 승인을 요청했습니다`;
    case "approved":
      return `${actorName}님이 승인했습니다`;
    case "rejected":
      return `${actorName}님이 반려했습니다`;
    case "due_soon":
      return `기한이 다가옵니다${event.newValue ? ` (${event.newValue})` : ""}`;
    case "overdue":
      return `기한이 지났습니다${event.newValue ? ` (${event.newValue})` : ""}`;
    case "hold_resumed":
      return "보류 재개일이 되어 미해결로 돌아왔습니다";
    case "unblocked":
      return `${actorName}님의 변경으로 차단이 풀렸습니다`;
    case "children_resolved":
      return "하위 이슈가 모두 해결되어 검토 중이 되었습니다";
  }
}

export async function dispatchEvent(
  ctx: OpCtx,
  event: EventRecord,
  extraRecipients: string[],
): Promise<void> {
  const kind = notifyKindOf(event.kind);
  if (!kind) return;
  const post = await ctx.db
    .selectFrom("posts")
    .innerJoin("groups", "groups.id", "posts.group_id")
    .select([
      "posts.key",
      "posts.title",
      "posts.group_id",
      "groups.is_private",
      "groups.status_names",
      "posts.author_id",
      "posts.assignee_id",
      "posts.requester_id",
    ])
    .where("posts.id", "=", event.postId)
    .executeTakeFirst();
  if (!post) return;
  const ids = await recipientsOf(ctx, kind, event, post, extraRecipients);
  if (ids.length === 0) return;

  // 비활성 사용자와, 비공개 그룹에서 멤버가 아닌 사람은 뺀다
  let users = await ctx.db
    .selectFrom("users")
    .select(["id", "name", "email", "is_admin"])
    .where("id", "in", ids)
    .where("active", "=", true)
    .execute();
  if (post.is_private) {
    const members = new Set(
      (
        await ctx.db
          .selectFrom("group_members")
          .select("user_id")
          .where("group_id", "=", post.group_id)
          .execute()
      ).map((m) => m.user_id),
    );
    users = users.filter((u) => u.is_admin || members.has(u.id));
  }
  if (users.length === 0) return;

  const stored = new Map(
    (
      await ctx.db
        .selectFrom("notification_settings")
        .select(["user_id", "inapp", "slack", "email"])
        .where("event_kind", "=", kind)
        .where(
          "user_id",
          "in",
          users.map((u) => u.id),
        )
        .execute()
    ).map((s) => [s.user_id, s]),
  );
  const actor = await ctx.db
    .selectFrom("users")
    .select("name")
    .where("id", "=", event.actorId)
    .executeTakeFirst();
  const what = describe(kind, event, actor?.name ?? event.actorId, post);
  const link = `/feed/post?key=${encodeURIComponent(post.key)}`;
  const body = `[${post.key}] ${post.title}\n${what}\n${link}`;

  for (const user of users) {
    const setting = stored.get(user.id) ?? defaultSetting(kind);
    if (setting.inapp)
      await ctx.db
        .insertInto("notifications")
        .values({
          id: newId("n"),
          user_id: user.id,
          event_id: event.id,
          created_at: ctx.now,
        })
        .execute();
    const recipient = user.email ?? user.name;
    if (setting.slack)
      await ctx.db
        .insertInto("outbox")
        .values({
          id: newId("o"),
          channel: "slack",
          recipient,
          subject: null,
          body,
          created_at: ctx.now,
        })
        .execute();
    if (setting.email)
      await ctx.db
        .insertInto("outbox")
        .values({
          id: newId("o"),
          channel: "email",
          recipient,
          subject: `[${post.key}] ${what}`,
          body,
          created_at: ctx.now,
        })
        .execute();
  }
}
