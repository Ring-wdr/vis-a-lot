"use client";

// 빠른 생성 모달 (C 키, 팔레트): 제목 + 그룹 + 형식, 나머지는 기본값. 만든 뒤 옆 패널로 연다.

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { overlay } from "overlay-kit";
import { useId, useState } from "react";
import { FORMAT_LABELS } from "@/entities/post/lib/labels";
import { errorMessage } from "@/entities/post/model/use-post-action";
import { field } from "@/entities/post/ui/styles";
import { invalidatePosts } from "@/shared/api/feed/post-queries";
import { postsApi } from "@/shared/api/feed/posts";
import { useGroups } from "@/shared/api/feed/queries";
import type { Group, PostFormat } from "@/shared/api/feed/types";
import { FEED } from "@/shared/config/feed-routes";
import { button } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import { Spinner } from "@/shared/ui/Loading";
import { Select } from "@/shared/ui/Select";

export type QuickCreateOptions = {
  /** 기본 그룹 (키 접두사 또는 id). 지금 보고 있는 그룹 */
  groupId?: string;
  /** 만든 게시물을 열 때 (보통 useOpenPeek) */
  onCreated?: (key: string) => void;
};

export const FORMAT_OPTIONS = (
  Object.entries(FORMAT_LABELS) as [PostFormat, string][]
).map(([value, label]) => ({ value, label }));

/** 기본 그룹: 키 접두사나 id가 맞는 그룹, 없으면 첫 그룹 */
export function defaultGroup(groups: Group[], hint?: string | null) {
  const h = hint?.trim();
  const match = h
    ? groups.find(
        (g) => g.id === h || g.keyPrefix.toUpperCase() === h.toUpperCase(),
      )
    : undefined;
  return match ?? groups[0];
}

function QuickCreateDialog({
  isOpen,
  close,
  unmount,
  options,
}: {
  isOpen: boolean;
  close: () => void;
  unmount: () => void;
  options: QuickCreateOptions;
}) {
  const titleId = useId();
  const client = useQueryClient();
  const groups = useGroups();
  const [title, setTitle] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [format, setFormat] = useState<PostFormat>("image");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = groups.data ?? [];
  const group = groupId ?? defaultGroup(list, options.groupId)?.id ?? null;

  const submit = async () => {
    const t = title.trim();
    if (!t) return setError("제목을 적어 주세요.");
    if (!group) return setError("그룹을 골라 주세요.");
    setSaving(true);
    setError(null);
    try {
      const created = await postsApi.create({
        groupId: group,
        title: t,
        format,
        priority: 2,
        stakeholderIds: [],
        checklist: [],
        tags: [],
        attachments: [],
      });
      await invalidatePosts(client);
      close();
      options.onCreated?.(created.key);
    } catch (err) {
      setError(`만들지 못했습니다: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      onExited={unmount}
      labelledBy={titleId}
      className="w-[min(30rem,calc(100vw-2rem))] max-w-none bg-elevated text-fg"
    >
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h2 id={titleId} className="text-base font-semibold">
          빠른 생성
        </h2>
        <input
          className={field({ class: "h-9 text-sm" })}
          value={title}
          maxLength={200}
          placeholder="제목"
          aria-label="제목"
          aria-invalid={!!error && !title.trim()}
          autoFocus
          onChange={(e) => {
            setTitle(e.currentTarget.value);
            setError(null);
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="그룹"
            value={group}
            placeholder={groups.isPending ? "불러오는 중" : "그룹 없음"}
            options={list.map((g) => ({
              value: g.id,
              label: `${g.name} (${g.keyPrefix})`,
            }))}
            onChange={setGroupId}
          />
          <Select
            label="형식"
            value={format}
            options={FORMAT_OPTIONS}
            onChange={setFormat}
          />
        </div>
        {groups.isError && (
          <p role="alert" className="text-xs text-danger">
            그룹을 불러오지 못했습니다: {groups.error.message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <div className={dialogActions}>
          <Link
            href={FEED.new}
            className={button({ class: "mr-auto" })}
            onClick={close}
          >
            전체 폼으로
          </Link>
          <button type="button" className={button()} onClick={close}>
            닫기
          </button>
          <button
            type="submit"
            className={button({ variant: "primary" })}
            disabled={saving}
          >
            {saving && <Spinner size="sm" tone="inherit" />}
            만들기
          </button>
        </div>
        <p className="text-2xs text-fg-muted">
          Enter로 만들고 옆 패널에서 나머지를 채웁니다.
        </p>
      </form>
    </Dialog>
  );
}

export function openQuickCreate(options: QuickCreateOptions = {}) {
  overlay.open(({ isOpen, close, unmount }) => (
    <QuickCreateDialog
      isOpen={isOpen}
      close={close}
      unmount={unmount}
      options={options}
    />
  ));
}
