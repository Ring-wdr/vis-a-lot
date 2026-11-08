"use client";

import { useClock, useSetClock } from "@/shared/api/feed/queries";
import { defineMessages, localeCached, t, useT } from "@/shared/lib/i18n";
import { useNow } from "@/shared/lib/use-now";
import { button } from "@/shared/ui/button";
import { page } from "@/shared/ui/feed-styles";
import { LoadingText } from "@/shared/ui/Loading";

const p = page();
const DAY_MS = 86_400_000;

const dateTime = localeCached(
  (l) => new Intl.DateTimeFormat(l, { dateStyle: "full", timeStyle: "medium" }),
);

const messages = defineMessages({
  ko: {
    noOffset: "없음 (실제 시각)",
    days: (n: number) => `${n}일`,
    hours: (n: number) => `${n}시간`,
    minutes: (n: number) => `${n}분`,
    underMinute: "1분 미만",
    title: "시계",
    lead: '피드 서비스의 "지금"을 옮깁니다. 바꾸면 피드 데이터를 다시 받고 scheduler(기한 알림·보류 복귀)를 한 번 돌립니다.',
    loading: "시계를 불러오는 중",
    loadFailed: (error: string) => `시계를 불러오지 못했습니다: ${error}`,
    feedNow: "피드의 지금",
    offset: "오프셋",
    minusDay: "-1일",
    plusDay: "+1일",
    plusWeek: "+7일",
    realTime: "실제 시각으로",
    goToDate: "날짜로 이동",
    setFailed: (error: string) => `시계를 바꾸지 못했습니다: ${error}`,
  },
  en: {
    noOffset: "None (real time)",
    days: (n: number) => `${n}d`,
    hours: (n: number) => `${n}h`,
    minutes: (n: number) => `${n}m`,
    underMinute: "under 1m",
    title: "Clock",
    lead: 'Shifts the feed service\'s "now". Changing it refetches feed data and runs the scheduler (due reminders, hold resumes) once.',
    loading: "Loading clock",
    loadFailed: (error: string) => `Couldn't load the clock: ${error}`,
    feedNow: "Feed now",
    offset: "Offset",
    minusDay: "-1 day",
    plusDay: "+1 day",
    plusWeek: "+7 days",
    realTime: "Real time",
    goToDate: "Go to date",
    setFailed: (error: string) => `Couldn't change the clock: ${error}`,
  },
});

/** 오프셋을 "+3일 2시간"처럼 */
export function formatOffset(ms: number) {
  const text = t(messages);
  if (ms === 0) return text.noOffset;
  const sign = ms > 0 ? "+" : "-";
  const abs = Math.abs(ms);
  const days = Math.floor(abs / DAY_MS);
  const hours = Math.floor((abs % DAY_MS) / 3_600_000);
  const minutes = Math.round((abs % 3_600_000) / 60_000);
  const parts = [
    days && text.days(days),
    hours && text.hours(hours),
    minutes && text.minutes(minutes),
  ].filter(Boolean);
  return `${sign}${parts.join(" ") || text.underMinute}`;
}

/** 로컬 날짜 YYYY-MM-DD */
const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** /feed/dev/clock: 피드의 "오늘"을 앞뒤로 옮겨 기한 알림·보류 복귀를 바로 확인한다. */
export function ClockView() {
  const text = useT(messages);
  const clock = useClock();
  const setClock = useSetClock();
  // 1초마다 다시 그려 피드의 "지금"을 흘러가게 보여준다.
  const now = useNow();

  const offset = clock.data?.offsetMs ?? 0;
  const feedNow = new Date(now + offset);
  const shift = (ms: number) => setClock.mutate(offset + ms);

  return (
    <div className={p.root()}>
      <h1 className={p.title()}>{text.title}</h1>
      <p className={p.lead()}>{text.lead}</p>

      <section className={p.section()} aria-busy={setClock.isPending}>
        {clock.isPending ? (
          <LoadingText>{text.loading}</LoadingText>
        ) : clock.isError ? (
          <p role="alert" className="text-danger">
            {text.loadFailed(clock.error.message)}
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-fg-muted">{text.feedNow}</dt>
            <dd className="font-semibold tabular-nums">
              {dateTime().format(feedNow)}
            </dd>
            <dt className="text-fg-muted">{text.offset}</dt>
            <dd className="tabular-nums">{formatOffset(offset)}</dd>
          </dl>
        )}

        <div className={p.row()}>
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={setClock.isPending}
            onClick={() => shift(-DAY_MS)}
          >
            {text.minusDay}
          </button>
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={setClock.isPending}
            onClick={() => shift(DAY_MS)}
          >
            {text.plusDay}
          </button>
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={setClock.isPending}
            onClick={() => shift(7 * DAY_MS)}
          >
            {text.plusWeek}
          </button>
          <button
            type="button"
            className={button({ variant: "primary", size: "sm" })}
            disabled={setClock.isPending || offset === 0}
            onClick={() => setClock.mutate(0)}
          >
            {text.realTime}
          </button>
        </div>

        <label className="flex flex-wrap items-center gap-2">
          <span className="text-fg-secondary">{text.goToDate}</span>
          <input
            type="date"
            className="h-7.5 rounded-md border border-line bg-elevated px-2"
            value={toDateInput(feedNow)}
            disabled={setClock.isPending || clock.isPending}
            onChange={(e) => {
              const [y, m, d] = e.currentTarget.value.split("-").map(Number);
              if (!y || !m || !d) return;
              // 시각은 그대로 두고 날짜만 바꾼다.
              const target = new Date(feedNow);
              target.setFullYear(y, m - 1, d);
              setClock.mutate(target.getTime() - Date.now());
            }}
          />
        </label>

        {setClock.isError && (
          <p role="alert" className="text-danger">
            {text.setFailed(setClock.error.message)}
          </p>
        )}
      </section>
    </div>
  );
}
