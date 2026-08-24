import { execFileSync } from 'child_process';
import path from 'path';
import { PrismaService } from '../src/database/prisma.service';

const DEMO_EXTERNAL_IDS = [
  'demo-the-warning-001',
  'demo-the-warning-002',
  'demo-the-warning-003',
  'demo-the-warning-004',
  'demo-the-warning-005',
];

// Regression test mirroring test/sync-setlist-fm-cli.e2e-spec.ts: `npm run
// seed:demo` must run through `ts-node`, not `tsx` or any other
// esbuild-based loader. esbuild does not implement `emitDecoratorMetadata`
// (see https://github.com/evanw/esbuild/issues/257), so without it Nest's
// constructor-based DI can't see that DemoSeedService needs a
// PrismaService — it silently constructs the service with zero resolved
// dependencies instead of throwing, and the first line of
// seedDemoTheWarning() blows up with
// `TypeError: Cannot read properties of undefined (reading 'artist')`.
//
// This spawns the actual `npm run seed:demo` script — the same process a
// developer runs — against the real Postgres database (same one
// test/setlist-fm-sync.e2e-spec.ts and test/demo-seed.e2e-spec.ts use).
// There is no HTTP client involved anywhere in this command, so unlike the
// setlist.fm CLI test, no network fake is needed here.
describe('seed:demo CLI (e2e)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    // The CLI looks up the artist by its real, permanent slug (see
    // prisma/seed.ts). Upsert it so the seed reaches the point of creating
    // shows instead of failing earlier with NotFoundException, regardless
    // of whether this DB happens to be seeded already.
    await prisma.artist.upsert({
      where: { slug: 'the-warning' },
      update: {},
      create: { name: 'The Warning', slug: 'the-warning' },
    });
  });

  afterAll(async () => {
    await prisma.setlistSong.deleteMany({
      where: { setlist: { show: { externalId: { in: DEMO_EXTERNAL_IDS } } } },
    });
    await prisma.setlist.deleteMany({
      where: { show: { externalId: { in: DEMO_EXTERNAL_IDS } } },
    });
    await prisma.show.deleteMany({
      where: { externalId: { in: DEMO_EXTERNAL_IDS } },
    });
    await prisma.$disconnect();
  });

  // Never throws on a non-zero exit: callers assert on stdout/stderr
  // instead, so a CLI failure shows up as a clear assertion failure rather
  // than an opaque execFileSync exception.
  function runCli(): string {
    try {
      return execFileSync('npm', ['run', 'seed:demo'], {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        stdio: 'pipe',
        shell: true,
        timeout: 30_000,
        env: process.env,
      });
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string };
      return `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
  }

  it('resolves DemoSeedService dependencies via Nest DI instead of leaving them undefined', () => {
    const output = runCli();

    expect(output).not.toContain(
      "Cannot read properties of undefined (reading 'artist')",
    );
    expect(output).not.toContain("Nest can't resolve dependencies");
    expect(output).toContain('Demo seed completed');
  }, 40_000);

  it('prints the expected summary sections', () => {
    const output = runCli();

    expect(output).toContain('Artist: The Warning');
    expect(output).toContain('Shows:');
    expect(output).toContain('Setlists:');
    expect(output).toContain('Songs:');
    expect(output).toContain('Cities skipped:');
  }, 40_000);

  it('is safe to run twice in a row without failing', () => {
    runCli();
    const secondOutput = runCli();

    expect(secondOutput).toContain('Demo seed completed');
    expect(secondOutput).not.toContain('Demo seed failed');
  }, 60_000);
});
