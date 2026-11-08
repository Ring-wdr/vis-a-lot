"use client";

// "뷰로 저장" 팝업: 이름과 공유 범위(개인 / 그룹 공유). 취소·Esc면 null.

import { Trans } from "@lingui/react/macro";
import { overlay } from "overlay-kit";
import { useState } from "react";

import { button } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import { segmented } from "@/shared/ui/segmented";
import "../config/messages";

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
      <p className="font-semibold">
        <Trans>뷰로 저장</Trans>
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-fg-secondary">
          <Trans context="saved view name">이름</Trans>
        </span>
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
          <Trans context="saved view sharing scope">공유</Trans>
        </legend>
        <div className={seg.root()}>
          <button
            type="button"
            className={seg.item()}
            aria-pressed={!shared}
            onClick={() => setShared(false)}
          >
            <Trans context="saved view sharing scope">개인</Trans>
          </button>
          <button
            type="button"
            className={seg.item()}
            aria-pressed={shared}
            disabled={!groupName}
            onClick={() => setShared(true)}
          >
            {groupName ? (
              <Trans comment="groupName: 그룹 이름">{groupName} 공유</Trans>
            ) : (
              <Trans context="saved view sharing scope">그룹 공유</Trans>
            )}
          </button>
        </div>
        <p className="text-2xs text-fg-muted">
          {shared ? (
            <Trans>
              그룹 멤버 모두가 이 뷰를 봅니다. 고치기는 만든 사람과 그룹
              관리자만 합니다.
            </Trans>
          ) : (
            <Trans>나만 봅니다.</Trans>
          )}
        </p>
      </fieldset>
      <div className={dialogActions}>
        <button type="button" className={button()} onClick={() => close(null)}>
          <Trans context="save view dialog">취소</Trans>
        </button>
        <button
          type="submit"
          className={button({ variant: "primary" })}
          disabled={!name.trim()}
        >
          <Trans context="save view dialog">저장</Trans>
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
