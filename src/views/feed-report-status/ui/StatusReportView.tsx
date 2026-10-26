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

const LOAD_LEGEND = [
  { label: "검토 중", className: "bg-accent" },
  { label: "그 밖의 열림", className: "bg-accent/40" },
];

export function StatusReportView() {
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
  const title = `${group.name} 현황 보고`;

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
        subtitle={teamName ? `${teamName} · 지금 기준` : "모든 팀 · 지금 기준"}
        slideCount={deck.length}
      >
        {!present && teams.length > 0 && (
          <div className="w-36">
            <Select
              label="팀"
              value={teamId ?? ALL}
              options={[
                { value: ALL, label: "모든 팀" },
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
              <h2 className={r.sectionTitle()}>상태 분포</h2>
              <StatusBar
                byStatus={data.byStatus}
                statusNames={group.statusNames}
              />
            </section>
            <section className={r.section()}>
              <h2 className={r.sectionTitle()}>담당자별 부하 (열린 게시물)</h2>
              <LoadBars load={data.assigneeLoad} name={name} />
            </section>
          </div>
          <section className={r.section()}>
            <h2 className={r.sectionTitle()}>
              열린·멈춘 게시물{" "}
              <span className="font-normal text-fg-muted tabular-nums">
                {data.posts.length}건
              </span>
            </h2>
            {data.posts.length === 0 ? (
              <EmptyState
                icon={<ListX size={20} />}
                title="열린 게시물이 없습니다"
                size="sm"
              />
            ) : (
              <PostTable posts={data.posts} onOpen={openPeek} />
            )}
          </section>
          {query.isFetching && (
            <span className="text-2xs text-fg-muted">새로 받는 중…</span>
          )}
        </>
      )}
    </div>
  );
}

const count = (by: StatusReport["byStatus"], s: PostStatus) => by[s] ?? 0;

function StatTiles({ data }: { data: StatusReport }) {
  const by = data.byStatus;
  const open =
    count(by, "unresolved") + count(by, "in_progress") + count(by, "in_review");
  const paused = count(by, "on_hold");
  const closed = count(by, "resolved") + count(by, "cancelled");
  const { reviewWait: wait, leadTime30d: lead } = data;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile
        label="열림"
        value={open}
        unit="건"
        tone="accent"
        hint={`검토 중 ${count(by, "in_review")}`}
      />
      <StatTile label="멈춤" value={paused} unit="건" />
      <StatTile
        label="닫힘"
        value={closed}
        unit="건"
        hint={`해결 ${count(by, "resolved")} · 취소 ${count(by, "cancelled")}`}
      />
      <StatTile
        label="기한 초과"
        value={data.overdue}
        unit="건"
        tone={data.overdue > 0 ? "danger" : "default"}
        hint="열린 게시물 중"
      />
      <StatTile
        label="검토 대기 평균"
        value={wait.count ? wait.avgHours : "—"}
        unit={wait.count ? "시간" : undefined}
        hint={
          wait.count
            ? `최대 ${wait.maxHours}시간 · ${wait.count}건`
            : "검토 중 없음"
        }
      />
      <StatTile
        label="30일 리드타임 평균"
        value={lead.count ? lead.avgDays : "—"}
        unit={lead.count ? "일" : undefined}
        hint={
          lead.count
            ? `중앙값 ${lead.medianDays}일 · ${lead.count}건`
            : "해결 없음"
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
  const ordered = Object.keys(STATUS_FILL) as PostStatus[];
  const total = ordered.reduce((n, s) => n + count(byStatus, s), 0);
  if (total === 0) return <p className="text-fg-muted">게시물이 없습니다.</p>;
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
  if (load.length === 0)
    return <p className="text-fg-muted">열린 게시물이 없습니다.</p>;
  const max = Math.max(...load.map((l) => l.open));
  return (
    <div className="flex flex-col gap-3">
      <Legend items={LOAD_LEGEND} />
      <ul className="flex flex-col gap-2">
        {load.map((l) => (
          <BarRow
            key={l.userId ?? "none"}
            label={
              l.userId ? (
                name(l.userId)
              ) : (
                <span className="text-fg-muted">담당자 없음</span>
              )
            }
            max={max}
            segments={[
              { label: "검토 중", value: l.inReview, className: "bg-accent" },
              {
                label: "그 밖의 열림",
                value: l.open - l.inReview,
                className: "bg-accent/40",
              },
            ]}
            total={l.open}
            aside={
              l.overdue > 0 ? (
                <span className="rounded-sm bg-danger/12 px-1 text-danger">
                  기한 초과 {l.overdue}
                </span>
              ) : undefined
            }
          />
        ))}
      </ul>
    </div>
  );
}
