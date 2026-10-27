"use client";

// 활동 로그 타임라인(변경 이력을 문장으로).

import { Clock } from "lucide-react";
import { eventSentence, isSystemEvent } from "@/entities/post/lib/event-text";
import { detail } from "@/entities/post/ui/styles";
import { useUserMap } from "@/shared/api/feed/lookups";
import { usePostEvents } from "@/shared/api/feed/post-queries";
import { useFeedNow } from "@/shared/api/feed/queries";
import type { Group } from "@/shared/api/feed/types";
import { dateTime, relativeTime } from "@/shared/lib/time";
import { Avatar } from "@/shared/ui/Avatar";
import { LoadingText, Skeleton } from "@/shared/ui/Loading";
import type { PostDetail } from "@/widgets/post-detail/model/detail-type";

const d = detail();

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
  const now = useFeedNow();
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
