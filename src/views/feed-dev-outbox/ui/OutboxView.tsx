"use client";

import { RefreshCw } from "lucide-react";
import { CHANNEL_LABELS } from "@/entities/post/lib/labels";
import { useOutbox } from "@/shared/api/feed/queries";
import { tv } from "@/shared/lib/tw";
import { button } from "@/shared/ui/button";
import { page } from "@/shared/ui/feed-styles";
import { EmptyState, LoadingText } from "@/shared/ui/Loading";

const p = page();

const dateTime = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "short",
  timeStyle: "short",
});

/** 표 칸 */
const cell = tv({
  base: "border-b border-line px-2 py-1.5 text-left align-top",
});

/** /feed/dev/outbox: 슬랙·이메일로 나갔을 메시지 (최근 순). 실제로는 보내지 않는다. */
export function OutboxView() {
  const outbox = useOutbox();
  const messages = [...(outbox.data ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className={p.root()}>
      <div className="flex items-center gap-2">
        <h1 className={p.title()}>발송 로그</h1>
        <button
          type="button"
          className={button({ size: "sm", class: "ml-auto" })}
          disabled={outbox.isFetching}
          onClick={() => outbox.refetch()}
        >
          <RefreshCw size={14} aria-hidden="true" />
          새로 고침
        </button>
      </div>
      <p className={p.lead()}>
        알림 설정에서 슬랙·이메일을 켠 알림이 실제로 나가는 대신 여기에
        남습니다.
      </p>

      {outbox.isPending ? (
        <LoadingText>발송 로그를 불러오는 중</LoadingText>
      ) : outbox.isError ? (
        <p role="alert" className="text-danger">
          발송 로그를 불러오지 못했습니다: {outbox.error.message}
        </p>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={<RefreshCw size={18} />}
          title="보낸 메시지가 없습니다"
        >
          배정·멘션·기한 알림 등이 생기면 여기에 쌓입니다.
        </EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-line bg-elevated">
          {/* 좁은 화면에서 내용 칸이 찌그러지지 않게 표 폭을 두고 가로로 스크롤한다 */}
          <table className="w-full min-w-160 border-collapse text-ui">
            <thead className="bg-panel text-xs text-fg-muted">
              <tr>
                <th className={cell()}>시각</th>
                <th className={cell()}>채널</th>
                <th className={cell()}>받는 사람</th>
                <th className={cell()}>제목</th>
                <th className={cell()}>내용</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td
                    className={cell({
                      class: "whitespace-nowrap tabular-nums",
                    })}
                  >
                    {dateTime.format(new Date(m.createdAt))}
                  </td>
                  <td className={cell({ class: "whitespace-nowrap" })}>
                    {CHANNEL_LABELS[m.channel]}
                  </td>
                  <td className={cell({ class: "whitespace-nowrap" })}>
                    {m.recipient}
                  </td>
                  <td className={cell()}>{m.subject ?? "—"}</td>
                  <td
                    className={cell({
                      class: "whitespace-pre-wrap text-fg-secondary",
                    })}
                  >
                    {m.body}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
