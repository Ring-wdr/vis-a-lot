// 로딩 표시 모음. 빈 화면에 글자만 띄우지 않고, 무엇이 어디에 올지 자리를 잡아 보여준다.

import type { ReactNode } from "react";
import { cn, tv } from "@/shared/lib/tw";
import { button } from "./button";

// 움직임을 줄이도록 설정한 사용자에게는 회전을 늦추고 반짝임을 멈춘다.
const spinner = tv({
  base: "inline-block size-4 flex-none animate-spin rounded-full border-2 border-line border-t-accent [animation-duration:0.8s] motion-reduce:[animation-duration:2.4s]",
  variants: {
    size: { sm: "size-3", md: "", lg: "size-6 border-3" },
    // 버튼 안(배경이 accent)에서는 글자색을 따른다.
    tone: { inherit: "border-current border-t-transparent opacity-80" },
  },
});

const loadingText = "inline-flex min-w-0 items-center gap-1.5 text-fg-muted";

const SKELETON_WIDTH = {
  30: "w-[30%]",
  50: "w-1/2",
  70: "w-[70%]",
  90: "w-[90%]",
} as const;

const emptyState = tv({
  slots: {
    root: "flex h-full min-h-40 flex-col items-center justify-center gap-1.5 p-6 text-center text-fg-muted",
    icon: "mb-1 grid size-11 place-items-center rounded-xl bg-panel text-fg-secondary",
    title: "font-semibold text-fg text-sm",
    body: "max-w-80 text-xs leading-normal",
  },
  variants: {
    size: {
      sm: {
        root: "h-auto min-h-0 px-2 py-4",
        icon: "size-8 rounded-lg",
        title: "text-ui",
      },
      md: {},
    },
  },
});

/** 도는 원. 버튼처럼 배경색이 있는 곳에서는 tone="inherit"로 글자색을 따른다. */
export function Spinner({
  size = "md",
  tone,
}: {
  size?: "sm" | "md" | "lg";
  tone?: "inherit";
}) {
  return <span className={spinner({ size, tone })} aria-hidden="true" />;
}

/**
 * spinner + 문구 한 줄. 화면 낭독기에는 문구가 상태로 읽힌다.
 * 같은 상태가 여러 곳에 동시에 뜨면(select placeholder 등) 하나만 announce한다.
 */
export function LoadingText({
  children,
  size = "sm",
  announce = true,
}: {
  children: ReactNode;
  size?: "sm" | "md";
  announce?: boolean;
}) {
  const content = (
    <>
      <Spinner size={size} />
      {children}
    </>
  );
  return announce ? (
    <output className={loadingText}>{content}</output>
  ) : (
    <span className={loadingText}>{content}</span>
  );
}

/** 내용이 올 자리를 잡아 두는 막대. 폭은 부모 대비 %다. */
export function Skeleton({
  width,
  className,
}: {
  width?: 30 | 50 | 70 | 90;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block h-2.5 animate-shimmer rounded-sm bg-linear-to-r bg-size-[200%_100%] from-line via-panel to-line motion-reduce:animate-none",
        width && SKELETON_WIDTH[width],
        className,
      )}
      aria-hidden="true"
    />
  );
}

/** 아무것도 없는 영역: 아이콘 + 제목 + 설명 */
export function EmptyState({
  icon,
  title,
  children,
  size = "md",
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  size?: "sm" | "md";
}) {
  const e = emptyState({ size });
  return (
    <div className={e.root()}>
      <span className={e.icon()} aria-hidden="true">
        {icon}
      </span>
      <p className={e.title()}>{title}</p>
      {children && <div className={e.body()}>{children}</div>}
    </div>
  );
}

/** 앱이 뜨기까지의 단계. 단계가 바뀌어도 같은 화면이라 깜빡이지 않는다. */
export const BOOT_STEPS = ["app", "server", "session"] as const;
export type BootStep = (typeof BOOT_STEPS)[number];

const BOOT_MESSAGES: Record<BootStep, string> = {
  app: "화면을 불러오는 중",
  server: "브라우저 안의 서버를 띄우는 중",
  session: "로그인 확인 중",
};

export function BootScreen({
  step,
  error,
}: {
  step: BootStep;
  /** 있으면 그 단계에서 멈춘 이유와 새로고침 버튼을 보여준다. */
  error?: string;
}) {
  const current = BOOT_STEPS.indexOf(step);
  return (
    <main
      className="grid min-h-screen place-items-center bg-surface text-fg"
      aria-busy={!error}
    >
      <div className="flex w-[min(20rem,calc(100vw-2rem))] flex-col items-center gap-3.5 text-center">
        <span className="font-bold text-xl">vis-a-lot</span>
        <ol className="flex gap-1.5" aria-hidden="true">
          {BOOT_STEPS.map((s, i) => (
            <li
              key={s}
              className="h-1 w-6 rounded-xs bg-line data-[state=current]:bg-accent-line data-[state=done]:bg-accent"
              data-state={
                i < current ? "done" : i === current ? "current" : "todo"
              }
            />
          ))}
        </ol>
        {error ? (
          <>
            <p role="alert" className="text-danger text-ui">
              {BOOT_MESSAGES[step]}에 실패했습니다: {error}
            </p>
            <button
              type="button"
              className={button({ class: "text-ui" })}
              onClick={() => location.reload()}
            >
              새로고침
            </button>
          </>
        ) : (
          <output className="inline-flex items-center gap-2 text-fg-secondary text-ui">
            <Spinner />
            {BOOT_MESSAGES[step]}
          </output>
        )}
      </div>
    </main>
  );
}
