"use client";

// 고른 게시물 일괄 변경 줄: 상태·우선순위·담당자·기한·유형·팀. 끝나면 바뀐 수와 실패 이유를 보인다.

import { Trans, useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useState } from "react";
import { priorityLabel, statusLabel } from "@/entities/post/lib/labels";
import { filterChip } from "@/features/filter-posts/ui/FilterBar";
import { SinglePick } from "@/features/filter-posts/ui/SinglePick";
import { invalidatePosts } from "@/shared/api/feed/post-queries";
import { postsApi } from "@/shared/api/feed/posts";
import type {
  BulkUpdateRequest,
  FeedUser,
  PostStatus,
  PostSummary,
  PostType,
  StatusNames,
  Team,
} from "@/shared/api/feed/types";
import { button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";
import "../config/messages";

type Patch = BulkUpdateRequest["patch"];

/** 보류·취소는 사유가 필요해 일괄 변경에서 뺀다 */
const BULK_STATUSES: PostStatus[] = [
  "unresolved",
  "in_progress",
  "in_review",
  "resolved",
];

export type BulkSummary = {
  updated: number;
  failed: { key: string; title: string; error: string }[];
};

const c = filterChip();

export function BulkBar({
  posts,
  selected,
  onSelectedChange,
  users,
  teams,
  postTypes,
  statusNames,
}: {
  posts: readonly PostSummary[];
  selected: ReadonlySet<string>;
  onSelectedChange: (ids: Set<string>) => void;
  users: readonly FeedUser[];
  teams: readonly Team[];
  postTypes: readonly PostType[];
  statusNames?: StatusNames;
}) {
  const { t } = useLingui();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<BulkSummary | null>(null);
  const [due, setDue] = useState("");

  const ids = posts.filter((p) => selected.has(p.id)).map((p) => p.id);

  async function apply(patch: Patch, what: string) {
    if (!ids.length) return;
    setBusy(true);
    setSummary(null);
    try {
      const r = await postsApi.bulk({ ids, patch });
      const byId = new Map(posts.map((p) => [p.id, p]));
      setSummary({
        updated: r.updated.length,
        failed: r.failed.map((f) => ({
          key: byId.get(f.id)?.key ?? f.id,
          title: byId.get(f.id)?.title ?? "",
          error: f.error,
        })),
      });
      // 실패한 것만 선택에 남겨 다시 시도하기 쉽게 한다
      onSelectedChange(new Set(r.failed.map((f) => f.id)));
      await invalidatePosts(client);
    } catch (e) {
      setSummary({
        updated: 0,
        failed: [
          {
            key: what,
            title: "",
            error: e instanceof Error ? e.message : String(e),
          },
        ],
      });
    } finally {
      setBusy(false);
    }
  }

  const none = {
    value: null,
    label: t({ message: "없음", context: "bulk edit: clear the field" }),
  } as const;
  const count = ids.length;
  const statusField = t`상태`;
  const priorityField = t`우선순위`;
  const assigneeField = t`담당자`;
  const dueField = t({ message: "기한", context: "bulk edit field: due date" });
  const postTypeField = t({
    message: "유형",
    context: "bulk edit field: post type",
  });
  const teamField = t`팀`;

  if (!ids.length && !summary) return null;
  const updated = summary?.updated ?? 0;
  const failed = summary?.failed.length ?? 0;

  return (
    <div className="flex flex-col gap-2">
      {ids.length > 0 && (
        <div
          role="toolbar"
          aria-label={t`일괄 변경`}
          className="flex flex-wrap items-center gap-1.5 rounded-lg border border-accent-line bg-accent-soft px-2.5 py-1.5"
        >
          <span className="text-xs font-semibold whitespace-nowrap text-accent tabular-nums">
            {t`${count}건 선택`}
          </span>
          {busy && <Spinner size="sm" />}
          <SinglePick
            label={statusField}
            showValue={false}
            disabled={busy}
            options={BULK_STATUSES.map((s) => ({
              value: s,
              label: statusLabel(s, statusNames),
            }))}
            onPick={(status) => apply({ status }, statusField)}
          />
          <SinglePick
            label={priorityField}
            showValue={false}
            disabled={busy}
            options={([4, 3, 2, 1, 0] as const).map((p) => ({
              value: p as number,
              label: priorityLabel(p),
            }))}
            onPick={(priority) => apply({ priority }, priorityField)}
          />
          <SinglePick<string | null>
            label={assigneeField}
            showValue={false}
            disabled={busy}
            options={[
              { value: null, label: t`담당자 없음` },
              ...users.map((u) => ({ value: u.id, label: u.name })),
            ]}
            onPick={(assigneeId) => apply({ assigneeId }, assigneeField)}
          />
          <SinglePick<string | null>
            label={dueField}
            showValue={false}
            disabled={busy}
            options={[{ value: null, label: t`기한 없애기` }]}
            onPick={() => apply({ dueDate: null }, dueField)}
            footer={(close) => (
              <form
                className="mt-2 flex items-center gap-1.5 border-t border-line pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!due) return;
                  close();
                  void apply({ dueDate: due }, dueField);
                }}
              >
                <input
                  type="date"
                  aria-label={t`새 기한`}
                  className={c.input({ class: "min-w-0 flex-1" })}
                  value={due}
                  onChange={(e) => setDue(e.currentTarget.value)}
                />
                <button
                  type="submit"
                  className={button({ size: "sm", variant: "primary" })}
                  disabled={!due}
                >
                  <Trans>적용</Trans>
                </button>
              </form>
            )}
          />
          <SinglePick<string | null>
            label={postTypeField}
            showValue={false}
            disabled={busy}
            options={[
              none,
              ...postTypes.map((pt) => ({ value: pt.id, label: pt.name })),
            ]}
            onPick={(postTypeId) => apply({ postTypeId }, postTypeField)}
          />
          <SinglePick<string | null>
            label={teamField}
            showValue={false}
            disabled={busy}
            options={[
              none,
              ...teams.map((tm) => ({ value: tm.id, label: tm.name })),
            ]}
            onPick={(teamId) => apply({ teamId }, teamField)}
          />
          <button
            type="button"
            className="ml-auto inline-flex h-7 cursor-pointer items-center gap-1 px-1.5 text-xs whitespace-nowrap text-fg-secondary hover:text-fg"
            onClick={() => onSelectedChange(new Set())}
          >
            <X size={12} aria-hidden="true" />
            <Trans>선택 해제</Trans>
          </button>
        </div>
      )}
      {summary && (
        <output
          className="flex flex-col gap-1 rounded-lg border border-line bg-elevated px-3 py-2 text-xs"
          aria-live="polite"
        >
          <span className="flex items-center gap-1.5">
            <CircleCheck size={14} className="text-accent" aria-hidden="true" />
            <span className="font-semibold">{t`${updated}건 바꿈`}</span>
            {summary.failed.length > 0 && (
              <span className="text-danger">{t`· ${failed}건 실패`}</span>
            )}
            <button
              type="button"
              className="ml-auto cursor-pointer text-fg-muted hover:text-fg"
              aria-label={t`결과 닫기`}
              onClick={() => setSummary(null)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
          {summary.failed.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {summary.failed.map((f) => (
                <li key={f.key} className="flex items-start gap-1.5">
                  <CircleAlert
                    size={12}
                    className="mt-0.5 flex-none text-danger"
                    aria-hidden="true"
                  />
                  <span className="font-mono text-fg-muted">{f.key}</span>
                  {f.title && <span className="truncate">{f.title}</span>}
                  <span className="text-danger">— {f.error}</span>
                </li>
              ))}
            </ul>
          )}
        </output>
      )}
    </div>
  );
}
