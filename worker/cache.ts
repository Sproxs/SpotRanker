// Thin wrapper over the Workers Cache API. Successful responses are stored under
// the full request URL and reused on subsequent hits, cutting Spotify egress and
// latency. The producer is responsible for setting Cache-Control on the Response.

export async function cached(
  cacheKey: string,
  ctx: ExecutionContext,
  producer: () => Promise<Response>,
): Promise<Response> {
  const cache = caches.default;
  const keyRequest = new Request(cacheKey);

  const hit = await cache.match(keyRequest);
  if (hit) return hit;

  const response = await producer();
  if (response.ok) {
    ctx.waitUntil(cache.put(keyRequest, response.clone()));
  }
  return response;
}
