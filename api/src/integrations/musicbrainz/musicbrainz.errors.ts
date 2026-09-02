// Errors raised by MusicBrainzClient. Kept specific to this integration so
// callers can distinguish "MusicBrainz returned an error status" from
// "MusicBrainz returned something we don't understand" — same criterion as
// setlist-fm.errors.ts. No config error here: unlike setlist.fm, MusicBrainz
// needs no API key, just a User-Agent header (always sent, see
// musicbrainz.client.ts), so there's nothing that can be "not configured".

export class MusicBrainzApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MusicBrainzApiError';
  }
}

export class MusicBrainzInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MusicBrainzInvalidResponseError';
  }
}
