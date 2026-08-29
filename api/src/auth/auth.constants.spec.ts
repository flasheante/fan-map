import {
  DEFAULT_SESSION_MAX_AGE_MS,
  resolveSecureCookie,
  resolveSessionMaxAgeMs,
} from './auth.constants';

describe('resolveSessionMaxAgeMs', () => {
  it('returns the default when unset', () => {
    expect(resolveSessionMaxAgeMs(undefined)).toBe(DEFAULT_SESSION_MAX_AGE_MS);
  });

  it('parses a valid positive number', () => {
    expect(resolveSessionMaxAgeMs('3600000')).toBe(3600000);
  });

  it('falls back to the default for zero, negative or non-numeric values', () => {
    expect(resolveSessionMaxAgeMs('0')).toBe(DEFAULT_SESSION_MAX_AGE_MS);
    expect(resolveSessionMaxAgeMs('-5')).toBe(DEFAULT_SESSION_MAX_AGE_MS);
    expect(resolveSessionMaxAgeMs('not-a-number')).toBe(
      DEFAULT_SESSION_MAX_AGE_MS,
    );
  });
});

describe('resolveSecureCookie', () => {
  it('is true when SESSION_SECURE=true, regardless of NODE_ENV', () => {
    expect(resolveSecureCookie('true', 'development')).toBe(true);
  });

  it('is false when SESSION_SECURE=false, even in production', () => {
    expect(resolveSecureCookie('false', 'production')).toBe(false);
  });

  it('defaults to true in production when unset', () => {
    expect(resolveSecureCookie(undefined, 'production')).toBe(true);
  });

  it('defaults to false outside production when unset', () => {
    expect(resolveSecureCookie(undefined, 'development')).toBe(false);
    expect(resolveSecureCookie(undefined, undefined)).toBe(false);
  });
});
