"use client";

// 알림 설정 (/feed/settings/notifications): 이벤트 × 채널(앱 내·슬랙·이메일) 매트릭스. 고친 뒤 저장한다.

import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { channelLabels, notifyKindLabels } from "@/entities/post/lib/labels";
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
  kindDescription,
  sameSettings,
} from "@/views/feed-settings-notifications/model/settings-model";
import "../config/messages";

const settingsKey = [...feedKeys.notifications, "settings"] as const;

const cell = tv({
  base: "border-b border-line px-3 py-2 text-left align-middle",
  variants: { center: { true: "w-20 text-center" } },
});

export function NotificationSettingsView() {
  const { t } = useLingui();
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
    onError: (err) => {
      const error = errorMessage(err);
      showAlert(t`설정을 저장하지 못했습니다: ${error}`);
    },
  });

  const channelLabel = channelLabels();
  const kindLabel = notifyKindLabels();
  const rows = draft ?? settings.data ?? [];
  const dirty =
    !!draft && !!settings.data && !sameSettings(draft, settings.data);
  const isDefault = sameSettings(
    rows,
    defaultSettings(rows.map((r) => r.kind)),
  );

  const toggleLabel = (kind: string, channel: string) =>
    t({
      message: `${kind} ${channel}`,
      comment: "체크박스 이름. kind는 알림 이벤트 이름, channel은 채널 이름",
    });

  const toggle = (kind: NotifyKind, channel: Channel, on: boolean) =>
    setDraft(rows.map((r) => (r.kind === kind ? { ...r, [channel]: on } : r)));

  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-xl font-bold">
        <Trans>알림 설정</Trans>
      </h1>
      <p className="text-ui text-fg-secondary">
        <Trans>
          이벤트마다 받을 채널을 고릅니다. 슬랙·이메일은 실제로 보내지 않고 발송
          로그에 남습니다. 내가 한 일은 알리지 않습니다.
        </Trans>
      </p>
      {settings.isError ? (
        <p role="alert" className="text-ui text-danger">
          <Trans>설정을 불러오지 못했습니다 ({settings.error.message})</Trans>
        </p>
      ) : settings.isPending ? (
        <LoadingText>
          <Trans>설정을 불러오는 중</Trans>
        </LoadingText>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-elevated">
            <table className="w-full min-w-120 border-collapse text-ui">
              <caption className="sr-only">
                <Trans>이벤트별 알림 채널</Trans>
              </caption>
              <thead className="bg-panel text-xs text-fg-muted">
                <tr>
                  <th scope="col" className={cell()}>
                    <Trans>이벤트</Trans>
                  </th>
                  {CHANNELS.map((c) => (
                    <th key={c} scope="col" className={cell({ center: true })}>
                      {channelLabel[c]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.kind} className="hover:bg-panel-subtle">
                    <th scope="row" className={cell({ class: "font-normal" })}>
                      <span className="block font-semibold">
                        {kindLabel[r.kind]}
                      </span>
                      <span className="block text-xs text-fg-muted">
                        {kindDescription(r.kind)}
                      </span>
                    </th>
                    {CHANNELS.map((c) => (
                      <td key={c} className={cell({ center: true })}>
                        <input
                          type="checkbox"
                          className="size-4 cursor-pointer accent-accent"
                          checked={r[c]}
                          disabled={save.isPending}
                          aria-label={toggleLabel(
                            kindLabel[r.kind],
                            channelLabel[c],
                          )}
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
              <Trans>기본값으로</Trans>
            </button>
            {dirty && (
              <span className="text-xs text-fg-muted" role="status">
                <Trans>저장하지 않은 변경이 있습니다</Trans>
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
                  <Trans>되돌리기</Trans>
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
                <Trans context="save notification settings">저장</Trans>
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
