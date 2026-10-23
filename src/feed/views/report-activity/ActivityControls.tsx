"use client";

// 활동 보고 조건: 기간 프리셋(직접 선택은 날짜 둘), 팀, 담당자, 게시물 유형(여럿), 템플릿(적용·저장·덮어쓰기·지우기).

import { Save, Trash2 } from "lucide-react";
import {
  useDeleteReportTemplate,
  useReportTemplates,
  useSaveReportTemplate,
} from "@/feed/api/report-queries";
import type { ReportTemplate } from "@/feed/api/reports";
import type { FeedUser, PostType, Team } from "@/feed/api/types";
import { showAlert, showConfirm, showPrompt } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/Select";
import { segmented } from "@/shared/ui/segmented";
import { type ActivityParams, paramsFromTemplate } from "./activity-state";
import {
  PERIOD_LABELS,
  PERIOD_PRESETS,
  type PeriodPreset,
  presetRange,
  spanDays,
} from "./period";

const seg = segmented();
const ALL = "_all";

const dateInput =
  "h-7.5 rounded-md border border-line bg-elevated px-2 text-ui text-fg tabular-nums";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function ActivityControls({
  groupId,
  params,
  onChange,
  today,
  teams,
  members,
  postTypes,
}: {
  groupId: string;
  params: ActivityParams;
  onChange: (next: ActivityParams) => void;
  today: string;
  teams: readonly Team[];
  members: readonly FeedUser[];
  postTypes: readonly PostType[];
}) {
  const update = (patch: Partial<ActivityParams>) =>
    onChange({ ...params, ...patch });

  function choosePreset(preset: PeriodPreset) {
    update(
      preset === "custom"
        ? { preset, from: params.from, to: params.to }
        : { preset, ...presetRange(preset, today) },
    );
  }

  function toggleType(id: string) {
    const has = params.postTypeIds.includes(id);
    update({
      postTypeIds: has
        ? params.postTypeIds.filter((t) => t !== id)
        : [...params.postTypeIds, id],
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-elevated p-3">
      <div className="flex flex-wrap items-end gap-3">
        <fieldset className="min-w-0">
          <legend className="float-left mb-1.5 w-full text-xs text-fg-secondary">
            기간
          </legend>
          <div className={seg.root({ class: "clear-left self-start" })}>
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={seg.item({ class: "px-2.5" })}
                aria-pressed={params.preset === p}
                onClick={() => choosePreset(p)}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </fieldset>
        {params.preset === "custom" && (
          <div className="flex items-end gap-1.5">
            <label className="flex flex-col gap-1 text-xs text-fg-secondary">
              시작
              <input
                type="date"
                className={dateInput}
                value={params.from}
                max={params.to}
                onChange={(e) =>
                  e.currentTarget.value &&
                  update({ from: e.currentTarget.value })
                }
              />
            </label>
            <span className="pb-1.5 text-fg-muted">~</span>
            <label className="flex flex-col gap-1 text-xs text-fg-secondary">
              끝
              <input
                type="date"
                className={dateInput}
                value={params.to}
                min={params.from}
                onChange={(e) =>
                  e.currentTarget.value && update({ to: e.currentTarget.value })
                }
              />
            </label>
          </div>
        )}
        <div className="w-36">
          <Select
            label="팀"
            value={params.teamId ?? ALL}
            options={[
              { value: ALL, label: "모든 팀" },
              ...teams.map((t) => ({ value: t.id, label: t.name })),
            ]}
            onChange={(v) => update({ teamId: v === ALL ? undefined : v })}
          />
        </div>
        <div className="w-36">
          <Select
            label="담당자"
            value={params.assigneeId ?? ALL}
            options={[
              { value: ALL, label: "모든 사람" },
              ...members.map((u) => ({ value: u.id, label: u.name })),
            ]}
            onChange={(v) => update({ assigneeId: v === ALL ? undefined : v })}
          />
        </div>
      </div>

      {postTypes.length > 0 && (
        <fieldset className="min-w-0">
          <legend className="float-left mb-1.5 w-full text-xs text-fg-secondary">
            게시물 유형{" "}
            <span className="text-fg-muted">
              {params.postTypeIds.length ? "" : "(모두)"}
            </span>
          </legend>
          <div className="clear-left flex flex-wrap gap-1.5">
            {postTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={params.postTypeIds.includes(t.id)}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-elevated px-2.5 text-xs text-fg-secondary aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent"
                onClick={() => toggleType(t.id)}
              >
                <span
                  className="size-2 rounded-full bg-fg-muted"
                  style={t.color ? { backgroundColor: t.color } : undefined}
                  aria-hidden="true"
                />
                {t.name}
              </button>
            ))}
            {params.postTypeIds.length > 0 && (
              <button
                type="button"
                className="h-7 cursor-pointer px-1.5 text-xs text-accent"
                onClick={() => update({ postTypeIds: [] })}
              >
                모두
              </button>
            )}
          </div>
        </fieldset>
      )}

      <TemplateBar
        groupId={groupId}
        params={params}
        today={today}
        onApply={onChange}
      />
    </div>
  );
}

