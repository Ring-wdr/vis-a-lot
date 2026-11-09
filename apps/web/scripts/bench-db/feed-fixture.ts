// 벤치마크용 대량 피드 데이터. 기본 시나리오(수십 건)로는 실행 계획 차이가 드러나지 않아,
// 같은 스키마에 1년치·수만 건 규모의 행을 결정적 난수로 만들어 COPY로 넣는다.
// 행 수는 scale에 비례한다 (scale 1 = 게시물 5만, 이벤트 약 40만, 알림 약 100만).

import type { PGlite } from "@electric-sql/pglite";
import { createRandom } from "../../server/feed/seed/random";

const DAY = 86_400_000;
const STATUSES = [
  "unresolved",
  "in_progress",
  "in_review",
  "resolved",
  "on_hold",
  "cancelled",
] as const;
/** 오래된 게시물일수록 닫혀 있도록 상태 비율을 나이에 따라 바꾼다 */
const OPEN_WEIGHTS = [0.35, 0.3, 0.1, 0.15, 0.05, 0.05];
const OLD_WEIGHTS = [0.08, 0.05, 0.02, 0.75, 0.04, 0.06];
const FORMATS = ["chart", "image", "video", "code"] as const;
const EVENT_KINDS = [
  "status",
  "assignee",
  "priority",
  "due",
  "progress",
  "comment",
  "mention",
  "review_requested",
  "approved",
  "checklist",
  "due_soon",
  "overdue",
];
const WORDS =
  "센서 진동 온도 압력 전류 라인 설비 점검 교체 보고 대시보드 이상 경보 분석 리포트 배포 수정 개선 검토 데이터 모델 예측 품질 불량 공정 자동화 알림 차트 지표 추세".split(
    " ",
  );
const EMOJIS = ["👍", "🎉", "👀", "❤️"];

export type FixtureCounts = Record<string, number>;

export type FeedFixture = {
  counts: FixtureCounts;
  /** 벤치마크가 쓰는 사람·게시물 */
  actorId: string;
  adminId: string;
  groupIds: string[];
  privateGroupIds: string[];
  samplePostKeys: string[];
  now: Date;
};

