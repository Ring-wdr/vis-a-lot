"use client";

import { LoginForm } from "@/features/auth/ui/LoginForm";
import { defineMessages, useT } from "@/shared/lib/i18n";

const messages = defineMessages({
  ko: { tagline: "서버사이드 렌더링 차트" },
  en: { tagline: "Server-side rendered charts" },
});

export function LoginView({ notice }: { notice?: string }) {
  const text = useT(messages);
  return (
    <main className="grid min-h-screen place-items-center bg-surface p-4 text-fg">
      <section
        className="w-[min(22.5rem,100%)] rounded-lg border border-line bg-elevated px-6 py-7 shadow-card"
        aria-labelledby="login-title"
      >
        <h1 id="login-title" className="text-xl font-bold">
          vis-a-lot
        </h1>
        <p className="mt-1 mb-5 text-ui text-fg-muted">{text.tagline}</p>
        <LoginForm notice={notice} />
      </section>
    </main>
  );
}
