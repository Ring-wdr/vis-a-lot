let started: Promise<void> | undefined;

/** MSW를 시작한다. React StrictMode에서 두 번 불려도 한 번만 시작한다. */
export function startMockServer() {
  started ??= (async () => {
    const [{ setupWorker }, { handlers }] = await Promise.all([
      import("msw/browser"),
      import("./gateway"),
    ]);
    await setupWorker(...handlers).start({
      onUnhandledFrame: "bypass",
      quiet: true,
    });
  })();
  return started;
}
