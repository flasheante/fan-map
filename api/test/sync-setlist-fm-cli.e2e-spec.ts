import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PrismaService } from '../src/database/prisma.service';
import { THE_WARNING_SETLIST_FM_MBID } from '../src/shows/setlist-fm-sync.service';

// Regression test for a real incident: `npm run sync:setlist-fm` used to run
// the CLI through `tsx`. tsx transpiles TypeScript with esbuild, which does
// NOT implement `emitDecoratorMetadata` (see https://github.com/evanw/esbuild/issues/257).
// Without that metadata, Nest's constructor-based DI can't see that
// SetlistFmSyncService needs a PrismaService and a SetlistFmClient — it
// silently constructs the service with zero resolved dependencies instead of
// throwing "Nest can't resolve dependencies...". The first line of
// syncTheWarning() (`this.prisma.artist.findUnique`) then blows up with
// `TypeError: Cannot read properties of undefined (reading 'artist')`.
//
// This spawns the actual `npm run sync:setlist-fm` script — the same
// process a developer runs — so a regression to an esbuild-based loader
// (tsx, or anything else that drops decorator metadata) is caught here
// instead of only in production.
//
// It's a *real*, separate OS process (not a Nest TestingModule inside this
// Jest process), so we can't fake SetlistFmClient with `overrideProvider`
// the way test/setlist-fm-sync.e2e-spec.ts does. Instead we preload
// test/support/fake-setlist-fm-fetch.js into that process via NODE_OPTIONS
// --require: it replaces global.fetch (and blocks DNS to api.setlist.fm as
// a backstop) before ts-node, Nest, or SetlistFmClient ever run, so this
// process can never reach the real setlist.fm API. The API key is a
// throwaway fake — the faked fetch never checks it. Postgres is real (the
// same DB test/setlist-fm-sync.e2e-spec.ts uses) — only the external HTTP
// call is faked.
describe('sync:setlist-fm CLI (e2e)', () => {
  const preloadPath = path.join(
    __dirname,
    'support',
    'fake-setlist-fm-fetch.js',
  );
  let prisma: PrismaService;
  let logFile: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    // The CLI looks up the artist by its real, permanent slug (see
    // prisma/seed.ts). Upsert it so the sync reaches the setlist.fm call
    // instead of failing earlier with NotFoundException, regardless of
    // whether this DB happens to be seeded already.
    await prisma.artist.upsert({
      where: { slug: 'the-warning' },
      update: {},
      create: { name: 'The Warning', slug: 'the-warning' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    logFile = path.join(os.tmpdir(), `fake-setlist-fm-${randomUUID()}.log`);
  });

  afterEach(() => {
    fs.rmSync(logFile, { force: true });
  });

  function readLoggedCalls(): Array<{ url: string; page: number }> {
    if (!fs.existsSync(logFile)) return [];
    return fs
      .readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line: string) => JSON.parse(line) as { url: string; page: number });
  }

  // Runs the real CLI script as a child process, with the setlist.fm HTTP
  // call faked via NODE_OPTIONS (see file header). Never throws on a
  // non-zero exit: callers assert on stdout/stderr and on the fake's call
  // log instead, so a CLI failure shows up as a clear assertion failure
  // rather than an opaque execFileSync exception.
  function runCli(): string {
    try {
      return execFileSync('npm', ['run', 'sync:setlist-fm'], {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        stdio: 'pipe',
        shell: true,
        timeout: 30_000,
        env: {
          ...process.env,
          // Never a real key: the fake fetch below never validates it, and
          // this suite must never need a real one.
          SETLIST_FM_API_KEY: 'test-fake-key-e2e-do-not-use',
          FAKE_SETLIST_FM_LOG_FILE: logFile,
          NODE_OPTIONS:
            `${process.env.NODE_OPTIONS ?? ''} --require ${preloadPath}`.trim(),
        },
      });
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string };
      return `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
  }

  it('resolves SetlistFmSyncService dependencies via Nest DI instead of leaving them undefined', () => {
    const output = runCli();

    expect(output).not.toContain(
      "Cannot read properties of undefined (reading 'artist')",
    );
    expect(output).not.toContain("Nest can't resolve dependencies");

    // The artist exists (see beforeAll) and the fake fetch always succeeds,
    // so with DI wired correctly this must fully complete.
    expect(output).toContain('setlist.fm sync completed');
  }, 40_000);

  // Regression: this whole suite exists to keep `npm run test:e2e` from
  // ever hitting the real setlist.fm API (that's what caused the 429s).
  // Asserting on the fake's call log — rather than just "the CLI didn't
  // crash" — proves the process actually went through the faked fetch
  // instead of, say, silently skipping the HTTP call entirely.
  it('never makes a real HTTP request to setlist.fm', () => {
    const output = runCli();

    // If the fake had blocked an unexpected call (wrong URL, or a bypass
    // reaching real DNS for api.setlist.fm), it throws inside the CLI
    // process and that error text shows up here instead of a clean summary.
    expect(output).not.toContain('[fake-setlist-fm-fetch] blocked');

    const calls = readLoggedCalls();

    // Exactly one request: the fake always returns an empty, total: 0 page,
    // so fetchAllSetlists() stops right after page 1 — see
    // setlist-fm-sync.service.spec.ts for the full pagination behaviour
    // (multi-page counting, 429 handling), which belongs in a unit test,
    // not here.
    expect(calls).toEqual([
      {
        url: `https://api.setlist.fm/rest/1.0/artist/${THE_WARNING_SETLIST_FM_MBID}/setlists?p=1`,
        page: 1,
      },
    ]);
  }, 40_000);
});
