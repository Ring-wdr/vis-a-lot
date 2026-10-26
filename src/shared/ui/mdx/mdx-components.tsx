import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn, tv } from "@/shared/lib/tw";

/** 본문 안 안내 상자. MDX에서 `<Callout>`, `<Callout tone="warn">`으로 쓴다. */
const callout = tv({
  base: "my-4 flex flex-col gap-1 rounded-lg border px-4 py-3 text-sm",
  variants: {
    tone: {
      info: "border-accent-line bg-accent-soft",
      warn: "border-danger/40 bg-danger/8",
    },
  },
  defaultVariants: { tone: "info" },
});

export function Callout({
  tone,
  title,
  children,
}: {
  tone?: "info" | "warn";
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className={callout({ tone })}>
      {title && <strong className="font-semibold">{title}</strong>}
      <div className="text-fg-secondary">{children}</div>
    </aside>
  );
}

/** 키보드 키. 예: `<Kbd>Esc</Kbd>` */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-line bg-elevated px-1.5 py-0.5 font-mono text-xs shadow-xs">
      {children}
    </kbd>
  );
}

/** 같은 사이트 안 링크는 next/link로, 밖으로 나가는 링크는 새 탭으로 연다. */
function Anchor({ href = "", className, ...props }: ComponentProps<"a">) {
  const cls = cn(
    "text-accent underline decoration-accent-line underline-offset-2 hover:decoration-accent",
    className,
  );
  if (href.startsWith("/") || href.startsWith("#")) {
    return <Link href={href} className={cls} {...props} />;
  }
  return (
    <a
      href={href}
      className={cls}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  );
}

/**
 * MDX가 만드는 HTML 요소의 모양. 루트의 mdx-components.tsx가 이 표를 넘긴다.
 * 자손 선택자를 쓰지 않도록 요소마다 클래스를 직접 단다 (docs/styling.md).
 */
export const MDX_COMPONENTS: MDXComponents = {
  h1: (props) => (
    <h1 className="mb-2 text-xl font-bold tracking-tight" {...props} />
  ),
  h2: (props) => (
    <h2
      className="mt-10 mb-3 scroll-mt-6 border-b border-line pb-2 text-base font-semibold"
      {...props}
    />
  ),
  h3: (props) => (
    <h3 className="mt-7 mb-2 scroll-mt-6 text-sm font-semibold" {...props} />
  ),
  p: (props) => <p className="my-3 text-sm/6" {...props} />,
  ul: (props) => (
    <ul
      className="my-3 flex list-disc flex-col gap-1.5 pl-5 text-sm/6"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="my-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm/6"
      {...props}
    />
  ),
  li: (props) => <li className="pl-1 marker:text-fg-muted" {...props} />,
  a: Anchor,
  strong: (props) => <strong className="font-semibold text-fg" {...props} />,
  code: (props) => (
    <code
      className="rounded-sm bg-panel-strong px-1 py-0.5 font-mono text-xs"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="my-4 overflow-x-auto rounded-lg border border-line bg-panel p-4 font-mono text-xs/5"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="my-4 border-l-2 border-line-strong pl-4 text-fg-secondary"
      {...props}
    />
  ),
  hr: () => <hr className="my-8 border-line" />,
  table: (props) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-ui" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-panel" {...props} />,
  tr: (props) => (
    <tr className="border-b border-line last:border-b-0" {...props} />
  ),
  th: (props) => (
    <th
      className="px-3 py-2 font-semibold whitespace-nowrap text-fg-secondary"
      {...props}
    />
  ),
  td: (props) => <td className="px-3 py-2 align-top" {...props} />,
  Callout,
  Kbd,
};
