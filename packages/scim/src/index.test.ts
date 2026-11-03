import { describe, expect, it } from 'vitest';
import { VERSION } from './index';

describe('toolchain smoke test', () => {
  it('loads the library entry point and exposes VERSION', () => {
    expect(VERSION).toBe('0.0.0-alpha.0');
  });
});
