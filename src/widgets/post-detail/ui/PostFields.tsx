"use client";

// 필드 패널: 바꿀 때마다 postsApi.update로 저장한다. 상태는 머리의 전이 버튼으로만 바꾼다.

import { useState } from "react";
import { statusLabel } from "@/entities/post/lib/labels";
import {
  NONE,
  PRIORITY_OPTIONS,
  useGroupOptions,
} from "@/entities/post/model/options";
import { usePostAction } from "@/entities/post/model/use-post-action";
import { chip, field, fieldRow, statusBadge } from "@/entities/post/ui/styles";
import { TagInput } from "@/entities/post/ui/TagInput";
import { useUserMap } from "@/shared/api/feed/lookups";
import { postsApi } from "@/shared/api/feed/posts";
import type { Group, UpdatePostRequest } from "@/shared/api/feed/types";
import { dateTime } from "@/shared/lib/time";
import { OrderedSelect } from "@/shared/ui/OrderedSelect";
import { Select } from "@/shared/ui/Select";
import type { PostDetail } from "@/widgets/post-detail/model/detail-type";

const r = fieldRow();

function Row({
  label,
  wide = false,
  children,
}: {
  label: string;
  /** 두 칸일 때 한 줄을 다 쓴다 */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={r.root({ class: wide && "@lg:col-span-2" })}>
      <span className={r.label()}>{label}</span>
      <div className={r.value()}>{children}</div>
    </div>
  );
}

/** 진행률: 하위·체크리스트가 있으면 자동, 없으면 끌어서 정하고 놓을 때 저장 */
function ProgressField({
  post,
  save,
}: {
  post: PostDetail;
  save: (patch: UpdatePostRequest) => void;
}) {
  const auto = post.childCount > 0 || post.checklist.length > 0;
  const [value, setValue] = useState(post.progress);
  const commit = () => {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    if (v !== post.progress) save({ progress: v });
  };
  const bar = (
    <progress
      className="h-1.5 w-full accent-accent"
      max={100}
      value={post.progress}
    />
  );
  if (auto || !post.permissions.edit)
    return (
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 tabular-nums">
          {post.progress}%
          {auto && (
            <span
              className={chip()}
              title="하위 이슈(해결 비율)나 체크리스트(체크 비율)로 계산합니다"
            >
              자동
            </span>
          )}
        </span>
        {bar}
      </div>
    );
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        aria-label="진행률"
        className="min-w-0 flex-1 accent-accent"
        onChange={(e) => setValue(Number(e.currentTarget.value))}
        onPointerUp={commit}
        onKeyUp={commit}
      />
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        aria-label="진행률 (%)"
        className={field({ class: "w-16 tabular-nums" })}
        onChange={(e) => setValue(Number(e.currentTarget.value))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
    </div>
  );
}

export function PostFields({
  post,
  group,
}: {
  post: PostDetail;
  group: Group | undefined;
}) {
  const { run, pending } = usePostAction();
  const users = useUserMap();
  const o = useGroupOptions(post.groupId, [
    post.assigneeId,
    post.requesterId,
    ...post.stakeholderIds,
  ]);
  const editable = post.permissions.edit;
  const disabled = !editable || !!pending;
  const save = (patch: UpdatePostRequest) =>
    run("update", "바꾸지 못했습니다", () => postsApi.update(post.id, patch));
  const name = (id: string | null) =>
    id ? (users.get(id)?.name ?? id) : "없음";
  const orNull = (v: string) => (v === NONE ? null : v);

  return (
    // 옆 패널처럼 넓으면 두 칸, 전체 페이지의 오른쪽 열처럼 좁으면 한 칸
    <section
      className="@container rounded-lg border border-line bg-elevated p-3"
      aria-label="필드"
      aria-busy={!!pending}
    >
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
        <Row label="상태">
          <span className={statusBadge({ status: post.status })}>
            {statusLabel(post.status, group?.statusNames)}
          </span>
        </Row>
        <Select
          label="우선순위"
          value={post.priority}
          options={PRIORITY_OPTIONS}
          disabled={disabled}
          onChange={(priority) => save({ priority })}
        />
        <Select
          label="담당자"
          value={post.assigneeId ?? NONE}
          options={o.peopleOrNone}
          disabled={disabled}
          onChange={(v) => save({ assigneeId: orNull(v) })}
        />
        <div className="flex flex-col gap-1">
          <Select
            label="요청자"
            value={post.requesterId ?? NONE}
            options={o.peopleOrNone}
            disabled={disabled}
            onChange={(v) => save({ requesterId: orNull(v) })}
          />
          {!post.requesterId && (
            <p className="text-2xs text-fg-muted">
              비어 있으면 작성자({name(post.authorId)})가 요청자 역할을 합니다.
            </p>
          )}
        </div>
        <OrderedSelect
          label="이해관계자"
          options={o.people}
          value={post.stakeholderIds}
          disabled={disabled}
          placeholder="없음"
          onChange={(stakeholderIds) => save({ stakeholderIds })}
        />
        <Row label="기한">
          <input
            type="date"
            className={field()}
            value={post.dueDate ?? ""}
            disabled={disabled}
            aria-label="기한"
            onChange={(e) => {
              const v = e.currentTarget.value || null;
              if (v !== post.dueDate) save({ dueDate: v });
            }}
          />
        </Row>
        <Row label="진행률">
          <ProgressField key={post.progress} post={post} save={save} />
        </Row>
        <Select
          label="게시물 유형"
          value={post.postTypeId ?? NONE}
          options={o.postTypes}
          disabled={disabled}
          onChange={(v) => save({ postTypeId: orNull(v) })}
        />
        <Select
          label="팀"
          value={post.teamId ?? NONE}
          options={o.teams}
          disabled={disabled}
          onChange={(v) => save({ teamId: orNull(v) })}
        />
        <Row label="태그" wide>
          <TagInput
            value={post.tags}
            disabled={disabled}
            onChange={(tags) => save({ tags })}
          />
          {!editable && post.tags.length === 0 && (
            <span className="text-fg-muted">없음</span>
          )}
        </Row>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-line pt-3 text-xs @lg:col-span-2">
          <dt className="text-fg-secondary">작성자</dt>
          <dd>{name(post.authorId)}</dd>
          <dt className="text-fg-secondary">만든 시각</dt>
          <dd className="tabular-nums">
            {dateTime.format(new Date(post.createdAt))}
          </dd>
          <dt className="text-fg-secondary">갱신 시각</dt>
          <dd className="tabular-nums">
            {dateTime.format(new Date(post.updatedAt))}
          </dd>
          {post.resolvedAt && (
            <>
              <dt className="text-fg-secondary">해결 시각</dt>
              <dd className="tabular-nums">
                {dateTime.format(new Date(post.resolvedAt))}
              </dd>
            </>
          )}
        </dl>
      </div>
    </section>
  );
}
