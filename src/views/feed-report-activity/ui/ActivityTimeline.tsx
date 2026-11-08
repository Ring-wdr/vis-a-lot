"use client";

// 날짜별 활동 로그. 날짜 머리(요일) 아래에 시각·게시물 키·문장. 키를 누르면 옆 패널로 연다.

import { Plural, Trans } from "@lingui/react/macro";
import { eventText } from "@/entities/post/lib/event-text";
import type { ActivityReport } from "@/shared/api/feed/reports";
import type { StatusNames } from "@/shared/api/feed/types";
import { localeCached, useLocale } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/tw";
import { dayHeading } from "@/views/feed-report-activity/lib/period";
import "../config/messages";

const clock = localeCached(
  (locale) =>
    new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
);

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
  // dayHeading·eventText는 컴포넌트 밖 t로 만든 문구라 언어 변경을 구독한다.
  useLocale();
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
              <Plural
                value={day.entries.length}
                other="#건"
                context="activity events in a day"
              />
            </span>
          </h3>
          <ul className="flex flex-col gap-1.5">
            {day.entries.map(({ event, post }) => {
              const actor = userName(event.actorId);
              const sentence = eventText(event, { userName, statusNames });
              return (
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
                    <Trans comment="활동 로그 한 줄. actor는 사람 이름, sentence는 활동 문장">
                      <span className="font-semibold">{actor}</span>님이{" "}
                      {sentence}
                    </Trans>
                  </p>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
