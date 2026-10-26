"use client";

// 활동 보고 (/feed/report/activity?g=FD): 기간·팀·담당자·유형 → 숫자 칸, 사람별 막대, 날짜별 활동 로그.
// "초안 만들기"는 AI 어댑터로 보고 초안을 쓴다. 처음 들어오면 그룹의 첫 활동 템플릿(주간 업무 보고)을 적용한다.

import { CalendarX, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ActivityData } from "@/feed/ai/types";
import {
  useActivityReport,
  useReportTemplates,
} from "@/feed/api/report-queries";
import { useOpenPeek } from "@/feed/lib/peek";
import { useUserName } from "@/feed/ui/posts/post-meta";
import { button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/Loading";
import { RouteGroupFallback, useRouteGroup } from "../list/route-group";
import { type DeckItem, PresentDeck } from "../present/PresentDeck";
import { usePresentNav } from "../present/present-nav";
import { ActivityControls } from "./ActivityControls";
import { ActivityTimeline } from "./ActivityTimeline";
import { paramsFromTemplate, useActivityParams } from "./activity-state";
import { DraftPanel } from "./DraftPanel";
import { toActivityData } from "./draft-data";
import { PERIOD_LABELS, shortDay } from "./period";
import {
  BarRow,
  Legend,
  ReportError,
  ReportHeader,
  ReportSkeleton,
  report,
  StatTile,
} from "./report-ui";

export function ActivityReportView() {
  const route = useRouteGroup();
  const { group, detail, members } = route;
  const { params, set, blank, today } = useActivityParams();
  const templates = useReportTemplates(group?.id);
  const { present, slide } = usePresentNav();
  const openPeek = useOpenPeek();
  const name = useUserName();
  const userName = (id: string | null) => (id ? name(id) : "누군가");
  const [draft, setDraft] = useState<ActivityData | null>(null);

  // 처음 들어오면(URL에 조건이 없으면) 첫 활동 템플릿을, 없으면 이번 주를 적용한다
  useEffect(() => {
    if (!blank || !group || templates.isPending) return;
    const first = templates.data?.find((t) => t.kind === "activity");
    set(first ? paramsFromTemplate(first, today) : { ...params });
  }, [blank, group, templates.isPending, templates.data, today, set, params]);

  const request = useMemo(
    () =>
      group && !blank
        ? {
            groupId: group.id,
            from: params.from,
            to: params.to,
            teamId: params.teamId,
            assigneeId: params.assigneeId,
            postTypeIds: params.postTypeIds.length
              ? params.postTypeIds
              : undefined,
          }
        : null,
    [group, blank, params],
  );
  const query = useActivityReport(request);
  const data = query.data;

  const deck = useMemo<DeckItem[]>(() => {
    if (!data) return [];
    const items: DeckItem[] = data.completed.map((c) => ({
      key: c.post.key,
      note: "해결",
    }));
    for (const p of data.created)
      if (!items.some((i) => i.key === p.key))
        items.push({ key: p.key, note: "생성" });
    return items;
  }, [data]);

  if (!group) return <RouteGroupFallback state={route} />;
  const r = report({ present });
  const statusNames = group.statusNames;
  const total = data?.days.reduce((n, d) => n + d.entries.length, 0) ?? 0;
  const period = `${shortDay(params.from)} ~ ${shortDay(params.to)}`;
  const title = `${group.name} 활동 보고`;

  if (present && slide !== null && data)
    return <PresentDeck items={deck} title={`${title} · ${period}`} />;

  const maxEvents = Math.max(0, ...(data?.byUser.map((u) => u.events) ?? []));
  return (
    <div className={r.root()}>
      <ReportHeader
        title={title}
        subtitle={`${PERIOD_LABELS[params.preset]} · ${period}`}
        slideCount={deck.length}
      >
        {!present && (
          <button
            type="button"
            className={button({ size: "sm", variant: "primary" })}
            disabled={!data || total === 0}
            onClick={() =>
              data && setDraft(toActivityData(data, userName, statusNames))
            }
          >
            <Sparkles size={14} aria-hidden="true" />
            초안 만들기
          </button>
        )}
      </ReportHeader>

      {!present && (
        <ActivityControls
          groupId={group.id}
          params={params}
          onChange={set}
          today={today}
          teams={detail?.teams ?? []}
          members={members}
          postTypes={detail?.postTypes ?? []}
        />
      )}

      {draft && <DraftPanel data={draft} onClose={() => setDraft(null)} />}

      {query.isError ? (
        <ReportError error={query.error} onRetry={() => query.refetch()} />
      ) : !data ? (
        <ReportSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatTile
              label="활동"
              value={total}
              unit="건"
              hint={`${data.days.length}일`}
            />
            <StatTile
              label="해결"
              value={data.completed.length}
              unit="건"
              tone="accent"
            />
            <StatTile label="생성" value={data.created.length} unit="건" />
          </div>

          {total === 0 ? (
            <EmptyState
              icon={<CalendarX size={20} />}
              title="이 기간에 활동이 없습니다"
            >
              <p>기간을 넓히거나 팀·담당자·유형 조건을 지워 보세요.</p>
            </EmptyState>
          ) : (
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
              <section className={r.section({ class: "self-start" })}>
                <h2 className={r.sectionTitle()}>사람별 활동</h2>
                <Legend
                  items={[
                    { label: "활동", className: "bg-accent/40" },
                    { label: "승인(해결)", className: "bg-accent" },
                  ]}
                />
                <ul className="flex flex-col gap-2">
                  {data.byUser.map((u) => (
                    <BarRow
                      key={u.userId}
                      label={name(u.userId)}
                      max={maxEvents}
                      segments={[
                        {
                          label: "승인",
                          value: u.completed,
                          className: "bg-accent",
                        },
                        {
                          label: "그 밖의 활동",
                          value: u.events - u.completed,
                          className: "bg-accent/40",
                        },
                      ]}
                      total={u.events}
                      aside={
                        u.completed > 0 ? (
                          <span className="text-accent">
                            해결 {u.completed}
                          </span>
                        ) : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
              <section className={r.section()}>
                <h2 className={r.sectionTitle()}>날짜별 활동</h2>
                <ActivityTimeline
                  days={data.days}
                  userName={userName}
                  statusNames={statusNames}
                  onOpen={openPeek}
                  present={present}
                />
              </section>
            </div>
          )}
          {query.isFetching && (
            <span className="text-2xs text-fg-muted">새로 받는 중…</span>
          )}
        </>
      )}
    </div>
  );
}
