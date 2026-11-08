// 렌더 결과 PNG를 Cache API에 보관한다. 키는 `<img src>`에 들어갈 URL 그대로다.

const CACHE_NAME = "vis-a-lot-png-v1";

export async function putPng(url: string, png: ArrayBuffer) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    url,
    new Response(png, {
      headers: {
        "content-type": "image/png",
        "content-length": String(png.byteLength),
      },
    }),
  );
}

export async function matchPng(url: string) {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(url);
}

export async function deletePngs(urls: string[]) {
  if (urls.length === 0) return;
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    urls.map((url) => cache.delete(new URL(url, location.origin).href)),
  );
}
