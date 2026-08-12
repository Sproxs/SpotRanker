import { describe, expect, it } from 'vitest';
import { APP_VERSION, BUILD_TIME, formatBuildInfo } from '@/config/buildInfo';

describe('buildInfo', () => {
  it('falls back to "dev" when the vite define block is absent', () => {
    // vitest.config.ts intentionally does not replicate vite.config.ts's
    // `define`, so importing this module must not throw a ReferenceError.
    expect(APP_VERSION).toBe('dev');
    expect(BUILD_TIME).toBe('');
  });

  it('combines version and build time', () => {
    const result = formatBuildInfo('a1b2c3d', '2026-08-11T20:14:00.000Z');
    expect(result.startsWith('a1b2c3d · ')).toBe(true);
    expect(result).toContain('2026');
  });

  it('returns the bare version when the build time is missing', () => {
    expect(formatBuildInfo('a1b2c3d', '')).toBe('a1b2c3d');
  });

  it('returns the bare version when the build time is unparsable', () => {
    expect(formatBuildInfo('a1b2c3d', 'not-a-date')).toBe('a1b2c3d');
  });

  it('uses the module defaults when called without arguments', () => {
    expect(formatBuildInfo()).toBe('dev');
  });
});
