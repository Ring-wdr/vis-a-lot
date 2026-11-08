"use client";

// 게시물 찾기 입력: 제목·본문으로 찾고, 이슈 키(FD-12)를 적으면 그 게시물을 바로 찾는다. 상위 이슈·관계 추가에 쓴다.

import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { statusLabel } from "@/entities/post/lib/labels";
import { postsApi } from "@/shared/api/feed/posts";
import type { PostRef } from "@/shared/api/feed/types";
import { LoadingText } from "@/shared/ui/Loading";
import "../config/messages";
import { field } from "./styles";

const KEY_RE = /^[A-Za-z][A-Za-z0-9]*-\d+$/;

function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

async function search(q: string, groupId?: string): Promise<PostRef[]> {
  const groupIds = groupId ? [groupId] : undefined;
  const [byKey, list] = await Promise.all([
    KEY_RE.test(q)
      ? postsApi.get(q.toUpperCase()).catch(() => null)
      : Promise.resolve(null),
    postsApi.query({
      filter: { q, groupIds },
      sort: { field: "updatedAt", dir: "desc" },
      pinnedFirst: false,
      offset: 0,
      limit: 10,
    }),
  ]);
  const refs: PostRef[] = list.posts.map((p) => ({
    id: p.id,
    key: p.key,
    title: p.title,
    status: p.status,
    groupId: p.groupId,
  }));
  if (byKey && (!groupId || byKey.groupId === groupId))
    return [byKey, ...refs.filter((r) => r.id !== byKey.id)];
  return refs;
}

// props 기본값은 렌더마다 새로 만들지 않도록 모듈에 둔다.
const NO_EXCLUDE: readonly string[] = [];

export function PostPicker({
  groupId,
  exclude = NO_EXCLUDE,
  onPick,
  label,
  placeholder,
  disabled = false,
}: {
  /** 이 그룹 안에서만 찾는다 (그룹 id) */
  groupId?: string;
  /** 고를 수 없는 게시물 id (자기 자신 등) */
  exclude?: readonly string[];
  onPick: (post: PostRef) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { t } = useLingui();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(text.trim());
  const listId = useId();
  const results = useQuery({
    queryKey: ["feed", "posts", "picker", groupId ?? null, q],
    queryFn: () => search(q, groupId),
    enabled: open && q.length > 0,
    staleTime: 10_000,
  });
  const reason = results.error?.message ?? "";
  const items = (results.data ?? []).filter((p) => !exclude.includes(p.id));

  const pick = (p: PostRef) => {
    onPick(p);
    setText("");
    setOpen(false);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <input
        className={field()}
        role="combobox"
        aria-label={label}
        aria-expanded={open && q.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={text}
        placeholder={placeholder ?? t`키(FD-12)나 제목으로 찾기`}
        disabled={disabled}
        onChange={(e) => {
          setText(e.currentTarget.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const p = items[active];
            if (p) pick(p);
          } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {open && q.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label={t`${label} 결과`}
          className="z-popover absolute inset-x-0 top-full mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-elevated py-1 shadow-lg"
        >
          {results.isPending || q !== text.trim() ? (
            <div className="px-2 py-1.5">
              <LoadingText>{t`찾는 중`}</LoadingText>
            </div>
          ) : results.isError ? (
            <p className="px-2 py-1.5 text-xs text-danger">
              {t`찾지 못했습니다: ${reason}`}
            </p>
          ) : items.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-fg-muted">
              {t`맞는 게시물이 없습니다.`}
            </p>
          ) : (
            items.map((p, i) => (
              <div
                key={p.id}
                role="option"
                tabIndex={-1}
                aria-selected={i === active}
                className="flex cursor-pointer items-center gap-2 px-2 py-1.5 aria-selected:bg-accent-soft"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
              >
                <span className="flex-none text-xs font-semibold text-fg-secondary tabular-nums">
                  {p.key}
                </span>
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <span className="flex-none text-2xs text-fg-muted">
                  {statusLabel(p.status)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