/** 템플릿 고르기(적용) + 새 템플릿으로 저장 / 덮어쓰기 / 지우기 */
function TemplateBar({
  groupId,
  params,
  today,
  onApply,
}: {
  groupId: string;
  params: ActivityParams;
  today: string;
  onApply: (next: ActivityParams) => void;
}) {
  const templates = useReportTemplates(groupId);
  const save = useSaveReportTemplate();
  const remove = useDeleteReportTemplate(groupId);
  const list = (templates.data ?? []).filter((t) => t.kind === "activity");
  const current = list.find((t) => t.id === params.templateId);
  const busy = save.isPending || remove.isPending;

  const body = (name: string, id?: string) => ({
    id,
    groupId,
    name,
    kind: "activity" as const,
    params: {
      rangeDays: spanDays(params.from, params.to),
      teamId: params.teamId,
      assigneeId: params.assigneeId,
      postTypeIds: params.postTypeIds.length ? params.postTypeIds : undefined,
    },
  });

  async function saveAs() {
    const name = await showPrompt("새 템플릿 이름", {
      defaultValue: current ? `${current.name} 사본` : "",
      confirmLabel: "저장",
      maxLength: 60,
    });
    if (!name) return;
    try {
      const saved = await save.mutateAsync(body(name));
      onApply({ ...params, templateId: saved.id });
    } catch (e) {
      showAlert(`템플릿을 저장하지 못했습니다: ${errorText(e)}`);
    }
  }

  async function overwrite(t: ReportTemplate) {
    if (
      !(await showConfirm(`‘${t.name}’를 지금 조건으로 덮어쓸까요?`, {
        confirmLabel: "덮어쓰기",
      }))
    )
      return;
    try {
      await save.mutateAsync(body(t.name, t.id));
    } catch (e) {
      showAlert(`템플릿을 저장하지 못했습니다: ${errorText(e)}`);
    }
  }

  async function del(t: ReportTemplate) {
    if (
      !(await showConfirm(`‘${t.name}’ 템플릿을 지울까요?`, {
        confirmLabel: "지우기",
      }))
    )
      return;
    try {
      await remove.mutateAsync(t.id);
      onApply({ ...params, templateId: undefined });
    } catch (e) {
      showAlert(`템플릿을 지우지 못했습니다: ${errorText(e)}`);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
      <div className="w-52">
        <Select
          label="템플릿"
          value={current?.id ?? null}
          placeholder={templates.isPending ? "불러오는 중" : "템플릿 고르기"}
          disabled={list.length === 0}
          options={list.map((t) => ({ value: t.id, label: t.name }))}
          onChange={(id) => {
            const t = list.find((x) => x.id === id);
            if (t) onApply(paramsFromTemplate(t, today));
          }}
        />
      </div>
      {current && (
        <button
          type="button"
          className={button({ size: "sm" })}
          onClick={() => onApply(paramsFromTemplate(current, today))}
        >
          다시 적용
        </button>
      )}
      <button
        type="button"
        className={button({ size: "sm" })}
        disabled={busy}
        onClick={saveAs}
      >
        <Save size={14} aria-hidden="true" />새 템플릿으로 저장
      </button>
      {current?.editable && (
        <>
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={busy}
            onClick={() => overwrite(current)}
          >
            덮어쓰기
          </button>
          <button
            type="button"
            className={button({ size: "sm", variant: "danger" })}
            disabled={busy}
            onClick={() => del(current)}
          >
            <Trash2 size={14} aria-hidden="true" />
            지우기
          </button>
        </>
      )}
      {templates.isError && (
        <span className="text-xs text-danger">
          템플릿을 불러오지 못했습니다
        </span>
      )}
    </div>
  );
}
