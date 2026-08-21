import { Injectable, Optional } from '@nestjs/common';
import {
  SetlistFmApiError,
  SetlistFmConfigError,
  SetlistFmInvalidResponseError,
} from './setlist-fm.errors';
import { SetlistFmSetlistsPage } from './setlist-fm.types';

export const SETLIST_FM_DEFAULT_BASE_URL = 'https://api.setlist.fm/rest/1.0';

export interface SetlistFmClientConfig {
  apiKey?: string;
  baseUrl?: string;
}

// Talks HTTP to the setlist.fm REST API — nothing else. No PrismaService, no
// domain models: callers get back the API's own shapes (setlist-fm.types.ts)
// and map them to our domain themselves.
@Injectable()
export class SetlistFmClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  // @Optional() matters here beyond Nest DI ergonomics: SetlistFmClientConfig
  // is a plain interface, which TypeScript erases from emitted metadata (it
  // becomes `Object` at runtime). Without @Optional, Nest tries to resolve a
  // provider for that `Object` token and throws "can't resolve dependencies"
  // — which breaks every test/module that boots SetlistFmModule (it's wired
  // into ShowsModule → AppModule), not just this class. With @Optional, Nest
  // just passes undefined when no such provider exists, and the config
  // default below takes over — the config-object constructor keeps working
  // unchanged for plain `new SetlistFmClient(config)` use (see this spec).
  constructor(@Optional() config: SetlistFmClientConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.SETLIST_FM_API_KEY;
    this.baseUrl = config.baseUrl ?? SETLIST_FM_DEFAULT_BASE_URL;
  }

  async getArtistSetlists(
    mbid: string,
    page = 1,
  ): Promise<SetlistFmSetlistsPage> {
    if (!this.apiKey) {
      throw new SetlistFmConfigError(
        'SETLIST_FM_API_KEY is not configured; cannot call setlist.fm',
      );
    }

    const url = `${this.baseUrl}/artist/${encodeURIComponent(mbid)}/setlists?p=${page}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': this.apiKey,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await safeReadText(response);
      throw new SetlistFmApiError(
        response.status,
        `setlist.fm request failed with status ${response.status}: ${body}`,
      );
    }

    const body: unknown = await response.json();
    return parseSetlistsPage(body);
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function parseSetlistsPage(body: unknown): SetlistFmSetlistsPage {
  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as Record<string, unknown>).setlist)
  ) {
    throw new SetlistFmInvalidResponseError(
      'setlist.fm response is missing the expected "setlist" array',
    );
  }

  return body as SetlistFmSetlistsPage;
}
