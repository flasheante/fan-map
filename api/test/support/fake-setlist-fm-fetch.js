'use strict';

// Preloaded via NODE_OPTIONS="--require <this file>" into the child process
// that `npm run sync:setlist-fm` spawns (see
// ../sync-setlist-fm-cli.e2e-spec.ts). NODE_OPTIONS --require modules run
// before anything else in that process — before ts-node registers, before
// Nest boots, before SetlistFmClient exists — so this can safely replace
// global.fetch (and block DNS to the real host as a backstop) before the
// CLI gets any chance to touch the real network. This is the only way to
// intercept an external process's HTTP calls; `overrideProvider` (used by
// ../setlist-fm-sync.e2e-spec.ts) only works inside the same Jest process,
// which a spawned CLI process is not.
//
// Deliberately plain CommonJS JS, not TS: at the point NODE_OPTIONS
// --require runs, ts-node hasn't registered its compiler hook yet, so Node
// can't resolve a .ts file here.

const fs = require('fs');
const dns = require('dns');

// Must match SETLIST_FM_DEFAULT_BASE_URL in
// src/integrations/setlist-fm/setlist-fm.client.ts. Duplicated as a literal
// (rather than imported) because this file has to load before ts-node
// exists to compile that module.
const SETLIST_FM_HOST = 'api.setlist.fm';
const SETLIST_FM_BASE_URL = 'https://api.setlist.fm/rest/1.0';

const logFile = process.env.FAKE_SETLIST_FM_LOG_FILE;

function logCall(entry) {
  if (logFile) {
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  }
}

function fakeResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

global.fetch = async function fakeSetlistFmFetch(url) {
  const href = String(url);

  if (href.startsWith(`${SETLIST_FM_BASE_URL}/artist/`)) {
    const page = Number(new URL(href).searchParams.get('p') ?? '1');
    logCall({ url: href, page });
    // Always an empty, total: 0 page: fetchAllSetlists() stops right after
    // this one request (setlist.length === 0). Real pagination and 429
    // handling are covered by unit tests
    // (src/shows/setlist-fm-sync.service.spec.ts) — this fake only needs to
    // let the real CLI process complete without ever reaching the network.
    return fakeResponse({ setlist: [], total: 0, page, itemsPerPage: 20 });
  }

  // Nothing else in this CLI process is expected to call fetch(). Throwing
  // (rather than passing through to the real fetch) turns any surprise call
  // into a loud, visible failure instead of a silent real request.
  throw new Error(
    `[fake-setlist-fm-fetch] blocked unexpected fetch() to "${href}" — ` +
      'this process must never reach the real network in tests.',
  );
};

// Defense in depth: if something ever bypassed global.fetch entirely (e.g.
// a future change calling http/https directly), block DNS resolution of the
// real host too, so the test fails loudly instead of silently phoning home.
const originalLookup = dns.lookup;
dns.lookup = function blockedSetlistFmLookup(hostname, ...args) {
  if (String(hostname).includes(SETLIST_FM_HOST)) {
    throw new Error(
      `[fake-setlist-fm-fetch] blocked real DNS lookup for "${hostname}"`,
    );
  }
  return originalLookup.call(dns, hostname, ...args);
};
