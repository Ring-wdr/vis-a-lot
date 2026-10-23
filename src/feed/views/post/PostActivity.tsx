"use client";

// 첨부 목록, 댓글 자리, 활동 로그 타임라인(변경 이력을 문장으로).

import { Clock, FileText, Link2, MessageSquare } from "lucide-react";
import { useUserMap } from "@/feed/api/lookups";
import { usePostEvents } from "@/feed/api/post-queries";
import { useClock } from "@/feed/api/queries";
import type { Group } from "@/feed/api/types";
import { Avatar } from "@/feed/ui/UserSwitcher";
import { LoadingText, Skeleton } from "@/shared/ui/Loading";
import type { PostDetail } from "./detail-type";
import { eventSentence, isSystemEvent } from "./event-text";
import { detail } from "./styles";
import { dateTime, relativeTime } from "./time";

const d = detail();

export function PostAttachments({ post }: { post: PostDetail }) {
  if (post.attachments.length === 0) return null;
  return (
    <section className={d.section()} aria-labelledby="post-attachments-title">
      <h2 id="post-attachments-title" className={d.sectionTitle()}>
        첨부{" "}
        <span className="font-normal text-fg-muted">
          {post.attachments.length}
        </span>
      </h2>
      <ul className={d.list()}>
        {post.attachments.map((a) => {
          const Icon = a.kind === "link" ? Link2 : FileText;
          return (
            <li key={a.id}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-7.5 min-w-0 items-center gap-2 rounded-md px-1.5 text-accent hover:bg-panel"
              >
                <Icon size={14} className="flex-none" aria-hidden="true" />
                <span className="min-w-0 truncate">{a.name}</span>
                <span className="ml-auto min-w-0 truncate text-2xs text-fg-muted">
                  {a.url}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function PostComments() {
  return (
    <section className={d.section()} aria-labelledby="post-comments-title">
      <h2 id="post-comments-title" className={d.sectionTitle()}>
        댓글
      </h2>
      <p className="flex items-center gap-2 rounded-lg border border-dashed border-line p-3 text-xs text-fg-muted">
        <MessageSquare size={14} aria-hidden="true" />
        댓글(대댓글·반응·멘션)은 다음 단계에서 붙입니다.
      </p>
    </section>
  );
}

export function PostActivity({
  post,
  group,
}: {
  post: PostDetail;
  group: Group | undefined;
}) {
  const events = usePostEvents(post.key);
  const users = useUserMap();
  const userName = (id: string | null) =>
    id ? (users.get(id)?.name ?? id) : "알 수 없음";
  // 피드의 "지금" (/feed/dev/clock 오프셋 반영)
  const now = Date.now() + (useClock().data?.offsetMs ?? 0);
  // 최근 것이 위로
  const rows = [...(events.data ?? [])].reverse();

  return (
    <section className={d.section()} aria-labelledby="post-activity-title">
      <h2 id="post-activity-title" className={d.sectionTitle()}>
        활동 로그
      </h2>
      {events.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <LoadingText>활동을 불러오는 중</LoadingText>
          <Skeleton width={70} />
          <Skeleton width={50} />
        </div>
      ) : events.isError ? (
        <p role="alert" className={d.error()}>
          활동을 불러오지 못했습니다: {events.error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className={d.hint()}>아직 활동이 없습니다.</p>
      ) : (
        <ol className="flex flex-col" aria-label="활동 로그">
          {rows.map((e) => (
            <li key={e.id} className="relative flex gap-2.5 pb-3 last:pb-0">
              {/* 세로 줄 */}
              <span
                className="absolute top-6 bottom-0 left-3 w-px bg-line"
                aria-hidden="true"
              />
              {isSystemEvent(e) ? (
                <span
                  className="inline-grid size-6 flex-none place-items-center rounded-full bg-panel text-2xs text-fg-muted"
                  aria-hidden="true"
                >
                  <Clock size={12} />
                </span>
              ) : (
                <Avatar name={userName(e.actorId)} />
              )}
              <p className="min-w-0 flex-1 pt-0.5 text-ui leading-snug">
                {eventSentence(e, {
                  userName,
                  statusNames: group?.statusNames,
                })}
                <time
                  className="ml-1.5 text-2xs whitespace-nowrap text-fg-muted"
                  dateTime={e.createdAt}
                  title={dateTime.format(new Date(e.createdAt))}
                >
                  {relativeTime(e.createdAt, now)}
                </time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
