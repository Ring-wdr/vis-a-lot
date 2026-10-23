"use client";

// 전이에 입력이 필요한 팝업: 반려(댓글 필수), 보류(사유 + 재개일), 취소(사유). 취소·Esc면 null로 끝난다.

import { overlay } from "overlay-kit";
import { type ReactNode, useId, useState } from "react";
import {
  CANCEL_REASON_LABELS,
  HOLD_REASON_LABELS,
} from "@/entities/post/lib/labels";
import { field } from "@/entities/post/ui/styles";
import type { CancelReason, HoldReason } from "@/shared/api/feed/types";
import { button } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";

/** 로컬 날짜 YYYY-MM-DD */
export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function FormDialog({
  isOpen,
  onCancel,
  onExited,
  title,
  submitLabel,
  danger = false,
  onSubmit,
  children,
}: {
  isOpen: boolean;
  onCancel: () => void;
  onExited: () => void;
  title: string;
  submitLabel: string;
  danger?: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      onExited={onExited}
      labelledBy={titleId}
      className="w-[min(26rem,calc(100vw-2rem))] max-w-none bg-elevated text-fg"
    >
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {children}
        <div className={dialogActions}>
          <button type="button" className={button()} onClick={onCancel}>
            닫기
          </button>
          <button
            type="submit"
            className={button({ variant: danger ? "danger" : "primary" })}
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** 고르기 목록 (라디오) */
function ReasonPicker<T extends string>({
  name,
  legend,
  labels,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  labels: Record<T, string>;
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs text-fg-secondary">{legend}</legend>
      {(Object.keys(labels) as T[]).map((k) => (
        <label key={k} className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={name}
            value={k}
            checked={value === k}
            onChange={() => onChange(k)}
            className="accent-accent"
          />
          {labels[k]}
        </label>
      ))}
    </fieldset>
  );
}

function RejectForm({
  isOpen,
  close,
  unmount,
}: {
  isOpen: boolean;
  close: (v: string | null) => void;
  unmount: () => void;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  return (
    <FormDialog
      isOpen={isOpen}
      onCancel={() => close(null)}
      onExited={unmount}
      title="반려"
      submitLabel="반려"
      danger
      onSubmit={() => {
        const text = comment.trim();
        if (!text) return setError("반려 사유를 적어 주세요.");
        close(text);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs text-fg-secondary">
          무엇을 더 해야 하는지 댓글로 남깁니다 (필수)
        </span>
        <textarea
          className={field({ multiline: true, class: "font-sans text-ui" })}
          rows={4}
          maxLength={2000}
          value={comment}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          // biome-ignore lint/a11y/noAutofocus: 팝업을 열면 바로 사유를 적는다
          autoFocus
          onChange={(e) => {
            setComment(e.currentTarget.value);
            if (error) setError(null);
          }}
        />
      </label>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </FormDialog>
  );
}

export const askRejectComment = () =>
  overlay.openAsync<string | null>(({ isOpen, close, unmount }) => (
    <RejectForm isOpen={isOpen} close={close} unmount={unmount} />
  ));

export type HoldInput = { reason: HoldReason; holdUntil: string };

function HoldForm({
  isOpen,
  close,
  unmount,
}: {
  isOpen: boolean;
  close: (v: HoldInput | null) => void;
  unmount: () => void;
}) {
  const [reason, setReason] = useState<HoldReason | null>(null);
  const [until, setUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const today = localDay();
  return (
    <FormDialog
      isOpen={isOpen}
      onCancel={() => close(null)}
      onExited={unmount}
      title="보류"
      submitLabel="보류"
      onSubmit={() => {
        if (!reason) return setError("보류 사유를 골라 주세요.");
        if (!until) return setError("재개일을 정해 주세요.");
        if (until < today) return setError("재개일은 오늘 이후여야 합니다.");
        close({ reason, holdUntil: until });
      }}
    >
      <ReasonPicker
        name="hold-reason"
        legend="사유"
        labels={HOLD_REASON_LABELS}
        value={reason}
        onChange={(v) => {
          setReason(v);
          setError(null);
        }}
      />
      <label className="flex flex-col gap-1">
        <span className="text-xs text-fg-secondary">
          재개일 (이날 미해결로 돌아옵니다)
        </span>
        <input
          type="date"
          className={field()}
          min={today}
          value={until}
          onChange={(e) => {
            setUntil(e.currentTarget.value);
            setError(null);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </FormDialog>
  );
}

export const askHold = () =>
  overlay.openAsync<HoldInput | null>(({ isOpen, close, unmount }) => (
    <HoldForm isOpen={isOpen} close={close} unmount={unmount} />
  ));

function CancelForm({
  isOpen,
  close,
  unmount,
}: {
  isOpen: boolean;
  close: (v: CancelReason | null) => void;
  unmount: () => void;
}) {
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      isOpen={isOpen}
      onCancel={() => close(null)}
      onExited={unmount}
      title="취소"
      submitLabel="게시물 취소"
      danger
      onSubmit={() => {
        if (!reason) return setError("취소 사유를 골라 주세요.");
        close(reason);
      }}
    >
      <ReasonPicker
        name="cancel-reason"
        legend="사유"
        labels={CANCEL_REASON_LABELS}
        value={reason}
        onChange={(v) => {
          setReason(v);
          setError(null);
        }}
      />
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </FormDialog>
  );
}

export const askCancelReason = () =>
  overlay.openAsync<CancelReason | null>(({ isOpen, close, unmount }) => (
    <CancelForm isOpen={isOpen} close={close} unmount={unmount} />
  ));
