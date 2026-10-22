let started: Promise<void> | undefined;

/** service worker가 다시 떴을 때 요청이 새는 시간을 이만큼으로 줄인다. */
const REACTIVATE_INTERVAL_MS = 1000;

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
    keepMockingActive();
  })();
  return started;
}

/**
 * service worker는 유휴 종료 뒤 다시 뜨면 MSW에 연결된 페이지 목록(메모리)을 잃고,
 * 그때부터 모든 요청을 실제 네트워크로 흘려보낸다 (PNG·metadata·API가 전부 404).
 * 주기적으로, 그리고 탭이 다시 보일 때 이 페이지를 다시 등록한다. 같은 메시지를 여러 번 보내도 무해하다.
 */
function keepMockingActive() {
  const activate = () =>
    navigator.serviceWorker.controller?.postMessage("MOCK_ACTIVATE");
  setInterval(activate, REACTIVATE_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") activate();
  });
}
