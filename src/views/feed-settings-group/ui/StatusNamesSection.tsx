"use client";

// 상태 이름: 6개 상태를 카테고리별로. 비우면 기본 이름. 카테고리는 고정이라 이름만 바꾼다.

import { useId, useState } from "react";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/entities/post/lib/labels";
import { field, statusBadge } from "@/entities/post/ui/styles";
import { groupsApi } from "@/shared/api/feed/groups";
import type {
  GroupDetail,
  PostStatus,
  StatusCategory,
  StatusNames,
} from "@/shared/api/feed/types";
import { button } from "@/shared/ui/button";
import { settings } from "@/shared/ui/feed-settings-styles";
import { Spinner } from "@/shared/ui/Loading";
import type { useGroupEdit } from "@/views/feed-settings-group/model/use-group-edit";

const s = settings();

export const STATUS_GROUPS: [StatusCategory, PostStatus[]][] = [
  ["open", ["unresolved", "in_progress", "in_review"]],
  ["paused", ["on_hold"]],
  ["closed", ["resolved", "cancelled"]],
];

type Draft = Record<PostStatus, string>;

const draftOf = (names: StatusNames): Draft => ({
  unresolved: names.unresolved ?? "",
  in_progress: names.in_progress ?? "",
  in_review: names.in_review ?? "",
  resolved: names.resolved ?? "",
  on_hold: names.on_hold ?? "",
  cancelled: names.cancelled ?? "",
});

/** 초안 → 저장할 이름. 비었거나 기본 이름과 같으면 뺀다 */
export function toStatusNames(draft: Draft): StatusNames {
  const names: StatusNames = {};
  for (const status of Object.keys(draft) as PostStatus[]) {
    const v = draft[status].trim();
    if (v && v !== STATUS_LABELS[status]) names[status] = v;
  }
  return names;
}

const same = (a: StatusNames, b: StatusNames) =>
  JSON.stringify(toStatusNames(draftOf(a))) ===
  JSON.stringify(toStatusNames(draftOf(b)));

export function StatusNamesSection({
  group,
  edit,
}: {
  group: GroupDetail;
  edit: ReturnType<typeof useGroupEdit>;
}) {
  const id = useId();
  const [base, setBase] = useState(group.statusNames);
  const [draft, setDraft] = useState(() => draftOf(group.statusNames));
  if (base !== group.statusNames) {
    setBase(group.statusNames);
    setDraft(draftOf(group.statusNames));
  }
  const next = toStatusNames(draft);
  const dirty = !same(next, group.statusNames);

  const save = () =>
    edit.run("status", "상태 이름을 저장하지 못했습니다", () =>
      groupsApi.update(group.id, { statusNames: next }),
    );

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead()}>
        <h2 id={`${id}-title`} className={s.sectionTitle()}>
          상태 이름
        </h2>
        <p className={s.hint()}>비워 두면 기본 이름을 씁니다.</p>
      </div>
      <form
        className="flex min-w-0 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save();
        }}
      >
        {STATUS_GROUPS.map(([category, statuses]) => (
          <fieldset key={category} className="flex min-w-0 flex-col gap-2">
            <legend className="mb-2 text-xs font-semibold text-fg-secondary">
              {CATEGORY_LABELS[category]}
            </legend>
            {statuses.map((status) => {
              const name = draft[status].trim() || STATUS_LABELS[status];
              return (
                <div
                  key={status}
                  className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[6rem_minmax(0,16rem)_minmax(0,1fr)]"
                >
                  <span className="text-xs text-fg-muted">
                    {STATUS_LABELS[status]}
                  </span>
                  <input
                    className={field()}
                    value={draft[status]}
                    placeholder={STATUS_LABELS[status]}
                    maxLength={20}
                    aria-label={`${STATUS_LABELS[status]} 상태 이름`}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setDraft((d) => ({ ...d, [status]: value }));
                    }}
                  />
                  <span className="col-start-2 sm:col-start-auto">
                    <span className={statusBadge({ status })} title="미리 보기">
                      {name}
                    </span>
                  </span>
                </div>
              );
            })}
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && (
            <button
              type="button"
              className={button({ size: "sm" })}
              onClick={() => setDraft(draftOf(group.statusNames))}
            >
              되돌리기
            </button>
          )}
          <button
            type="submit"
            className={button({ variant: "primary", size: "sm" })}
            disabled={!dirty || !!edit.pending}
          >
            {edit.pending === "status" && <Spinner size="sm" tone="inherit" />}
            저장
          </button>
        </div>
      </form>
    </section>
  );
}
