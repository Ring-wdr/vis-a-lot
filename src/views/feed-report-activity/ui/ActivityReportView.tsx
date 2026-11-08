"use client";

// 활동 보고 (/feed/report/activity?g=FD): 기간·팀·담당자·유형 → 숫자 칸, 사람별 막대, 날짜별 활동 로그.
// "초안 만들기"는 AI 어댑터로 보고 초안을 쓴다. 처음 들어오면 그룹의 첫 활동 템플릿(주간 업무 보고)을 적용한다.

import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { CalendarX, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import {
  RouteGroupFallback,
  useRouteGroup,
} from "@/entities/group/ui/route-group";
import { useUserName } from "@/entities/post/ui/post-meta";
import { usePresentNav } from "@/features/present-mode/model/present-nav";
import {
  useActivityReport,
  useReportTemplates,
} from "@/shared/api/feed/report-queries";
import type { ActivityData } from "@/shared/lib/ai/types";
import { type Locale, useLocale } from "@/shared/lib/i18n";
import { useOpenPeek } from "@/shared/lib/peek";
import { button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/Loading";
import { periodLabel, shortDay } from "@/views/feed-report-activity/lib/period";
import {
  paramsFromTemplate,
  useActivityParams,
} from "@/views/feed-report-activity/model/activity-state";
import { toActivityData } from "@/views/feed-report-activity/model/draft-data";
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
import { ActivityControls } from "./ActivityControls";
import { ActivityTimeline } from "./ActivityTimeline";
import { DraftPanel } from "./DraftPanel";

/** 숫자 칸의 단위. 영어는 단위 없이 숫자만 쓴다 (번역할 문구가 없는 언어가 있어 언어별로 둔다) */
const COUNT_UNIT: Record<Locale, string | undefined> = {
  ko: "건",
  en: undefined,
  ja: "件",
};

export function ActivityReportView() {
  const { t } = useLingui();
  const locale = useLocale();
  const route = useRouteGroup();
  const { group, detail, members } = route;
  const { params: urlParams, set, blank, today } = useActivityParams();
  const templates = useReportTemplates(group?.id);
  const { present, slide } = usePresentNav();
  const openPeek = useOpenPeek();
  const name = useUserName();
  const userName = (id: string | null) => (id ? name(id) : t`누군가`);
  const [draft, setDraft] = useState<ActivityData | null>(null);

  // 처음 들어오면(URL에 조건이 없으면) 첫 활동 템플릿을, 없으면 이번 주를 쓴다. URL에는 조건을 바꿀 때 적는다.
  const first = blank
    ? templates.data?.find((t) => t.kind === "activity")
    : undefined;
  const params = useMemo(
    () => (first ? paramsFromTemplate(first, today) : urlParams),
    [first, today, urlParams],
  );
  // 템플릿을 받기 전에는 어느 조건으로 볼지 모르니 아직 조회하지 않는다.
  const ready = !blank || !templates.isPending;

  const request = useMemo(
    () =>
      group && ready
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
    [group, ready, params],
  );
  const query = useActivityReport(request);
  const data = query.data;

  const deck = useMemo<DeckItem[]>(() => {
    if (!data) return [];
    const items: DeckItem[] = data.completed.map((c) => ({
      key: c.post.key,
      note: t`해결`,
    }));
    for (const p of data.created)
      if (!items.some((i) => i.key === p.key))
        items.push({ key: p.key, note: t`생성` });
    return items;
  }, [data, t]);

  if (!group) return <RouteGroupFallback state={route} />;
  const r = report({ present });
  const statusNames = group.statusNames;
  const total = data?.days.reduce((n, d) => n + d.entries.length, 0) ?? 0;
  const period = `${shortDay(params.from)} ~ ${shortDay(params.to)}`;
  const groupName = group.name;
  const title = t`${groupName} 활동 보고`;
  const unit = COUNT_UNIT[locale];

  if (present && slide !== null && data)
    return <PresentDeck items={deck} title={`${title} · ${period}`} />;

  const maxEvents = Math.max(0, ...(data?.byUser.map((u) => u.events) ?? []));
  return (
    <div className={r.root()}>
      <ReportHeader
        title={title}
        subtitle={`${periodLabel(params.preset)} · ${period}`}
        slideCount={deck.length}
      >
        {!present && (
          <button
            type="button"
            className={button({
              size: "sm",
              variant: "primary",
              class: "whitespace-nowrap",
            })}
            disabled={!data || total === 0}
            onClick={() =>
              data && setDraft(toActivityData(data, userName, statusNames))
            }
          >
            <Sparkles size={14} aria-hidden="true" />
            <Trans>초안 만들기</Trans>
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
              label={t`활동`}
              value={total}
              unit={unit}
              hint={
                <Plural
                  value={data.days.length}
                  other="#일"
                  context="days in report period"
                />
              }
            />
            <StatTile
              label={t`해결`}
              value={data.completed.length}
              unit={unit}
              tone="accent"
            />
            <StatTile label={t`생성`} value={data.created.length} unit={unit} />
          </div>

          {total === 0 ? (
            <EmptyState
              icon={<CalendarX size={20} />}
              title={t`이 기간에 활동이 없습니다`}
            >
              <p>
                <Trans>
                  기간을 넓히거나 팀·담당자·유형 조건을 지워 보세요.
                </Trans>
              </p>
            </EmptyState>
          ) : (
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
              <section className={r.section({ class: "self-start" })}>
                <h2 className={r.sectionTitle()}>
                  <Trans>사람별 활동</Trans>
                </h2>
                <Legend
                  items={[
                    { label: t`활동`, className: "bg-accent/40" },
                    { label: t`승인(해결)`, className: "bg-accent" },
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
                          label: t`승인`,
                          value: u.completed,
                          className: "bg-accent",
                        },
                        {
                          label: t`그 밖의 활동`,
                          value: u.events - u.completed,
                          className: "bg-accent/40",
                        },
                      ]}
                      total={u.events}
                      aside={
                        u.completed > 0 ? (
                          <span className="text-accent">
                            <Trans>해결 {u.completed}</Trans>
                          </span>
                        ) : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
              <section className={r.section()}>
                <h2 className={r.sectionTitle()}>
                  <Trans>날짜별 활동</Trans>
                </h2>
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
            <span className="text-2xs text-fg-muted">
              <Trans>새로 받는 중…</Trans>
            </span>
          )}
        </>
      )}
    </div>
  );
}
