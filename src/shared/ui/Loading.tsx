// 로딩 표시 모음. 빈 화면에 글자만 띄우지 않고, 무엇이 어디에 올지 자리를 잡아 보여준다.

import type { ReactNode } from "react";
import styles from "./Loading.module.css";

/** 도는 원. 버튼처럼 배경색이 있는 곳에서는 tone="inherit"로 글자색을 따른다. */
export function Spinner({
  size = "md",
  tone,
}: {
  size?: "sm" | "md" | "lg";
  tone?: "inherit";
}) {
  return (
    <span
      className={styles.spinner}
      data-size={size}
      data-tone={tone}
      aria-hidden="true"
    />
  );
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
    <output className={styles.loadingText}>{content}</output>
  ) : (
    <span className={styles.loadingText}>{content}</span>
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
      className={`${styles.skeleton} ${className ?? ""}`}
      data-width={width}
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
  return (
    <div className={styles.empty} data-size={size}>
      <span className={styles.emptyIcon} aria-hidden="true">
        {icon}
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {children && <div className={styles.emptyBody}>{children}</div>}
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
    <main className={styles.boot} aria-busy={!error}>
      <div className={styles.bootCard}>
        <span className={styles.bootBrand}>vis-a-lot</span>
        <ol className={styles.bootSteps} aria-hidden="true">
          {BOOT_STEPS.map((s, i) => (
            <li
              key={s}
              data-state={
                i < current ? "done" : i === current ? "current" : "todo"
              }
            />
          ))}
        </ol>
        {error ? (
          <>
            <p role="alert" className={styles.bootError}>
              {BOOT_MESSAGES[step]}에 실패했습니다: {error}
            </p>
            <button
              type="button"
              className={styles.bootRetry}
              onClick={() => location.reload()}
            >
              새로고침
            </button>
          </>
        ) : (
          <output className={styles.bootMessage}>
            <Spinner />
            {BOOT_MESSAGES[step]}
          </output>
        )}
      </div>
    </main>
  );
}
