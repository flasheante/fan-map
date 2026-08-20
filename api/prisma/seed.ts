import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const countries = [
    {
      name: 'Argentina',
      code: 'AR',
      cities: [
        { name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816 },
        { name: 'Córdoba', latitude: -31.4201, longitude: -64.1888 },
        { name: 'Mendoza', latitude: -32.8895, longitude: -68.8458 },
      ],
    },
    {
      name: 'México',
      code: 'MX',
      cities: [
        { name: 'Ciudad de México', latitude: 19.4326, longitude: -99.1332 },
        { name: 'Monterrey', latitude: 25.6866, longitude: -100.3161 },
      ],
    },
    {
      name: 'España',
      code: 'ES',
      cities: [
        { name: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
        { name: 'Barcelona', latitude: 41.3851, longitude: 2.1734 },
      ],
    },
    {
      name: 'Estados Unidos',
      code: 'US',
      cities: [
        { name: 'New York', latitude: 40.7128, longitude: -74.006 },
        { name: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 },
      ],
    },
  ];

  for (const countryData of countries) {
    const country = await prisma.country.upsert({
      where: {
        code: countryData.code,
      },
      update: {
        name: countryData.name,
      },
      create: {
        name: countryData.name,
        code: countryData.code,
      },
    });

    for (const city of countryData.cities) {
      await prisma.city.upsert({
        where: {
          countryId_name: {
            countryId: country.id,
            name: city.name,
          },
        },
        update: {
          latitude: city.latitude,
          longitude: city.longitude,
        },
        create: {
          name: city.name,
          countryId: country.id,
          latitude: city.latitude,
          longitude: city.longitude,
        },
      });
    }
  }

  console.log('Seed completed successfully');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });