"use client";

// 보드 드래그에서 사유가 필요한 전이(보류·취소·반려)를 묻는 팝업. 취소·Esc면 null로 끝난다.

import { Trans, useLingui } from "@lingui/react/macro";
import { overlay } from "overlay-kit";
import { useState } from "react";
import {
  cancelReasonLabels,
  holdReasonLabels,
} from "@/entities/post/lib/labels";
import type { CancelReason, HoldReason } from "@/shared/api/feed/types";
import { button } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import { Select } from "@/shared/ui/Select";
import "../config/messages";

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }));

const input =
  "rounded-md border border-line bg-elevated px-2 py-1.5 text-ui text-fg";

function addDays(today: string, days: number) {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

function Actions({
  onCancel,
  confirmLabel,
  disabled,
}: {
  onCancel: () => void;
  confirmLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className={dialogActions}>
      <button type="button" className={button()} onClick={onCancel}>
        <Trans context="dismiss dialog">취소</Trans>
      </button>
      <button
        type="submit"
        className={button({ variant: "primary" })}
        disabled={disabled}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function HoldForm({
  title,
  today,
  close,
}: {
  title: string;
  today: string;
  close: (v: { reason: HoldReason; holdUntil: string } | null) => void;
}) {
  const { t } = useLingui();
  const [reason, setReason] = useState<HoldReason | null>(null);
  const [until, setUntil] = useState(addDays(today, 7));
  return (
    <form
      className="flex w-80 max-w-full flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason && until) close({ reason, holdUntil: until });
      }}
    >
      <p className="font-semibold">{t`보류: ${title}`}</p>
      <Select
        label={t`사유`}
        value={reason}
        placeholder={t`사유를 고르세요`}
        options={options(holdReasonLabels())}
        onChange={setReason}
      />
      <label className="flex flex-col gap-1">
        <span className="text-xs text-fg-secondary">
          <Trans>재개 예정일</Trans>
        </span>
        <input
          type="date"
          className={input}
          value={until}
          min={addDays(today, 1)}
          required
          onChange={(e) => setUntil(e.currentTarget.value)}
        />
      </label>
      <Actions
        onCancel={() => close(null)}
        confirmLabel={t({ message: "보류", context: "confirm: put on hold" })}
        disabled={!reason || !until}
      />
    </form>
  );
}

function CancelForm({
  title,
  close,
}: {
  title: string;
  close: (v: CancelReason | null) => void;
}) {
  const { t } = useLingui();
  const [reason, setReason] = useState<CancelReason | null>(null);
  return (
    <form
      className="flex w-80 max-w-full flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason) close(reason);
      }}
    >
      <p className="font-semibold">{t`취소: ${title}`}</p>
      <Select
        label={t`사유`}
        value={reason}
        placeholder={t`사유를 고르세요`}
        options={options(cancelReasonLabels())}
        onChange={setReason}
      />
      <Actions
        onCancel={() => close(null)}
        confirmLabel={t`취소로 옮기기`}
        disabled={!reason}
      />
    </form>
  );
}

function RejectForm({
  title,
  close,
}: {
  title: string;
  close: (v: string | null) => void;
}) {
  const { t } = useLingui();
  const [comment, setComment] = useState("");
  return (
    <form
      className="flex w-80 max-w-full flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (comment.trim()) close(comment.trim());
      }}
    >
      <p className="font-semibold">{t`반려: ${title}`}</p>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-fg-secondary">
          <Trans>반려 사유 (댓글로 남습니다)</Trans>
        </span>
        <textarea
          className={input}
          rows={4}
          maxLength={2000}
          required
          // biome-ignore lint/a11y/noAutofocus: 팝업을 열면 바로 사유를 적는다
          autoFocus
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
        />
      </label>
      <Actions
        onCancel={() => close(null)}
        confirmLabel={t({ message: "반려", context: "confirm: reject" })}
        disabled={!comment.trim()}
      />
    </form>
  );
}

export const askHold = (title: string, today: string) =>
  overlay.openAsync<{ reason: HoldReason; holdUntil: string } | null>(
    ({ isOpen, close, unmount }) => (
      <Dialog isOpen={isOpen} onClose={() => close(null)} onExited={unmount}>
        <HoldForm title={title} today={today} close={close} />
      </Dialog>
    ),
  );

export const askCancel = (title: string) =>
  overlay.openAsync<CancelReason | null>(({ isOpen, close, unmount }) => (
    <Dialog isOpen={isOpen} onClose={() => close(null)} onExited={unmount}>
      <CancelForm title={title} close={close} />
    </Dialog>
  ));

export const askReject = (title: string) =>
  overlay.openAsync<string | null>(({ isOpen, close, unmount }) => (
    <Dialog isOpen={isOpen} onClose={() => close(null)} onExited={unmount}>
      <RejectForm title={title} close={close} />
    </Dialog>
  ));
