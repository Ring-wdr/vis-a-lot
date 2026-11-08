"use client";

import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useClock, useSetClock } from "@/shared/api/feed/queries";
import { localeCached, useLocale } from "@/shared/lib/i18n";
import { useNow } from "@/shared/lib/use-now";
import { button } from "@/shared/ui/button";
import { page } from "@/shared/ui/feed-styles";
import { LoadingText } from "@/shared/ui/Loading";
import "../config/messages";

const p = page();
const DAY_MS = 86_400_000;

const dateTime = localeCached(
  (l) => new Intl.DateTimeFormat(l, { dateStyle: "full", timeStyle: "medium" }),
);

/** 오프셋을 "+3일 2시간"처럼 */
export function formatOffset(ms: number) {
  if (ms === 0) return t`없음 (실제 시각)`;
  const sign = ms > 0 ? "+" : "-";
  const abs = Math.abs(ms);
  const days = Math.floor(abs / DAY_MS);
  const hours = Math.floor((abs % DAY_MS) / 3_600_000);
  const minutes = Math.round((abs % 3_600_000) / 60_000);
  const parts = [
    days && plural(days, { other: "#일" }),
    hours && plural(hours, { other: "#시간" }),
    minutes && plural(minutes, { other: "#분" }),
  ].filter(Boolean);
  return `${sign}${parts.join(" ") || t`1분 미만`}`;
}

/** 로컬 날짜 YYYY-MM-DD */
const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** /feed/dev/clock: 피드의 "오늘"을 앞뒤로 옮겨 기한 알림·보류 복귀를 바로 확인한다. */
export function ClockView() {
  // formatOffset·dateTime은 컴포넌트 밖에서 지금 언어를 읽어 언어 변경을 구독한다.
  useLocale();
  const clock = useClock();
  const setClock = useSetClock();
  // 1초마다 다시 그려 피드의 "지금"을 흘러가게 보여준다.
  const now = useNow();

  const offset = clock.data?.offsetMs ?? 0;
  const feedNow = new Date(now + offset);
  const shift = (ms: number) => setClock.mutate(offset + ms);

  return (
    <div className={p.root()}>
      <h1 className={p.title()}>
        <Trans context="dev clock page title">시계</Trans>
      </h1>
      <p className={p.lead()}>
        <Trans>
          피드 서비스의 "지금"을 옮깁니다. 바꾸면 피드 데이터를 다시 받고
          scheduler(기한 알림·보류 복귀)를 한 번 돌립니다.
        </Trans>
      </p>

      <section className={p.section()} aria-busy={setClock.isPending}>
        {clock.isPending ? (
          <LoadingText>
            <Trans>시계를 불러오는 중</Trans>
          </LoadingText>
        ) : clock.isError ? (
          <p role="alert" className="text-danger">
            <Trans>시계를 불러오지 못했습니다: {clock.error.message}</Trans>
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-fg-muted">
              <Trans>피드의 지금</Trans>
            </dt>
            <dd className="font-semibold tabular-nums">
              {dateTime().format(feedNow)}
            </dd>
            <dt className="text-fg-muted">
              <Trans>오프셋</Trans>
            </dt>
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
            <Trans>-1일</Trans>
          </button>
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={setClock.isPending}
            onClick={() => shift(DAY_MS)}
          >
            <Trans>+1일</Trans>
          </button>
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={setClock.isPending}
            onClick={() => shift(7 * DAY_MS)}
          >
            <Trans>+7일</Trans>
          </button>
          <button
            type="button"
            className={button({ variant: "primary", size: "sm" })}
            disabled={setClock.isPending || offset === 0}
            onClick={() => setClock.mutate(0)}
          >
            <Trans>실제 시각으로</Trans>
          </button>
        </div>

        <label className="flex flex-wrap items-center gap-2">
          <span className="text-fg-secondary">
            <Trans>날짜로 이동</Trans>
          </span>
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
            <Trans>시계를 바꾸지 못했습니다: {setClock.error.message}</Trans>
          </p>
        )}
      </section>
    </div>
  );
}
