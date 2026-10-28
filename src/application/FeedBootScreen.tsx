import { defineMessages, useT } from "@/shared/lib/i18n";
import { button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";

const messages = defineMessages({
  ko: {
    feed: "피드",
    failed: (message: string, error: string) => `${message}: ${error}`,
    retry: "다시 시도",
  },
  en: {
    feed: "Feed",
    failed: (message: string, error: string) => `${message}: ${error}`,
    retry: "Retry",
  },
});

/**
 * 피드가 뜨기 전 화면. 실패하면 이유와 다시 시도 버튼을 보여준다.
 * message는 받는 중이면 "…하는 중", 실패하면 "…하지 못했습니다" 같은 온전한 문장이다.
 */
export function FeedBootScreen({
  message,
  error,
  onRetry,
}: {
  message: string;
  error?: string;
  onRetry?: () => void;
}) {
  const text = useT(messages);
  return (
    <main
      className="grid min-h-screen place-items-center bg-surface text-fg"
      aria-busy={!error}
    >
      <div className="flex w-[min(20rem,calc(100vw-2rem))] flex-col items-center gap-3.5 text-center">
        <span className="text-xl font-bold">{text.feed}</span>
        {error ? (
          <>
            <p role="alert" className="text-ui text-danger">
              {text.failed(message, error)}
            </p>
            {onRetry && (
              <button
                type="button"
                className={button({ size: "sm" })}
                onClick={onRetry}
              >
                {text.retry}
              </button>
            )}
          </>
        ) : (
          <output className="inline-flex items-center gap-2 text-ui text-fg-secondary">
            <Spinner />
            {message}
          </output>
        )}
      </div>
    </main>
  );
}
