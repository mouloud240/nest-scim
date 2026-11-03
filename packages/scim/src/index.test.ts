import { describe, expect, it } from 'vitest';
import { VERSION } from './index';

describe('M0 toolchain smoke test', () => {
  it('loads the library entry point and exposes VERSION', () => {
    expect(VERSION).toBe('0.0.0-alpha.0');
  });
});
