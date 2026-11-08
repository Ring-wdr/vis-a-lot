"use client";

// "뷰로 저장" 팝업: 이름과 공유 범위(개인 / 그룹 공유). 취소·Esc면 null.

import { overlay } from "overlay-kit";
import { useState } from "react";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { button } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import { segmented } from "@/shared/ui/segmented";

const messages = defineMessages({
  ko: {
    title: "뷰로 저장",
    name: "이름",
    sharing: "공유",
    personal: "개인",
    groupShare: (group: string) => `${group} 공유`,
    groupShareFallback: "그룹 공유",
    sharedHint:
      "그룹 멤버 모두가 이 뷰를 봅니다. 고치기는 만든 사람과 그룹 관리자만 합니다.",
    personalHint: "나만 봅니다.",
    cancel: "취소",
    save: "저장",
  },
  en: {
    title: "Save as view",
    name: "Name",
    sharing: "Sharing",
    personal: "Personal",
    groupShare: (group: string) => `Share with ${group}`,
    groupShareFallback: "Group",
    sharedHint:
      "All group members can see this view. Only its creator and group admins can edit it.",
    personalHint: "Only you can see it.",
    cancel: "Cancel",
    save: "Save",
  },
});

const seg = segmented();

export type SaveViewAnswer = { name: string; shared: boolean };

function SaveViewForm({
  defaultName,
  defaultShared,
  groupName,
  close,
}: {
  defaultName: string;
  defaultShared: boolean;
  /** 공유할 그룹 이름. 없으면 개인으로만 저장한다 */
  groupName?: string;
  close: (v: SaveViewAnswer | null) => void;
}) {
  const text = useT(messages);
  const [name, setName] = useState(defaultName);
  const [shared, setShared] = useState(defaultShared && !!groupName);
  return (
    <form
      className="flex w-80 max-w-full flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) close({ name: name.trim(), shared });
      }}
    >
      <p className="font-semibold">{text.title}</p>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-fg-secondary">{text.name}</span>
        <input
          className="rounded-md border border-line bg-elevated px-2 py-1.5"
          value={name}
          maxLength={60}
          required
          // biome-ignore lint/a11y/noAutofocus: 팝업을 열면 바로 이름을 적는다
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setName(e.currentTarget.value)}
        />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-fg-secondary">
          {text.sharing}
        </legend>
        <div className={seg.root()}>
          <button
            type="button"
            className={seg.item()}
            aria-pressed={!shared}
            onClick={() => setShared(false)}
          >
            {text.personal}
          </button>
          <button
            type="button"
            className={seg.item()}
            aria-pressed={shared}
            disabled={!groupName}
            onClick={() => setShared(true)}
          >
            {groupName ? text.groupShare(groupName) : text.groupShareFallback}
          </button>
        </div>
        <p className="text-2xs text-fg-muted">
          {shared ? text.sharedHint : text.personalHint}
        </p>
      </fieldset>
      <div className={dialogActions}>
        <button type="button" className={button()} onClick={() => close(null)}>
          {text.cancel}
        </button>
        <button
          type="submit"
          className={button({ variant: "primary" })}
          disabled={!name.trim()}
        >
          {text.save}
        </button>
      </div>
    </form>
  );
}

export const askSaveView = (opts: {
  defaultName: string;
  defaultShared?: boolean;
  groupName?: string;
}) =>
  overlay.openAsync<SaveViewAnswer | null>(({ isOpen, close, unmount }) => (
    <Dialog isOpen={isOpen} onClose={() => close(null)} onExited={unmount}>
      <SaveViewForm
        defaultName={opts.defaultName}
        defaultShared={opts.defaultShared ?? false}
        groupName={opts.groupName}
        close={close}
      />
    </Dialog>
  ));
