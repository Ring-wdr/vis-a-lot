"use client";

// 기본 정보: 이름, 설명, 비공개 여부, 이슈 키 접두사.

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { field } from "@/entities/post/ui/styles";
import { groupsApi } from "@/shared/api/feed/groups";
import type { GroupDetail, UpdateGroupRequest } from "@/shared/api/feed/types";
import { FEED, groupHref } from "@/shared/config/feed-routes";
import { button } from "@/shared/ui/button";
import { settings } from "@/shared/ui/feed-settings-styles";
import { Spinner } from "@/shared/ui/Loading";
import type { useGroupEdit } from "@/views/feed-settings-group/model/use-group-edit";

const s = settings();

/** 대문자로 시작하는 대문자·숫자 2~6자 (서버 규칙과 같다) */
export const KEY_PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;

type Draft = {
  name: string;
  description: string;
  isPrivate: boolean;
  keyPrefix: string;
};

const draftOf = (g: GroupDetail): Draft => ({
  name: g.name,
  description: g.description ?? "",
  isPrivate: g.isPrivate,
  keyPrefix: g.keyPrefix,
});

/** 바뀐 칸만 담은 patch. 바뀐 것이 없으면 빈 객체 */
export function basicPatch(group: GroupDetail, d: Draft): UpdateGroupRequest {
  const patch: UpdateGroupRequest = {};
  const name = d.name.trim();
  const description = d.description.trim() || null;
  if (name !== group.name) patch.name = name;
  if (description !== (group.description ?? null))
    patch.description = description;
  if (d.isPrivate !== group.isPrivate) patch.isPrivate = d.isPrivate;
  if (d.keyPrefix !== group.keyPrefix) patch.keyPrefix = d.keyPrefix;
  return patch;
}

export function BasicSection({
  group,
  edit,
}: {
  group: GroupDetail;
  edit: ReturnType<typeof useGroupEdit>;
}) {
  const id = useId();
  const router = useRouter();
  // 서버 값이 바뀌면(다른 곳에서 저장) 초안을 새로 잡는다
  const [base, setBase] = useState(group);
  const [draft, setDraft] = useState(() => draftOf(group));
  if (base !== group) {
    setBase(group);
    setDraft(draftOf(group));
  }
  const patch = basicPatch(group, draft);
  const dirty = Object.keys(patch).length > 0;
  const prefixOk = KEY_PREFIX_PATTERN.test(draft.keyPrefix);
  const nameOk = draft.name.trim().length > 0;
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const save = async () => {
    if (!dirty || !prefixOk || !nameOk) return;
    const ok = await edit.run("basic", "기본 정보를 저장하지 못했습니다", () =>
      groupsApi.update(group.id, patch),
    );
    // 주소의 ?g=는 접두사라 바뀌면 새 접두사로 옮긴다
    if (ok && patch.keyPrefix)
      router.replace(groupHref(FEED.settingsGroup, patch.keyPrefix));
  };

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={s.sectionTitle()}>
        기본 정보
      </h2>
      <form
        className="flex min-w-0 flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <label className={s.label()}>
            이름
            <input
              className={field()}
              value={draft.name}
              maxLength={60}
              required
              aria-invalid={!nameOk}
              onChange={(e) => set({ name: e.currentTarget.value })}
            />
          </label>
          <label className={s.label()}>
            이슈 키 접두사
            <input
              className={field({ class: "font-mono uppercase" })}
              value={draft.keyPrefix}
              maxLength={6}
              aria-invalid={!prefixOk}
              aria-describedby={`${id}-prefix`}
              onChange={(e) =>
                set({
                  keyPrefix: e.currentTarget.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, ""),
                })
              }
            />
          </label>
        </div>
        <p id={`${id}-prefix`} className={s.warn()}>
          접두사를 바꿔도 기존 게시물의 키(
          <span className="font-mono">{group.keyPrefix}-12</span>)는 그대로이고,
          새 게시물부터 새 접두사를 씁니다.
        </p>
        {!prefixOk && (
          <p role="alert" className="text-xs text-danger">
            접두사는 영문 대문자로 시작하는 대문자·숫자 2~6자입니다.
          </p>
        )}
        <label className={s.label()}>
          설명
          <textarea
            className={field({ class: "h-auto min-h-16 py-1.5" })}
            value={draft.description}
            maxLength={500}
            rows={2}
            onChange={(e) => set({ description: e.currentTarget.value })}
          />
        </label>
        <label className="flex items-start gap-2 text-ui">
          <input
            type="checkbox"
            className="mt-0.5 size-4 flex-none accent-accent"
            checked={draft.isPrivate}
            onChange={(e) => set({ isPrivate: e.currentTarget.checked })}
          />
          <span className="flex flex-col">
            비공개 그룹
            <span className={s.hint()}>
              멤버와 시스템 관리자만 이 그룹과 게시물을 봅니다.
            </span>
          </span>
        </label>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && (
            <button
              type="button"
              className={button({ size: "sm" })}
              onClick={() => setDraft(draftOf(group))}
            >
              되돌리기
            </button>
          )}
          <button
            type="submit"
            className={button({ variant: "primary", size: "sm" })}
            disabled={!dirty || !prefixOk || !nameOk || !!edit.pending}
          >
            {edit.pending === "basic" && <Spinner size="sm" tone="inherit" />}
            저장
          </button>
        </div>
      </form>
    </section>
  );
}
