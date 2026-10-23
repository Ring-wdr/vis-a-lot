"use client";

// 고른 게시물 일괄 변경 줄: 상태·우선순위·담당자·기한·유형·팀. 끝나면 바뀐 수와 실패 이유를 보인다.

import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useState } from "react";
import { PRIORITY_LABELS, statusLabel } from "@/entities/post/lib/labels";
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

  const none = { value: null, label: "없음" } as const;

  if (!ids.length && !summary) return null;

  return (
    <div className="flex flex-col gap-2">
      {ids.length > 0 && (
        <div
          role="toolbar"
          aria-label="일괄 변경"
          className="flex flex-wrap items-center gap-1.5 rounded-lg border border-accent-line bg-accent-soft px-2.5 py-1.5"
        >
          <span className="text-xs font-semibold text-accent tabular-nums">
            {ids.length}건 선택
          </span>
          {busy && <Spinner size="sm" />}
          <SinglePick
            label="상태"
            showValue={false}
            disabled={busy}
            options={BULK_STATUSES.map((s) => ({
              value: s,
              label: statusLabel(s, statusNames),
            }))}
            onPick={(status) => apply({ status }, "상태")}
          />
          <SinglePick
            label="우선순위"
            showValue={false}
            disabled={busy}
            options={([4, 3, 2, 1, 0] as const).map((p) => ({
              value: p as number,
              label: PRIORITY_LABELS[p],
            }))}
            onPick={(priority) => apply({ priority }, "우선순위")}
          />
          <SinglePick<string | null>
            label="담당자"
            showValue={false}
            disabled={busy}
            options={[
              { value: null, label: "담당자 없음" },
              ...users.map((u) => ({ value: u.id, label: u.name })),
            ]}
            onPick={(assigneeId) => apply({ assigneeId }, "담당자")}
          />
          <SinglePick<string | null>
            label="기한"
            showValue={false}
            disabled={busy}
            options={[{ value: null, label: "기한 없애기" }]}
            onPick={() => apply({ dueDate: null }, "기한")}
            footer={(close) => (
              <form
                className="mt-2 flex items-center gap-1.5 border-t border-line pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!due) return;
                  close();
                  void apply({ dueDate: due }, "기한");
                }}
              >
                <input
                  type="date"
                  aria-label="새 기한"
                  className={c.input({ class: "min-w-0 flex-1" })}
                  value={due}
                  onChange={(e) => setDue(e.currentTarget.value)}
                />
                <button
                  type="submit"
                  className={button({ size: "sm", variant: "primary" })}
                  disabled={!due}
                >
                  적용
                </button>
              </form>
            )}
          />
          <SinglePick<string | null>
            label="유형"
            showValue={false}
            disabled={busy}
            options={[
              none,
              ...postTypes.map((t) => ({ value: t.id, label: t.name })),
            ]}
            onPick={(postTypeId) => apply({ postTypeId }, "유형")}
          />
          <SinglePick<string | null>
            label="팀"
            showValue={false}
            disabled={busy}
            options={[
              none,
              ...teams.map((t) => ({ value: t.id, label: t.name })),
            ]}
            onPick={(teamId) => apply({ teamId }, "팀")}
          />
          <button
            type="button"
            className="ml-auto inline-flex h-7 cursor-pointer items-center gap-1 px-1.5 text-xs text-fg-secondary hover:text-fg"
            onClick={() => onSelectedChange(new Set())}
          >
            <X size={12} aria-hidden="true" />
            선택 해제
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
            <span className="font-semibold">{summary.updated}건 바꿈</span>
            {summary.failed.length > 0 && (
              <span className="text-danger">
                · {summary.failed.length}건 실패
              </span>
            )}
            <button
              type="button"
              className="ml-auto cursor-pointer text-fg-muted hover:text-fg"
              aria-label="결과 닫기"
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
