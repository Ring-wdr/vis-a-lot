"use client";

// 알림 설정 (/feed/settings/notifications): 이벤트 × 채널(앱 내·슬랙·이메일) 매트릭스. 고친 뒤 저장한다.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { CHANNEL_LABELS, NOTIFY_KIND_LABELS } from "@/entities/post/lib/labels";
import { errorMessage } from "@/entities/post/model/use-post-action";
import { notificationsApi } from "@/shared/api/feed/notifications";
import { feedKeys } from "@/shared/api/feed/queries";
import type { NotificationSetting, NotifyKind } from "@/shared/api/feed/types";
import { tv } from "@/shared/lib/tw";
import { showAlert } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { LoadingText, Spinner } from "@/shared/ui/Loading";
import {
  CHANNELS,
  type Channel,
  defaultSettings,
  KIND_DESCRIPTIONS,
  sameSettings,
} from "@/views/feed-settings-notifications/model/settings-model";

const settingsKey = [...feedKeys.notifications, "settings"] as const;

const cell = tv({
  base: "border-b border-line px-3 py-2 text-left align-middle",
  variants: { center: { true: "w-20 text-center" } },
});

export function NotificationSettingsView() {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: notificationsApi.settings,
    select: (r) => r.settings,
  });
  // 고치기 전이면 null (서버 값을 그대로 보여준다)
  const [draft, setDraft] = useState<NotificationSetting[] | null>(null);
  const save = useMutation({
    mutationFn: notificationsApi.saveSettings,
    onSuccess: (saved) => {
      client.setQueryData(settingsKey, saved);
      setDraft(null);
    },
    onError: (err) =>
      showAlert(`설정을 저장하지 못했습니다: ${errorMessage(err)}`),
  });

  const rows = draft ?? settings.data ?? [];
  const dirty =
    !!draft && !!settings.data && !sameSettings(draft, settings.data);
  const isDefault = sameSettings(
    rows,
    defaultSettings(rows.map((r) => r.kind)),
  );

  const toggle = (kind: NotifyKind, channel: Channel, on: boolean) =>
    setDraft(rows.map((r) => (r.kind === kind ? { ...r, [channel]: on } : r)));

  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-xl font-bold">알림 설정</h1>
      <p className="text-ui text-fg-secondary">
        이벤트마다 받을 채널을 고릅니다. 슬랙·이메일은 실제로 보내지 않고 발송
        로그에 남습니다. 내가 한 일은 알리지 않습니다.
      </p>
      {settings.isError ? (
        <p role="alert" className="text-ui text-danger">
          설정을 불러오지 못했습니다 ({settings.error.message})
        </p>
      ) : settings.isPending ? (
        <LoadingText>설정을 불러오는 중</LoadingText>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-elevated">
            <table className="w-full min-w-120 border-collapse text-ui">
              <caption className="sr-only">이벤트별 알림 채널</caption>
              <thead className="bg-panel text-xs text-fg-muted">
                <tr>
                  <th scope="col" className={cell()}>
                    이벤트
                  </th>
                  {CHANNELS.map((c) => (
                    <th key={c} scope="col" className={cell({ center: true })}>
                      {CHANNEL_LABELS[c]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.kind} className="hover:bg-panel-subtle">
                    <th scope="row" className={cell({ class: "font-normal" })}>
                      <span className="block font-semibold">
                        {NOTIFY_KIND_LABELS[r.kind]}
                      </span>
                      <span className="block text-xs text-fg-muted">
                        {KIND_DESCRIPTIONS[r.kind]}
                      </span>
                    </th>
                    {CHANNELS.map((c) => (
                      <td key={c} className={cell({ center: true })}>
                        <input
                          type="checkbox"
                          className="size-4 cursor-pointer accent-accent"
                          checked={r[c]}
                          disabled={save.isPending}
                          aria-label={`${NOTIFY_KIND_LABELS[r.kind]} ${CHANNEL_LABELS[c]}`}
                          onChange={(e) =>
                            toggle(r.kind, c, e.currentTarget.checked)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={button({ size: "sm" })}
              disabled={isDefault || save.isPending}
              onClick={() => setDraft(defaultSettings(rows.map((r) => r.kind)))}
            >
              <RotateCcw size={13} aria-hidden="true" />
              기본값으로
            </button>
            {dirty && (
              <span className="text-xs text-fg-muted" role="status">
                저장하지 않은 변경이 있습니다
              </span>
            )}
            <span className="ml-auto flex gap-1.5">
              {dirty && (
                <button
                  type="button"
                  className={button({ size: "sm" })}
                  disabled={save.isPending}
                  onClick={() => setDraft(null)}
                >
                  되돌리기
                </button>
              )}
              <button
                type="button"
                className={button({ size: "sm", variant: "primary" })}
                disabled={!dirty || save.isPending}
                onClick={() => draft && save.mutate(draft)}
              >
                {save.isPending ? (
                  <Spinner size="sm" tone="inherit" />
                ) : (
                  <Save size={13} aria-hidden="true" />
                )}
                저장
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
