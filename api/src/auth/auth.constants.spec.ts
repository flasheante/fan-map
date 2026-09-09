import {
  DEFAULT_SESSION_MAX_AGE_MS,
  resolveSecureCookie,
  resolveSessionMaxAgeMs,
  sanitizeReturnTo,
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

describe('sanitizeReturnTo', () => {
  it('returns undefined when nothing is given', () => {
    expect(sanitizeReturnTo(undefined)).toBeUndefined();
  });

  it('accepts a simple relative path', () => {
    expect(sanitizeReturnTo('/join')).toBe('/join');
  });

  it('accepts a relative path with a query string', () => {
    expect(sanitizeReturnTo('/map?view=fans')).toBe('/map?view=fans');
  });

  it('accepts the root path', () => {
    expect(sanitizeReturnTo('/')).toBe('/');
  });

  it('rejects an absolute URL to another host', () => {
    expect(sanitizeReturnTo('https://evil.example.com')).toBeUndefined();
  });

  // El browser trata "//host" y "/\host" como URLs absolutas (protocol-
  // relative) hacia otro origin, no como paths — mismo riesgo de open
  // redirect que una URL absoluta con esquema.
  it('rejects a protocol-relative URL', () => {
    expect(sanitizeReturnTo('//evil.example.com')).toBeUndefined();
    expect(sanitizeReturnTo('/\\evil.example.com')).toBeUndefined();
  });

  it('rejects a path without a leading slash', () => {
    expect(sanitizeReturnTo('join')).toBeUndefined();
  });

  it('rejects an empty string', () => {
    expect(sanitizeReturnTo('')).toBeUndefined();
  });

  it('rejects a value containing whitespace', () => {
    expect(sanitizeReturnTo('/join redirect')).toBeUndefined();
  });
});
