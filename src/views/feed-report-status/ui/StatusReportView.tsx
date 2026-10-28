"use client";

// 현황 보고 (/feed/report/status?g=FD): 상단 숫자(열림·멈춤·닫힘, 기한 초과, 검토 대기, 30일 리드타임),
// 상태 분포 막대, 담당자별 부하 막대, 하단에 열린·멈춘 게시물 목록. 팀으로 거른다(?team=).

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
import { defineMessages, useT } from "@/shared/lib/i18n";
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

const messages = defineMessages({
  ko: {
    title: (group: string) => `${group} 현황 보고`,
    subtitle: (team: string) => `${team} · 지금 기준`,
    allTeamsNow: "모든 팀 · 지금 기준",
    team: "팀",
    allTeams: "모든 팀",
    byStatus: "상태 분포",
    load: "담당자별 부하 (열린 게시물)",
    openPaused: "열린·멈춘 게시물",
    count: (n: number) => `${n}건`,
    noOpen: "열린 게시물이 없습니다",
    noOpenSentence: "열린 게시물이 없습니다.",
    noPosts: "게시물이 없습니다.",
    refreshing: "새로 받는 중…",
    open: "열림",
    paused: "멈춤",
    closed: "닫힘",
    unit: "건",
    inReviewCount: (n: number) => `검토 중 ${n}`,
    closedHint: (resolved: number, cancelled: number) =>
      `해결 ${resolved} · 취소 ${cancelled}`,
    overdue: "기한 초과",
    ofOpen: "열린 게시물 중",
    reviewWait: "검토 대기 평균",
    hours: "시간",
    waitHint: (max: number, n: number) => `최대 ${max}시간 · ${n}건`,
    noneInReview: "검토 중 없음",
    leadTime: "30일 리드타임 평균",
    days: "일",
    leadHint: (median: number, n: number) => `중앙값 ${median}일 · ${n}건`,
    noneResolved: "해결 없음",
    unassigned: "담당자 없음",
    inReview: "검토 중",
    otherOpen: "그 밖의 열림",
    overdueCount: (n: number) => `기한 초과 ${n}`,
  },
  en: {
    title: (group: string) => `${group} status report`,
    subtitle: (team: string) => `${team} · as of now`,
    allTeamsNow: "All teams · as of now",
    team: "Team",
    allTeams: "All teams",
    byStatus: "By status",
    load: "Load by assignee (open posts)",
    openPaused: "Open and on-hold posts",
    count: (n: number) => `${n}`,
    noOpen: "No open posts",
    noOpenSentence: "No open posts.",
    noPosts: "No posts.",
    refreshing: "Refreshing…",
    open: "Open",
    paused: "On hold",
    closed: "Closed",
    unit: "",
    inReviewCount: (n: number) => `${n} in review`,
    closedHint: (resolved: number, cancelled: number) =>
      `${resolved} resolved · ${cancelled} canceled`,
    overdue: "Overdue",
    ofOpen: "Among open posts",
    reviewWait: "Avg review wait",
    hours: "h",
    waitHint: (max: number, n: number) =>
      `Max ${max}h · ${n} ${n === 1 ? "post" : "posts"}`,
    noneInReview: "None in review",
    leadTime: "Avg 30-day lead time",
    days: "d",
    leadHint: (median: number, n: number) =>
      `Median ${median}d · ${n} ${n === 1 ? "post" : "posts"}`,
    noneResolved: "None resolved",
    unassigned: "Unassigned",
    inReview: "In review",
    otherOpen: "Other open",
    overdueCount: (n: number) => `${n} overdue`,
  },
});

