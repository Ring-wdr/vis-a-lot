"use client";

import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { login } from "@/shared/api/session";
import { Spinner } from "@/shared/ui/Loading";
import styles from "./LoginForm.module.css";

/** mock 계정으로 로그인한다. 토큰은 auth 서비스가 발급하고 세션 store가 들고 있는다. */
export function LoginForm({ notice }: { notice?: string }) {
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("");
  const errorId = useId();
  const submit = useMutation({
    mutationFn: () => login(username, password),
  });

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
    >
      {notice && !submit.error && <p className={styles.notice}>{notice}</p>}
      <label className={styles.field}>
        <span>아이디</span>
        <input
          name="username"
          autoComplete="username"
          value={username}
          required
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          required
          aria-describedby={submit.error ? errorId : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {submit.error && (
        <p id={errorId} role="alert" className={styles.error}>
          {submit.error.message}
        </p>
      )}
      <button
        type="submit"
        className={styles.submit}
        disabled={submit.isPending}
      >
        {submit.isPending ? (
          <>
            <Spinner size="sm" tone="inherit" />
            로그인 중
          </>
        ) : (
          "로그인"
        )}
      </button>
      <p className={styles.hint}>
        데모 계정: <code>demo</code> / <code>demo1234</code>
      </p>
    </form>
  );
}
