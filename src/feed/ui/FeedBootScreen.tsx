import { button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";

/** 피드가 뜨기 전 화면. 실패하면 이유와 다시 시도 버튼을 보여준다. */
export function FeedBootScreen({
  message,
  error,
  onRetry,
}: {
  message: string;
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <main
      className="grid min-h-screen place-items-center bg-surface text-fg"
      aria-busy={!error}
    >
      <div className="flex w-[min(20rem,calc(100vw-2rem))] flex-col items-center gap-3.5 text-center">
        <span className="text-xl font-bold">피드</span>
        {error ? (
          <>
            <p role="alert" className="text-ui text-danger">
              {message}에 실패했습니다: {error}
            </p>
            {onRetry && (
              <button
                type="button"
                className={button({ size: "sm" })}
                onClick={onRetry}
              >
                다시 시도
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
