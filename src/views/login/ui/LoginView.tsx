"use client";

import { LoginForm } from "@/features/auth/ui/LoginForm";

export function LoginView({ notice }: { notice?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-surface p-4 text-fg">
      <section
        className="w-[min(22.5rem,100%)] rounded-lg border border-line bg-elevated px-6 py-7 shadow-card"
        aria-labelledby="login-title"
      >
        <h1 id="login-title" className="text-xl font-bold">
          vis-a-lot
        </h1>
        <p className="mt-1 mb-5 text-ui text-fg-muted">
          서버사이드 렌더링 차트
        </p>
        <LoginForm notice={notice} />
      </section>
    </main>
  );
}
