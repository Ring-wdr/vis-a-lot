// 앱이 등록하는 Service Worker (server/browser.ts). MSW가 만든 mockServiceWorker.js를 감싼다.
// mockServiceWorker.js는 `msw init`이 덮어쓰므로 고치지 않고, 그 앞에 리스너 하나만 더한다.
//
// 빌드 산출물(/_next/…)과 Worker 스크립트 요청은 MSW를 거치지 않고 브라우저가 직접 받게 한다.
// SW가 이 요청에 응답하면 WebKit은 같은 파일에 `#…`만 다른 Worker들을 한꺼번에 만들 때 모두 첫 Worker의
// 코드를 싣고(Render Worker가 DB Worker 코드를 실어 렌더가 실패한다), Firefox는 Worker가 코드를 싣다 멈춘다.
// 문서 이동(navigate)과 /api/*는 그대로 MSW가 받는다. 문서 이동까지 넘기면 Firefox에서 다른 페이지가 살아 있는
// 동안 새로 연 페이지의 MSW 부팅이 멈춘다.
//
// 이 리스너가 MSW의 fetch 리스너보다 먼저 붙어야 stopImmediatePropagation()이 MSW 리스너를 막는다.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/_next/") ||
    request.destination === "worker" ||
    request.destination === "sharedworker"
  ) {
    event.stopImmediatePropagation();
  }
});

importScripts("/mockServiceWorker.js");
