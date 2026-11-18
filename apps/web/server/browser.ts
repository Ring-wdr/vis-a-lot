let started: Promise<void> | undefined;

/** service worker가 다시 떴을 때 요청이 새는 시간을 이만큼으로 줄인다. */
const REACTIVATE_INTERVAL_MS = 1000;

/**
 * MSW 생성 파일(mockServiceWorker.js)을 감싸 빌드 산출물·Worker 스크립트 요청을 브라우저에 넘기는 SW.
 * 넘기는 조건과 이유는 public/sw.js에 있다.
 */
const SERVICE_WORKER_URL = "/sw.js";

/** 예전에 MSW 생성 파일을 그대로 등록하던 주소. */
const LEGACY_SERVICE_WORKER_PATH = "/mockServiceWorker.js";

/** 예전 SW를 지우고 새로고침한 탭에 남기는 표시. 새로고침을 한 번만 한다. */
const LEGACY_RELOAD_KEY = "vis-a-lot:sw-legacy-reload";

/** MSW를 시작한다. React StrictMode에서 두 번 불려도 한 번만 시작한다. */
export function startMockServer() {
  started ??= (async () => {
    if (await replaceLegacyWorker()) return new Promise<void>(() => {});
    const [{ setupWorker }, { handlers }] = await Promise.all([
      import("msw/browser"),
      import("./gateway"),
    ]);
    await setupWorker(...handlers).start({
      serviceWorker: { url: SERVICE_WORKER_URL },
      onUnhandledFrame: "bypass",
      quiet: true,
    });
    keepMockingActive();
  })();
  return started;
}

/**
 * 예전 SW(mockServiceWorker.js) 등록을 지운다. 이 페이지를 예전 SW가 제어하고 있으면 한 번 새로고침하고 true를 낸다.
 * 예전 SW는 페이지가 보낸 메시지의 처리를 끝내지 않고 붙들고 있어(MSW 페이지는 SW의 메시지에 답하지 않는다)
 * 같은 scope에 새 SW를 올리면 Chromium에서 새 SW가 예전 SW의 요청 시간 제한(5분)까지 waiting에 머물고 부팅이 멈춘다.
 * 등록을 지운 뒤 새로고침하면 예전 SW가 제어하지 않는 페이지가 되어 새 SW를 새 등록으로 곧바로 활성화한다.
 */
async function replaceLegacyWorker(): Promise<boolean> {
  const isLegacy = (worker: ServiceWorker | null) =>
    worker != null &&
    new URL(worker.scriptURL).pathname === LEGACY_SERVICE_WORKER_PATH;
  const registrations = await navigator.serviceWorker.getRegistrations();
  const legacy = registrations.filter((registration) =>
    [registration.active, registration.waiting, registration.installing].some(
      isLegacy,
    ),
  );
  await Promise.all(legacy.map((registration) => registration.unregister()));
  if (!isLegacy(navigator.serviceWorker.controller)) return false;
  try {
    if (sessionStorage.getItem(LEGACY_RELOAD_KEY) != null) return false;
    sessionStorage.setItem(LEGACY_RELOAD_KEY, "1");
  } catch {
    return false;
  }
  location.reload();
  return true;
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
