"use client";

import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { login } from "@/shared/api/session";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { Spinner } from "@/shared/ui/Loading";

const messages = defineMessages({
  ko: {
    username: "아이디",
    password: "비밀번호",
    loggingIn: "로그인 중",
    login: "로그인",
    demo: "데모 계정:",
  },
  en: {
    username: "Username",
    password: "Password",
    loggingIn: "Logging in",
    login: "Log in",
    demo: "Demo account:",
  },
});

/** mock 계정으로 로그인한다. 토큰은 auth 서비스가 발급하고 세션 store가 들고 있는다. */
const field = "flex flex-col gap-1 text-xs text-fg-secondary";
const input =
  "rounded-md border border-line bg-elevated px-2.5 py-2 text-sm text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1";
const code = "font-mono text-fg-secondary";

export function LoginForm({ notice }: { notice?: string }) {
  const text = useT(messages);
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("");
  const errorId = useId();
  const submit = useMutation({
    mutationFn: () => login(username, password),
  });

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
    >
      {notice && !submit.error && (
        <p className="rounded-md bg-accent-soft px-2.5 py-2 text-ui text-fg-secondary">
          {notice}
        </p>
      )}
      <label className={field}>
        <span>{text.username}</span>
        <input
          className={input}
          name="username"
          autoComplete="username"
          value={username}
          required
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label className={field}>
        <span>{text.password}</span>
        <input
          className={input}
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
        <p id={errorId} role="alert" className="text-ui text-danger">
          {submit.error.message}
        </p>
      )}
      <button
        type="submit"
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-on-accent disabled:cursor-progress disabled:opacity-60"
        disabled={submit.isPending}
      >
        {submit.isPending ? (
          <>
            <Spinner size="sm" tone="inherit" />
            {text.loggingIn}
          </>
        ) : (
          text.login
        )}
      </button>
      <p className="text-center text-xs text-fg-muted">
        {text.demo} <code className={code}>demo</code> /{" "}
        <code className={code}>demo1234</code>
      </p>
    </form>
  );
}
