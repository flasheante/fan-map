import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

describe('Artists (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Unique-per-run name/slug so this suite is safe to re-run against a
  // database that already has other artists.
  const suffix = randomUUID().slice(0, 8);
  const artistName = `Zeta Artist ${suffix}`;
  const artistSlug = `zeta-artist-${suffix}`;

  let artistId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    const artist = await prisma.artist.create({
      data: { name: artistName, slug: artistSlug },
    });
    artistId = artist.id;
  });

  afterAll(async () => {
    await prisma.artist.deleteMany({ where: { id: artistId } });
    await app.close();
  });

  describe('GET /artists', () => {
    it('returns the artists including the one just created', async () => {
      const response = await request(app.getHttpServer())
        .get('/artists')
        .expect(200);

      const slugs: string[] = response.body.map(
        (artist: { slug: string }) => artist.slug,
      );
      expect(slugs).toContain(artistSlug);
    });

    it('returns the explicit response shape, without unexpected fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/artists')
        .expect(200);

      const found = response.body.find(
        (artist: { id: string }) => artist.id === artistId,
      );
      expect(found).toEqual({
        id: artistId,
        name: artistName,
        slug: artistSlug,
        imageUrl: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('GET /artists/:id', () => {
    it('returns 200 with the artist', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${artistId}`)
        .expect(200);

      expect(response.body).toEqual({
        id: artistId,
        name: artistName,
        slug: artistSlug,
        imageUrl: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('returns 400 when the id is not a valid UUID', async () => {
      await request(app.getHttpServer()).get('/artists/not-a-uuid').expect(400);
    });

    it('returns 404 when the artist does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${randomUUID()}`)
        .expect(404);
    });
  });

  describe('Seed data', () => {
    // Mirrors the idempotent upsert in prisma/seed.ts. Not cleaned up in
    // afterAll: it represents permanent seed data, not a test fixture.
    it('seeding The Warning twice results in a single artist with that slug', async () => {
      const upsert = () =>
        prisma.artist.upsert({
          where: { slug: 'the-warning' },
          update: { name: 'The Warning' },
          create: { name: 'The Warning', slug: 'the-warning' },
        });

      await upsert();
      await upsert();

      const matches = await prisma.artist.findMany({
        where: { slug: 'the-warning' },
      });
      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('The Warning');
    });

    it('exposes the seeded The Warning artist through GET /artists', async () => {
      const response = await request(app.getHttpServer())
        .get('/artists')
        .expect(200);

      const theWarning = response.body.find(
        (artist: { slug: string }) => artist.slug === 'the-warning',
      );
      expect(theWarning).toBeDefined();
      expect(theWarning.name).toBe('The Warning');
    });
  });
});
