"use client";

// 현황 보고 (/feed/report/status?g=FD): 상단 숫자(열림·멈춤·닫힘, 기한 초과, 검토 대기, 30일 리드타임),
// 상태 분포 막대, 담당자별 부하 막대, 하단에 열린·멈춘 게시물 목록. 팀으로 거른다(?team=).

import { plural } from "@lingui/core/macro";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { ListX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  RouteGroupFallback,
  useRouteGroup,
} from "@/entities/group/ui/route-group";
import { statusLabel } from "@/entities/post/lib/labels";
import { PostTable } from "@/entities/post/ui/PostTable";
import { useUserName } from "@/entities/post/ui/post-meta";
import { usePresentNav } from "@/features/present-mode/model/present-nav";
import { useStatusReport } from "@/shared/api/feed/report-queries";
import type { StatusReport } from "@/shared/api/feed/reports";
import type { PostStatus, StatusNames } from "@/shared/api/feed/types";
import { type Locale, useLocale } from "@/shared/lib/i18n";
import { useOpenPeek } from "@/shared/lib/peek";
import { cn } from "@/shared/lib/tw";
import { EmptyState } from "@/shared/ui/Loading";
import { Select } from "@/shared/ui/Select";
import {
  type DeckItem,
  PresentDeck,
} from "@/widgets/present-deck/ui/PresentDeck";
import {
  BarRow,
  Legend,
  ReportError,
  ReportHeader,
  ReportSkeleton,
  report,
  StatTile,
} from "@/widgets/report-layout/ui/report-ui";
import "../config/messages";

const ALL = "_all";

/** 상태 분포 막대의 칠. 열림은 accent 계열, 멈춤·닫힘은 중립 */
const STATUS_FILL: Record<PostStatus, string> = {
  unresolved: "bg-accent/30",
  in_progress: "bg-accent/60",
  in_review: "bg-accent",
  on_hold: "bg-fg-muted",
  resolved: "bg-fg-secondary",
  cancelled: "bg-line-strong",
};

/** 숫자 칸의 단위. 영어는 단위 없이 숫자만 쓴다 (번역할 문구가 없어 언어별로 둔다) */
const COUNT_UNIT: Record<Locale, string | undefined> = {
  ko: "건",
  en: undefined,
};

export function StatusReportView() {
  const { t } = useLingui();
  const route = useRouteGroup();
  const { group, detail } = route;
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const teamId = search.get("team") || undefined;
  const { present, slide } = usePresentNav();
  const openPeek = useOpenPeek();
  const name = useUserName();

  const query = useStatusReport(group ? { groupId: group.id, teamId } : null);
  const data = query.data;
  const deck = useMemo<DeckItem[]>(
    () => data?.posts.map((p) => ({ key: p.key })) ?? [],
    [data],
  );

  if (!group) return <RouteGroupFallback state={route} />;
  const r = report({ present });
  const teams = detail?.teams ?? [];
  const teamName = teams.find((x) => x.id === teamId)?.name;
  const groupName = group.name;
  const title = t`${groupName} 현황 보고`;

  function setTeam(next: string) {
    const q = new URLSearchParams(search);
    if (next === ALL) q.delete("team");
    else q.set("team", next);
    router.replace(`${pathname}?${q}`, { scroll: false });
  }

  if (present && slide !== null && data)
    return <PresentDeck items={deck} title={title} />;

  return (
    <div className={r.root()}>
      <ReportHeader
        title={title}
        subtitle={
          teamName ? t`${teamName} · 지금 기준` : t`모든 팀 · 지금 기준`
        }
        slideCount={deck.length}
      >
        {!present && teams.length > 0 && (
          <div className="w-36">
            <Select
              label={t`팀`}
              value={teamId ?? ALL}
              options={[
                { value: ALL, label: t`모든 팀` },
                ...teams.map((x) => ({ value: x.id, label: x.name })),
              ]}
              onChange={setTeam}
            />
          </div>
        )}
      </ReportHeader>

      {query.isError ? (
        <ReportError error={query.error} onRetry={() => query.refetch()} />
      ) : !data ? (
        <ReportSkeleton />
      ) : (
        <>
          <StatTiles data={data} />
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <section className={r.section()}>
              <h2 className={r.sectionTitle()}>
                <Trans>상태 분포</Trans>
              </h2>
              <StatusBar
                byStatus={data.byStatus}
                statusNames={group.statusNames}
              />
            </section>
            <section className={r.section()}>
              <h2 className={r.sectionTitle()}>
                <Trans>담당자별 부하 (열린 게시물)</Trans>
              </h2>
              <LoadBars load={data.assigneeLoad} name={name} />
            </section>
          </div>
          <section className={r.section()}>
            <h2 className={r.sectionTitle()}>
              <Trans>열린·멈춘 게시물</Trans>{" "}
              <span className="font-normal text-fg-muted tabular-nums">
                <Plural
                  value={data.posts.length}
                  other="#건"
                  context="open post count"
                />
              </span>
            </h2>
            {data.posts.length === 0 ? (
              <EmptyState
                icon={<ListX size={20} />}
                title={t`열린 게시물이 없습니다`}
                size="sm"
              />
            ) : (
              <PostTable posts={data.posts} onOpen={openPeek} />
            )}
          </section>
          {query.isFetching && (
            <span className="text-2xs text-fg-muted">
              <Trans>새로 받는 중…</Trans>
            </span>
          )}
        </>
      )}
    </div>
  );
}

