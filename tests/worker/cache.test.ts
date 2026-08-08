import { describe, expect, it, vi } from 'vitest';
import { cached } from '../../worker/cache';
import { installCaches, makeCtx } from '../helpers/workerEnv';

const KEY = 'https://example.com/api/playlist/abc';

function okResponse(body: string): Response {
  return new Response(body, { status: 200 });
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
