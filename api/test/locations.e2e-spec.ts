import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

describe('Locations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Unique-per-run codes/names so this suite is safe to re-run against a
  // database that already has other data (no seed exists yet).
  const suffix = randomUUID().slice(0, 8);
  const countryWithCitiesName = `Zeta Country ${suffix}`;
  const countryWithoutCitiesName = `Alpha Country ${suffix}`;

  let countryWithCitiesId: string;
  let countryWithoutCitiesId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    const countryWithCities = await prisma.country.create({
      data: { name: countryWithCitiesName, code: `Z${suffix.slice(0, 1)}` },
    });
    countryWithCitiesId = countryWithCities.id;

    const countryWithoutCities = await prisma.country.create({
      data: { name: countryWithoutCitiesName, code: `A${suffix.slice(0, 1)}` },
    });
    countryWithoutCitiesId = countryWithoutCities.id;

    // Inserted out of alphabetical order on purpose.
    await prisma.city.createMany({
      data: [
        { name: `Rosario ${suffix}`, countryId: countryWithCitiesId },
        { name: `Buenos Aires ${suffix}`, countryId: countryWithCitiesId },
        { name: `Cordoba ${suffix}`, countryId: countryWithCitiesId },
      ],
    });
  });

  afterAll(async () => {
    await prisma.city.deleteMany({ where: { countryId: countryWithCitiesId } });
    await prisma.country.deleteMany({
      where: { id: { in: [countryWithCitiesId, countryWithoutCitiesId] } },
    });
    await app.close();
  });

  describe('GET /countries', () => {
    it('returns the countries ordered by name, including seeded ones in order', async () => {
      const response = await request(app.getHttpServer())
        .get('/countries')
        .expect(200);

      const names: string[] = response.body.map(
        (country: { name: string }) => country.name,
      );

      const relevantNames = names.filter((name) =>
        [countryWithCitiesName, countryWithoutCitiesName].includes(name),
      );

      // Alpha... sorts before Zeta... alphabetically.
      expect(relevantNames).toEqual([
        countryWithoutCitiesName,
        countryWithCitiesName,
      ]);
    });
  });

  describe('GET /countries/:countryId/cities', () => {
    it('returns the cities for the country ordered by name', async () => {
      const response = await request(app.getHttpServer())
        .get(`/countries/${countryWithCitiesId}/cities`)
        .expect(200);

      const names: string[] = response.body.map(
        (city: { name: string }) => city.name,
      );

      expect(names).toEqual([
        `Buenos Aires ${suffix}`,
        `Cordoba ${suffix}`,
        `Rosario ${suffix}`,
      ]);
    });

    it('returns an empty array for a country with no cities', async () => {
      const response = await request(app.getHttpServer())
        .get(`/countries/${countryWithoutCitiesId}/cities`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('returns 404 when the country does not exist', async () => {
      await request(app.getHttpServer())
        .get('/countries/non-existent-id/cities')
        .expect(404);
    });
  });
});
