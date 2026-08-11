// Thin wrapper over the Workers Cache API. Successful responses are stored under
// the full request URL and reused on subsequent hits, cutting Spotify egress and
// latency. The producer is responsible for setting Cache-Control on the Response.

/** Read the max-age directive a producer put on its response, if any. */
function maxAgeSeconds(response: Response): number {
  const header = response.headers.get('Cache-Control');
  if (!header) return 0;
  const match = header.match(/max-age=(\d+)/);
  return match ? Number(match[1]) : 0;
}

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
  // Honour the producer's own caching intent rather than blindly storing every
  // 2xx: a degraded fallback is a 200 too, and pinning one for the full TTL
  // would keep a cover-less playlist in place long after the cause cleared —
  // and erase the evidence of the incident along with it.
  if (response.ok && maxAgeSeconds(response) > 0) {
    ctx.waitUntil(cache.put(keyRequest, response.clone()));
  }
  return response;
}
