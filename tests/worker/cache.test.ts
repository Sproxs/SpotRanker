import { describe, expect, it, vi } from 'vitest';
import { cached } from '../../worker/cache';
import { installCaches, makeCtx } from '../helpers/workerEnv';

const KEY = 'https://example.com/api/playlist/abc';

/** A cacheable success: the producer signals intent via Cache-Control. */
function okResponse(body: string, maxAge = 900): Response {
  return new Response(body, {
    status: 200,
    headers: maxAge > 0 ? { 'Cache-Control': `public, max-age=${maxAge}` } : {},
  });
}

describe('cached', () => {
  it('miss: runs the producer and stores the response via ctx.waitUntil', async () => {
    const memory = installCaches();
    const ctx = makeCtx();
    const producer = vi.fn(async () => okResponse('fresh'));

    const res = await cached(KEY, ctx, producer);

    expect(await res.text()).toBe('fresh');
    expect(producer).toHaveBeenCalledTimes(1);
    expect(ctx.pending).toHaveLength(1); // the put went through waitUntil
    await ctx.settle();
    expect(memory.store.has(KEY)).toBe(true);
  });

  it('hit: returns the stored response without calling the producer', async () => {
    const memory = installCaches();
    await memory.put(new Request(KEY), okResponse('stored'));
    const producer = vi.fn(async () => okResponse('fresh'));

    const res = await cached(KEY, makeCtx(), producer);

    expect(await res.text()).toBe('stored');
    expect(producer).not.toHaveBeenCalled();
  });

  it('a 200 without Cache-Control is returned but NOT stored', async () => {
    // The producer opts in to caching by setting Cache-Control. Storing every
    // 2xx is what let a degraded fallback pin itself at the edge.
    const memory = installCaches();
    const ctx = makeCtx();

    const res = await cached(KEY, ctx, async () => new Response('uncacheable', { status: 200 }));

    expect(await res.text()).toBe('uncacheable');
    expect(ctx.pending).toHaveLength(0);
    await ctx.settle();
    expect(memory.store.size).toBe(0);
  });

  it('max-age=0 is treated as "do not store"', async () => {
    const memory = installCaches();
    const ctx = makeCtx();

    await cached(KEY, ctx, async () => okResponse('zero-ttl', 0));

    await ctx.settle();
    expect(memory.store.size).toBe(0);
  });

  it('a short-TTL (degraded) response is still stored, just briefly', async () => {
    const memory = installCaches();
    const ctx = makeCtx();

    const res = await cached(KEY, ctx, async () => okResponse('degraded', 60));

    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    await ctx.settle();
    expect(memory.store.has(KEY)).toBe(true);
  });

  it('non-ok responses are returned but never cached', async () => {
    const memory = installCaches();
    const ctx = makeCtx();

    const res = await cached(KEY, ctx, async () => new Response('boom', { status: 502 }));

    expect(res.status).toBe(502);
    expect(ctx.pending).toHaveLength(0);
    await ctx.settle();
    expect(memory.store.size).toBe(0);
  });

  it('the returned response body stays readable despite the clone-for-cache', async () => {
    installCaches();
    const ctx = makeCtx();
    const res = await cached(KEY, ctx, async () => okResponse('readable'));
    await ctx.settle();
    await expect(res.text()).resolves.toBe('readable');
  });

  it('producer rejections propagate (nothing cached)', async () => {
    const memory = installCaches();
    await expect(
      cached(KEY, makeCtx(), async () => {
        throw new Error('producer failed');
      }),
    ).rejects.toThrow('producer failed');
    expect(memory.store.size).toBe(0);
  });
});
