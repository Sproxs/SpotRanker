// Route-table fake for the global `fetch`. Every worker module calls the bare
// global with hardcoded absolute URLs, so stubbing the global is the single
// seam. Unmatched URLs THROW — that is the guarantee that no unit test ever
// reaches the real network.

import { vi } from 'vitest';

export interface RecordedCall {
  url: string;
  init?: RequestInit;
}

export interface FetchRoute {
  /** Match against the full URL string (and optionally the init). */
  match: (url: string, init?: RequestInit) => boolean;
  /** Produce the response; may throw to simulate network failure. */
  respond: (url: string, init?: RequestInit) => Response | Promise<Response>;
}

export interface FakeFetch {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  calls: RecordedCall[];
  /** Calls whose URL contains the given substring. */
  callsTo(substring: string): RecordedCall[];
}

export function makeFakeFetch(routes: FetchRoute[]): FakeFetch {
  const calls: RecordedCall[] = [];

  const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    for (const route of routes) {
      if (route.match(url, init)) return route.respond(url, init);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const fake = fn as FakeFetch;
  fake.calls = calls;
  fake.callsTo = (substring: string) => calls.filter((c) => c.url.includes(substring));
  return fake;
}

/** Install routes as the global fetch (undone by tests/setup.ts afterEach). */
export function stubFetch(routes: FetchRoute[]): FakeFetch {
  const fake = makeFakeFetch(routes);
  vi.stubGlobal('fetch', fake);
  return fake;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function htmlResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html' } });
}

