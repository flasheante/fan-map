// Errors raised by SetlistFmClient. Kept specific to this integration so
// callers can distinguish "we're not configured", "setlist.fm returned an
// error status" and "setlist.fm returned something we don't understand".

export class SetlistFmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SetlistFmConfigError';
  }
}

export class SetlistFmApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SetlistFmApiError';
  }
}

export class SetlistFmInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SetlistFmInvalidResponseError';
  }
}
