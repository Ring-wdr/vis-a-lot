"use client";

// 기본 정보: 이름, 설명, 비공개 여부, 이슈 키 접두사.

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { field } from "@/entities/post/ui/styles";
import { groupsApi } from "@/shared/api/feed/groups";
import type { GroupDetail, UpdateGroupRequest } from "@/shared/api/feed/types";
import { FEED, groupHref } from "@/shared/config/feed-routes";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { button } from "@/shared/ui/button";
import { settings } from "@/shared/ui/feed-settings-styles";
import { Spinner } from "@/shared/ui/Loading";
import type { useGroupEdit } from "@/views/feed-settings-group/model/use-group-edit";

const messages = defineMessages({
  ko: {
    saveFailed: "기본 정보를 저장하지 못했습니다",
    title: "기본 정보",
    name: "이름",
    keyPrefix: "이슈 키 접두사",
    prefixNoteBefore: "접두사를 바꿔도 기존 게시물의 키(",
    prefixNoteAfter: ")는 그대로이고, 새 게시물부터 새 접두사를 씁니다.",
    prefixInvalid: "접두사는 영문 대문자로 시작하는 대문자·숫자 2~6자입니다.",
    description: "설명",
    private: "비공개 그룹",
    privateHint: "멤버와 시스템 관리자만 이 그룹과 게시물을 봅니다.",
    revert: "되돌리기",
    save: "저장",
  },
  en: {
    saveFailed: "Couldn't save basic info",
    title: "Basic info",
    name: "Name",
    keyPrefix: "Issue key prefix",
    prefixNoteBefore: "Changing the prefix keeps existing post keys (",
    prefixNoteAfter: "); new posts use the new prefix.",
    prefixInvalid:
      "The prefix is 2–6 uppercase letters or digits, starting with a letter.",
    description: "Description",
    private: "Private group",
    privateHint:
      "Only members and system admins can see this group and its posts.",
    revert: "Revert",
    save: "Save",
  },
});

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
  const text = useT(messages);
  const id = useId();
  const router = useRouter();
  // 고친 칸만 들고 서버 값 위에 얹는다. 유형·팀을 저장해 그룹 값이 다시 와도 고치던 칸은 그대로다.
  const [edits, setEdits] = useState<Partial<Draft>>({});
  const draft = { ...draftOf(group), ...edits };
  const patch = basicPatch(group, draft);
  const dirty = Object.keys(patch).length > 0;
  const prefixOk = KEY_PREFIX_PATTERN.test(draft.keyPrefix);
  const nameOk = draft.name.trim().length > 0;
  const set = (p: Partial<Draft>) => setEdits((e) => ({ ...e, ...p }));

  const save = async () => {
    if (!dirty || !prefixOk || !nameOk) return;
    const ok = await edit.run("basic", text.saveFailed, () =>
      groupsApi.update(group.id, patch),
    );
    if (!ok) return;
    setEdits({});
    // 주소의 ?g=는 접두사라 바뀌면 새 접두사로 옮긴다
    if (patch.keyPrefix)
      router.replace(groupHref(FEED.settingsGroup, patch.keyPrefix));
  };

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={s.sectionTitle()}>
        {text.title}
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
            {text.name}
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
            {text.keyPrefix}
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
          {text.prefixNoteBefore}
          <span className="font-mono">{group.keyPrefix}-12</span>
          {text.prefixNoteAfter}
        </p>
        {!prefixOk && (
          <p role="alert" className="text-xs text-danger">
            {text.prefixInvalid}
          </p>
        )}
        <label className={s.label()}>
          {text.description}
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
            {text.private}
            <span className={s.hint()}>{text.privateHint}</span>
          </span>
        </label>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && (
            <button
              type="button"
              className={button({ size: "sm" })}
              onClick={() => setEdits({})}
            >
              {text.revert}
            </button>
          )}
          <button
            type="submit"
            className={button({ variant: "primary", size: "sm" })}
            disabled={!dirty || !prefixOk || !nameOk || !!edit.pending}
          >
            {edit.pending === "basic" && <Spinner size="sm" tone="inherit" />}
            {text.save}
          </button>
        </div>
      </form>
    </section>
  );
}