/** COPY csv 한 칸. null은 빈 칸, 글자는 따옴표로 감싼다 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "t" : "f";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value))
    return cell(
      `{${value.map((v) => `"${String(v).replaceAll('"', '\\"')}"`).join(",")}}`,
    );
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
}

class TableBuffer {
  rows: string[] = [];
  constructor(
    readonly name: string,
    readonly columns: string[],
  ) {}
  push(...values: unknown[]) {
    this.rows.push(values.map(cell).join(","));
  }
  async copy(pglite: PGlite) {
    // 큰 테이블은 나눠 넣어 한 번에 만드는 Blob 크기를 줄인다
    const CHUNK = 100_000;
    for (let i = 0; i < this.rows.length; i += CHUNK) {
      const csv = `${this.rows.slice(i, i + CHUNK).join("\n")}\n`;
      await pglite.query(
        `copy feed.${this.name} (${this.columns.join(",")}) from '/dev/blob' with (format csv)`,
        [],
        { blob: new Blob([csv]) },
      );
    }
    return this.rows.length;
  }
}

const doc = (text: string, mention?: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text },
        ...(mention
          ? [{ type: "mention", attrs: { id: mention, label: mention } }]
          : []),
      ],
    },
  ],
});

export async function loadFeedFixture(
  pglite: PGlite,
  { scale = 1, now = new Date("2026-10-23T09:00:00+09:00") } = {},
): Promise<FeedFixture> {
  const random = createRandom(20261027);
  const nowMs = now.getTime();
  const pick = <T>(items: readonly T[]) => random.pick(items);
  const weighted = (weights: number[]) => {
    let r = random.next();
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  };
  const sentence = (n: number) =>
    Array.from({ length: n }, () => pick(WORDS)).join(" ");
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

  const nUsers = Math.round(1000 * Math.sqrt(scale));
  const nGroups = 20;
  const nPosts = Math.round(50_000 * scale);

  const t = {
    users: new TableBuffer("users", [
      "id",
      "name",
      "email",
      "is_admin",
      "active",
    ]),
    groups: new TableBuffer("groups", [
      "id",
      "name",
      "key_prefix",
      "description",
      "is_private",
      "next_seq",
      "created_by",
    ]),
    group_members: new TableBuffer("group_members", [
      "group_id",
      "user_id",
      "role",
    ]),
    teams: new TableBuffer("teams", ["id", "group_id", "name"]),
    post_types: new TableBuffer("post_types", [
      "id",
      "group_id",
      "name",
      "color",
      "sort",
    ]),
    posts: new TableBuffer("posts", [
      "id",
      "group_id",
      "seq",
      "key",
      "team_id",
      "post_type_id",
      "format",
      "title",
      "body",
      "status",
      "priority",
      "progress",
      "author_id",
      "assignee_id",
      "requester_id",
      "parent_id",
      "due_date",
      "hold_until",
      "tags",
      "pinned_at",
      "created_at",
      "updated_at",
      "resolved_at",
      "deleted_at",
    ]),
    post_stakeholders: new TableBuffer("post_stakeholders", [
      "post_id",
      "user_id",
    ]),
    post_subscribers: new TableBuffer("post_subscribers", [
      "post_id",
      "user_id",
      "muted",
    ]),
    checklist_items: new TableBuffer("checklist_items", [
      "id",
      "post_id",
      "text",
      "done",
      "sort",
    ]),
    post_relations: new TableBuffer("post_relations", [
      "from_id",
      "to_id",
      "kind",
    ]),
    attachments: new TableBuffer("attachments", [
      "id",
      "post_id",
      "kind",
      "name",
      "url",
    ]),
    user_follows: new TableBuffer("user_follows", [
      "follower_id",
      "followee_id",
    ]),
    comments: new TableBuffer("comments", [
      "id",
      "post_id",
      "author_id",
      "parent_id",
      "body",
      "resolved",
      "pinned",
      "created_at",
      "deleted_at",
    ]),
    reactions: new TableBuffer("reactions", ["comment_id", "user_id", "emoji"]),
    polls: new TableBuffer("polls", [
      "id",
      "comment_id",
      "question",
      "options",
      "closes_at",
    ]),
    poll_votes: new TableBuffer("poll_votes", [
      "poll_id",
      "user_id",
      "option_idx",
    ]),
    events: new TableBuffer("events", [
      "id",
      "post_id",
      "actor_id",
      "kind",
      "field",
      "old_value",
      "new_value",
      "comment_id",
      "created_at",
    ]),
    notifications: new TableBuffer("notifications", [
      "id",
      "user_id",
      "event_id",
      "read_at",
      "archived_at",
      "created_at",
    ]),
    outbox: new TableBuffer("outbox", [
      "id",
      "channel",
      "recipient",
      "subject",
      "body",
      "created_at",
    ]),
    saved_views: new TableBuffer("saved_views", [
      "id",
      "owner_id",
      "group_id",
      "name",
      "shared",
      "layout",
      "filter",
      "pinned",
    ]),
  };

  const users = Array.from({ length: nUsers }, (_, i) => `u${i + 1}`);
  for (const [i, id] of users.entries())
    t.users.push(
      id,
      `사용자${i + 1}`,
      `${id}@example.com`,
      i < 3,
      i % 50 !== 49,
    );
  const activeUsers = users.filter((_, i) => i % 50 !== 49);

  // 그룹: 4개 중 1개는 비공개. 사용자마다 멤버인 그룹 3개
  const groups = Array.from({ length: nGroups }, (_, i) => ({
    id: `g${i + 1}`,
    prefix: `G${String.fromCharCode(65 + i)}`,
    isPrivate: i % 4 === 3,
    members: new Set<string>(),
    teams: [] as string[],
    types: [] as string[],
    seq: 0,
  }));
  for (const u of users)
    for (const g of random.shuffle(groups).slice(0, 3)) g.members.add(u);
  for (const g of groups) {
    const [admin] = [...g.members];
    for (const u of g.members)
      t.group_members.push(g.id, u, u === admin ? "admin" : "member");
    for (let k = 0; k < 5; k++) {
      g.teams.push(`${g.id}_t${k}`);
      t.teams.push(`${g.id}_t${k}`, g.id, `팀 ${k + 1}`);
      g.types.push(`${g.id}_pt${k}`);
      t.post_types.push(`${g.id}_pt${k}`, g.id, `유형 ${k + 1}`, "#888888", k);
    }
  }
  for (const u of users)
    for (const f of random.shuffle(activeUsers).slice(0, 10))
      if (f !== u) t.user_follows.push(u, f);

  // 게시물: 1년치. 최근일수록 많다
  type P = {
    id: string;
    group: (typeof groups)[number];
    created: number;
    author: string;
    subscribers: string[];
    deleted: boolean;
  };
  const posts: P[] = [];
  const byGroup = new Map<string, P[]>();
  let eventSeq = 0;
  let notificationSeq = 0;
  let outboxSeq = 0;
  const memberList = new Map(groups.map((g) => [g.id, [...g.members]]));

  const addEvent = (
    post: P,
    kind: string,
    at: number,
    actor: string,
    commentId: string | null = null,
  ) => {
    const id = `e${++eventSeq}`;
    t.events.push(
      id,
      post.id,
      actor,
      kind,
      null,
      null,
      kind === "status" ? pick(STATUSES) : null,
      commentId,
      new Date(at),
    );
    // 구독자에게 알림 (본인 제외). 오래된 알림일수록 읽었다
    for (const user of post.subscribers) {
      if (user === actor) continue;
      const age = nowMs - at;
      const read = age > 7 * DAY ? random.next() < 0.95 : random.next() < 0.4;
      const archived = read && age > 60 * DAY && random.next() < 0.5;
      t.notifications.push(
        `n${++notificationSeq}`,
        user,
        id,
        read ? new Date(at + 3_600_000) : null,
        archived ? new Date(at + 7_200_000) : null,
        new Date(at),
      );
      if (random.next() < 0.08)
        t.outbox.push(
          `o${++outboxSeq}`,
          "slack",
          `${user}@example.com`,
          null,
          `[${post.id}] ${kind}`,
          new Date(at),
        );
    }
  };

  for (let i = 0; i < nPosts; i++) {
    const group = groups[Math.floor(random.next() ** 1.3 * nGroups)];
    const members = memberList.get(group.id) as string[];
    const ageDays = 365 * random.next() ** 2;
    const created = nowMs - ageDays * DAY - random.int(0, DAY);
    const status =
      STATUSES[weighted(ageDays > 30 ? OLD_WEIGHTS : OPEN_WEIGHTS)];
    const author = pick(members);
    const assignee = random.next() < 0.85 ? pick(members) : null;
    const requester = random.next() < 0.3 ? pick(members) : null;
    const seq = ++group.seq;
    const id = `p${i + 1}`;
    const siblings = byGroup.get(group.id) ?? [];
    const parent =
      siblings.length > 10 && random.next() < 0.1 ? pick(siblings).id : null;
    const updated = Math.min(
      nowMs,
      created + random.int(0, 30) * DAY * random.next(),
    );
    const closed = status === "resolved" || status === "cancelled";
    const subscribers = [
      ...new Set(
        [
          author,
          assignee,
          requester,
          ...random.shuffle(members).slice(0, 2),
        ].filter((u): u is string => !!u),
      ),
    ];
    const deleted = random.next() < 0.03;
    const post: P = { id, group, created, author, subscribers, deleted };
    posts.push(post);
    siblings.push(post);
    byGroup.set(group.id, siblings);

    t.posts.push(
      id,
      group.id,
      seq,
      `${group.prefix}-${seq}`,
      random.next() < 0.7 ? pick(group.teams) : null,
      random.next() < 0.8 ? pick(group.types) : null,
      pick(FORMATS),
      sentence(random.int(3, 7)),
      doc(sentence(random.int(8, 40))),
      status,
      random.int(0, 4),
      closed ? 100 : random.int(0, 90),
      author,
      assignee,
      requester,
      parent,
      random.next() < 0.6 ? day(created + random.int(-5, 40) * DAY) : null,
      status === "on_hold" && random.next() < 0.5
        ? day(nowMs + random.int(-3, 20) * DAY)
        : null,
      random.shuffle(WORDS).slice(0, random.int(0, 3)),
      random.next() < 0.002 ? new Date(updated) : null,
      new Date(created),
      new Date(updated),
      status === "resolved" ? new Date(updated) : null,
      deleted ? new Date(updated) : null,
    );
    for (const u of random.shuffle(members).slice(0, random.int(0, 2)))
      t.post_stakeholders.push(id, u);
    for (const u of subscribers)
      t.post_subscribers.push(id, u, random.next() < 0.05);
    for (let k = 0, n = random.int(0, 4); k < n; k++)
      t.checklist_items.push(
        `${id}_ci${k}`,
        id,
        sentence(3),
        random.next() < 0.5,
        k,
      );
    if (siblings.length > 5 && random.next() < 0.15) {
      const other = pick(siblings);
      if (other.id !== id)
        t.post_relations.push(
          id,
          other.id,
          pick(["blocks", "relates", "duplicate"]),
        );
    }
    if (random.next() < 0.3)
      t.attachments.push(
        `${id}_a`,
        id,
        "link",
        "참고 링크",
        "https://example.com",
      );

    // 이력과 알림
    addEvent(post, "created", created, author);
    for (let k = 0, n = random.int(2, 10); k < n; k++)
      addEvent(
        post,
        pick(EVENT_KINDS),
        created + random.next() * (updated - created),
        pick(members),
      );

    // 댓글 (대댓글 20%)
    const roots: string[] = [];
    for (let k = 0, n = random.int(0, 8); k < n; k++) {
      const cid = `${id}_c${k}`;
      const at = created + random.next() * (updated - created);
      const commenter = pick(members);
      const parentId = roots.length && random.next() < 0.2 ? pick(roots) : null;
      if (!parentId) roots.push(cid);
      t.comments.push(
        cid,
        id,
        commenter,
        parentId,
        doc(
          sentence(random.int(4, 20)),
          random.next() < 0.1 ? pick(members) : undefined,
        ),
        false,
        false,
        new Date(at),
        random.next() < 0.02 ? new Date(at) : null,
      );
      for (const u of random.shuffle(members).slice(0, random.int(0, 2)))
        t.reactions.push(cid, u, pick(EMOJIS));
      if (!parentId && random.next() < 0.01) {
        t.polls.push(
          `${cid}_poll`,
          cid,
          "어느 쪽?",
          JSON.stringify(["A", "B", "C"]),
          null,
        );
        for (const u of random.shuffle(members).slice(0, 5))
          t.poll_votes.push(`${cid}_poll`, u, random.int(0, 2));
      }
      addEvent(post, "comment", at, commenter, cid);
    }
  }

  for (const g of groups)
    t.groups.push(
      g.id,
      `그룹 ${g.prefix}`,
      g.prefix,
      null,
      g.isPrivate,
      g.seq + 1,
      null,
    );
  for (const [i, u] of users.entries())
    for (let k = 0; k < 3; k++) {
      const g = pick(groups);
      t.saved_views.push(
        `v_${u}_${k}`,
        u,
        g.id,
        `뷰 ${k + 1}`,
        i % 5 === 0,
        pick(["feed", "list", "board"]),
        { statuses: ["in_progress"] },
        k === 0,
      );
    }

  const counts: FixtureCounts = {};
  // FK 순서대로 넣는다
  const order: (keyof typeof t)[] = [
    "users",
    "groups",
    "group_members",
    "teams",
    "post_types",
    "posts",
    "post_stakeholders",
    "post_subscribers",
    "checklist_items",
    "post_relations",
    "attachments",
    "user_follows",
    "comments",
    "reactions",
    "polls",
    "poll_votes",
    "events",
    "notifications",
    "outbox",
    "saved_views",
  ];
  for (const name of order) counts[name] = await t[name].copy(pglite);

  // 일반 사용자 중 비공개 그룹 멤버인 사람을 행위자로 고른다
  const privateGroups = groups.filter((g) => g.isPrivate);
  const actorId =
    users
      .slice(3)
      .find(
        (u) =>
          privateGroups.some((g) => g.members.has(u)) &&
          activeUsers.includes(u),
      ) ?? "u10";
  const visible = groups.filter((g) => !g.isPrivate || g.members.has(actorId));
  const recent = posts
    .filter((p) => !p.deleted && visible.includes(p.group))
    .sort((a, b) => b.created - a.created);
  return {
    counts,
    actorId,
    adminId: "u1",
    groupIds: groups.map((g) => g.id),
    privateGroupIds: privateGroups.map((g) => g.id),
    samplePostKeys: [0.0001, 0.1, 0.8]
      .map((q) => recent[Math.floor(q * recent.length)])
      .map(
        (p) =>
          `${p.group.prefix}-${posts.filter((q) => q.group === p.group).indexOf(p) + 1}`,
      ),
    now,
  };
}
