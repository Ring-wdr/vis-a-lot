"use client";

import { LoginForm } from "@/features/auth/ui/LoginForm";
import styles from "./LoginView.module.css";

export function LoginView({ notice }: { notice?: string }) {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <h1 id="login-title" className={styles.brand}>
          vis-a-lot
        </h1>
        <p className={styles.sub}>서버사이드 렌더링 차트</p>
        <LoginForm notice={notice} />
      </section>
    </main>
  );
}
