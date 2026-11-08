"use client";

// 상태 이름: 6개 상태를 카테고리별로. 비우면 기본 이름. 카테고리는 고정이라 이름만 바꾼다.

import { useId, useState } from "react";
import { categoryLabels, statusLabels } from "@/entities/post/lib/labels";
import { field, statusBadge } from "@/entities/post/ui/styles";
import { groupsApi } from "@/shared/api/feed/groups";
import type {
  GroupDetail,
  PostStatus,
  StatusCategory,
  StatusNames,
} from "@/shared/api/feed/types";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { button } from "@/shared/ui/button";
import { settings } from "@/shared/ui/feed-settings-styles";
import { Spinner } from "@/shared/ui/Loading";
import type { useGroupEdit } from "@/views/feed-settings-group/model/use-group-edit";

const messages = defineMessages({
  ko: {
    saveFailed: "상태 이름을 저장하지 못했습니다",
    title: "상태 이름",
    hint: "비워 두면 기본 이름을 씁니다.",
    nameOf: (status: string) => `${status} 상태 이름`,
    preview: "미리 보기",
    revert: "되돌리기",
    save: "저장",
  },
  en: {
    saveFailed: "Couldn't save status names",
    title: "Status names",
    hint: "Leave blank to use the default name.",
    nameOf: (status: string) => `Name for ${status}`,
    preview: "Preview",
    revert: "Revert",
    save: "Save",
  },
});

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
  const defaults = statusLabels();
  for (const status of Object.keys(draft) as PostStatus[]) {
    const v = draft[status].trim();
    if (v && v !== defaults[status]) names[status] = v;
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
  const text = useT(messages);
  const id = useId();
  const [base, setBase] = useState(group.statusNames);
  const [draft, setDraft] = useState(() => draftOf(group.statusNames));
  if (base !== group.statusNames) {
    setBase(group.statusNames);
    setDraft(draftOf(group.statusNames));
  }
  const statusLabel = statusLabels();
  const categoryLabel = categoryLabels();
  const next = toStatusNames(draft);
  const dirty = !same(next, group.statusNames);

  const save = () =>
    edit.run("status", text.saveFailed, () =>
      groupsApi.update(group.id, { statusNames: next }),
    );

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead()}>
        <h2 id={`${id}-title`} className={s.sectionTitle()}>
          {text.title}
        </h2>
        <p className={s.hint()}>{text.hint}</p>
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
              {categoryLabel[category]}
            </legend>
            {statuses.map((status) => {
              const name = draft[status].trim() || statusLabel[status];
              return (
                <div
                  key={status}
                  className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[6rem_minmax(0,16rem)_minmax(0,1fr)]"
                >
                  <span className="text-xs text-fg-muted">
                    {statusLabel[status]}
                  </span>
                  <input
                    className={field()}
                    value={draft[status]}
                    placeholder={statusLabel[status]}
                    maxLength={20}
                    aria-label={text.nameOf(statusLabel[status])}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setDraft((d) => ({ ...d, [status]: value }));
                    }}
                  />
                  <span className="col-start-2 sm:col-start-auto">
                    <span
                      className={statusBadge({ status })}
                      title={text.preview}
                    >
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
              {text.revert}
            </button>
          )}
          <button
            type="submit"
            className={button({ variant: "primary", size: "sm" })}
            disabled={!dirty || !!edit.pending}
          >
            {edit.pending === "status" && <Spinner size="sm" tone="inherit" />}
            {text.save}
          </button>
        </div>
      </form>
    </section>
  );
}