const count = (by: StatusReport["byStatus"], s: PostStatus) => by[s] ?? 0;

function StatTiles({ data }: { data: StatusReport }) {
  const { t } = useLingui();
  const unit = COUNT_UNIT[useLocale()];
  const by = data.byStatus;
  const open =
    count(by, "unresolved") + count(by, "in_progress") + count(by, "in_review");
  const paused = count(by, "on_hold");
  const closed = count(by, "resolved") + count(by, "cancelled");
  const { reviewWait: wait, leadTime30d: lead } = data;
  const inReview = count(by, "in_review");
  const resolved = count(by, "resolved");
  const cancelled = count(by, "cancelled");
  const { maxHours, count: waitCount } = wait;
  const { medianDays, count: leadCount } = lead;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile
        label={t({ message: "열림", context: "status report tile" })}
        value={open}
        unit={unit}
        tone="accent"
        hint={t`검토 중 ${inReview}`}
      />
      <StatTile
        label={t({ message: "멈춤", context: "status report tile" })}
        value={paused}
        unit={unit}
      />
      <StatTile
        label={t({ message: "닫힘", context: "status report tile" })}
        value={closed}
        unit={unit}
        hint={t`해결 ${resolved} · 취소 ${cancelled}`}
      />
      <StatTile
        label={t`기한 초과`}
        value={data.overdue}
        unit={unit}
        tone={data.overdue > 0 ? "danger" : "default"}
        hint={t`열린 게시물 중`}
      />
      <StatTile
        label={t`검토 대기 평균`}
        value={wait.count ? wait.avgHours : "—"}
        unit={
          wait.count
            ? t({ message: "시간", context: "hours unit after a number" })
            : undefined
        }
        hint={
          wait.count
            ? t`최대 ${maxHours}시간 · ${plural(waitCount, { other: "#건" })}`
            : t`검토 중 없음`
        }
      />
      <StatTile
        label={t`30일 리드타임 평균`}
        value={lead.count ? lead.avgDays : "—"}
        unit={
          lead.count
            ? t({ message: "일", context: "days unit after a number" })
            : undefined
        }
        hint={
          lead.count
            ? t`중앙값 ${medianDays}일 · ${plural(leadCount, { other: "#건" })}`
            : t`해결 없음`
        }
      />
    </div>
  );
}

/** 상태 6개를 한 줄 막대로 (비율) + 상태별 수 */
function StatusBar({
  byStatus,
  statusNames,
}: {
  byStatus: StatusReport["byStatus"];
  statusNames?: StatusNames;
}) {
  // statusLabel은 컴포넌트 밖 표라 언어 변경을 구독한다.
  useLocale();
  const ordered = Object.keys(STATUS_FILL) as PostStatus[];
  const total = ordered.reduce((n, s) => n + count(byStatus, s), 0);
  if (total === 0)
    return (
      <p className="text-fg-muted">
        <Trans>게시물이 없습니다.</Trans>
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-5 overflow-hidden rounded-sm bg-panel"
        role="img"
        aria-label={ordered
          .map((s) => `${statusLabel(s, statusNames)} ${count(byStatus, s)}`)
          .join(", ")}
      >
        {ordered.map((s) =>
          count(byStatus, s) > 0 ? (
            <span
              key={s}
              className={cn(
                "h-full border-r border-elevated last:border-r-0",
                STATUS_FILL[s],
              )}
              style={{ width: `${(count(byStatus, s) / total) * 100}%` }}
              title={`${statusLabel(s, statusNames)} ${count(byStatus, s)}`}
            />
          ) : null,
        )}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {ordered.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span
              className={cn("size-2.5 flex-none rounded-xs", STATUS_FILL[s])}
              aria-hidden="true"
            />
            <span className="truncate text-fg-secondary">
              {statusLabel(s, statusNames)}
            </span>
            <span className="ml-auto font-semibold tabular-nums">
              {count(byStatus, s)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LoadBars({
  load,
  name,
}: {
  load: StatusReport["assigneeLoad"];
  name: (id: string) => string;
}) {
  const { t } = useLingui();
  if (load.length === 0)
    return (
      <p className="text-fg-muted">
        <Trans>열린 게시물이 없습니다.</Trans>
      </p>
    );
  const max = Math.max(...load.map((l) => l.open));
  return (
    <div className="flex flex-col gap-3">
      <Legend
        items={[
          { label: t`검토 중`, className: "bg-accent" },
          { label: t`그 밖의 열림`, className: "bg-accent/40" },
        ]}
      />
      <ul className="flex flex-col gap-2">
        {load.map((l) => (
          <BarRow
            key={l.userId ?? "none"}
            label={
              l.userId ? (
                name(l.userId)
              ) : (
                <span className="text-fg-muted">
                  <Trans>담당자 없음</Trans>
                </span>
              )
            }
            max={max}
            segments={[
              {
                label: t`검토 중`,
                value: l.inReview,
                className: "bg-accent",
              },
              {
                label: t`그 밖의 열림`,
                value: l.open - l.inReview,
                className: "bg-accent/40",
              },
            ]}
            total={l.open}
            aside={
              l.overdue > 0 ? (
                <span className="rounded-sm bg-danger/12 px-1 text-danger">
                  <Trans>기한 초과 {l.overdue}</Trans>
                </span>
              ) : undefined
            }
          />
        ))}
      </ul>
    </div>
  );
}