export function StatusReportView() {
  const text = useT(messages);
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
  const teamName = teams.find((t) => t.id === teamId)?.name;
  const title = text.title(group.name);

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
        subtitle={teamName ? text.subtitle(teamName) : text.allTeamsNow}
        slideCount={deck.length}
      >
        {!present && teams.length > 0 && (
          <div className="w-36">
            <Select
              label={text.team}
              value={teamId ?? ALL}
              options={[
                { value: ALL, label: text.allTeams },
                ...teams.map((t) => ({ value: t.id, label: t.name })),
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
              <h2 className={r.sectionTitle()}>{text.byStatus}</h2>
              <StatusBar
                byStatus={data.byStatus}
                statusNames={group.statusNames}
              />
            </section>
            <section className={r.section()}>
              <h2 className={r.sectionTitle()}>{text.load}</h2>
              <LoadBars load={data.assigneeLoad} name={name} />
            </section>
          </div>
          <section className={r.section()}>
            <h2 className={r.sectionTitle()}>
              {text.openPaused}{" "}
              <span className="font-normal text-fg-muted tabular-nums">
                {text.count(data.posts.length)}
              </span>
            </h2>
            {data.posts.length === 0 ? (
              <EmptyState
                icon={<ListX size={20} />}
                title={text.noOpen}
                size="sm"
              />
            ) : (
              <PostTable posts={data.posts} onOpen={openPeek} />
            )}
          </section>
          {query.isFetching && (
            <span className="text-2xs text-fg-muted">{text.refreshing}</span>
          )}
        </>
      )}
    </div>
  );
}

const count = (by: StatusReport["byStatus"], s: PostStatus) => by[s] ?? 0;

function StatTiles({ data }: { data: StatusReport }) {
  const text = useT(messages);
  const by = data.byStatus;
  const open =
    count(by, "unresolved") + count(by, "in_progress") + count(by, "in_review");
  const paused = count(by, "on_hold");
  const closed = count(by, "resolved") + count(by, "cancelled");
  const { reviewWait: wait, leadTime30d: lead } = data;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile
        label={text.open}
        value={open}
        unit={text.unit}
        tone="accent"
        hint={text.inReviewCount(count(by, "in_review"))}
      />
      <StatTile label={text.paused} value={paused} unit={text.unit} />
      <StatTile
        label={text.closed}
        value={closed}
        unit={text.unit}
        hint={text.closedHint(count(by, "resolved"), count(by, "cancelled"))}
      />
      <StatTile
        label={text.overdue}
        value={data.overdue}
        unit={text.unit}
        tone={data.overdue > 0 ? "danger" : "default"}
        hint={text.ofOpen}
      />
      <StatTile
        label={text.reviewWait}
        value={wait.count ? wait.avgHours : "—"}
        unit={wait.count ? text.hours : undefined}
        hint={
          wait.count
            ? text.waitHint(wait.maxHours, wait.count)
            : text.noneInReview
        }
      />
      <StatTile
        label={text.leadTime}
        value={lead.count ? lead.avgDays : "—"}
        unit={lead.count ? text.days : undefined}
        hint={
          lead.count
            ? text.leadHint(lead.medianDays, lead.count)
            : text.noneResolved
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
  const text = useT(messages);
  const ordered = Object.keys(STATUS_FILL) as PostStatus[];
  const total = ordered.reduce((n, s) => n + count(byStatus, s), 0);
  if (total === 0) return <p className="text-fg-muted">{text.noPosts}</p>;
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
  const text = useT(messages);
  if (load.length === 0)
    return <p className="text-fg-muted">{text.noOpenSentence}</p>;
  const max = Math.max(...load.map((l) => l.open));
  return (
    <div className="flex flex-col gap-3">
      <Legend
        items={[
          { label: text.inReview, className: "bg-accent" },
          { label: text.otherOpen, className: "bg-accent/40" },
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
                <span className="text-fg-muted">{text.unassigned}</span>
              )
            }
            max={max}
            segments={[
              {
                label: text.inReview,
                value: l.inReview,
                className: "bg-accent",
              },
              {
                label: text.otherOpen,
                value: l.open - l.inReview,
                className: "bg-accent/40",
              },
            ]}
            total={l.open}
            aside={
              l.overdue > 0 ? (
                <span className="rounded-sm bg-danger/12 px-1 text-danger">
                  {text.overdueCount(l.overdue)}
                </span>
              ) : undefined
            }
          />
        ))}
      </ul>
    </div>
  );
}
