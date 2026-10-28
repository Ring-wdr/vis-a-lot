"use client";

// 날짜별 활동 로그. 날짜 머리(요일) 아래에 시각·게시물 키·문장. 키를 누르면 옆 패널로 연다.

import { eventText } from "@/entities/post/lib/event-text";
import type { ActivityReport } from "@/shared/api/feed/reports";
import type { StatusNames } from "@/shared/api/feed/types";
import { defineMessages, localeCached, useT } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/tw";
import { dayHeading } from "@/views/feed-report-activity/lib/period";

const clock = localeCached(
  (locale) =>
    new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
);

const messages = defineMessages({
  ko: {
    count: (n: number) => `${n}건`,
    /** 이름 뒤, 활동 문장 앞 */
    actorSuffix: "님이 ",
  },
  en: {
    count: (n: number) => `${n} ${n === 1 ? "event" : "events"}`,
    actorSuffix: " ",
  },
});

export function ActivityTimeline({
  days,
  userName,
  statusNames,
  onOpen,
  present = false,
}: {
  days: ActivityReport["days"];
  userName: (id: string | null) => string;
  statusNames?: StatusNames;
  onOpen: (key: string) => void;
  present?: boolean;
}) {
  const text = useT(messages);
  return (
    <ol className="flex flex-col gap-5">
      {days.map((day) => (
        <li key={day.date} className="flex flex-col gap-2">
          <h3
            className={cn(
              "z-sticky sticky top-0 flex items-baseline gap-2 border-b border-line bg-elevated py-1 font-semibold",
              present ? "text-base" : "text-sm",
            )}
          >
            <time dateTime={day.date}>{dayHeading(day.date)}</time>
            <span className="text-xs font-normal text-fg-muted tabular-nums">
              {text.count(day.entries.length)}
            </span>
          </h3>
          <ul className="flex flex-col gap-1.5">
            {day.entries.map(({ event, post }) => (
              <li
                key={event.id}
                className="grid grid-cols-[3rem_minmax(0,1fr)] items-baseline gap-2"
              >
                <time
                  dateTime={event.createdAt}
                  className="text-xs text-fg-muted tabular-nums"
                >
                  {clock().format(new Date(event.createdAt))}
                </time>
                <p className="min-w-0">
                  <button
                    type="button"
                    className="mr-1.5 cursor-pointer font-mono text-xs text-accent hover:underline"
                    onClick={() => onOpen(post.key)}
                  >
                    {post.key}
                  </button>
                  <span className="text-fg-secondary">{post.title}</span>
                  <span className="mx-1.5 text-fg-muted" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-semibold">
                    {userName(event.actorId)}
                  </span>
                  {text.actorSuffix}
                  {eventText(event, { userName, statusNames })}
                </p>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
