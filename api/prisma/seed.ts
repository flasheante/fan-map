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
      cities: ['Buenos Aires', 'Córdoba', 'Mendoza'],
    },
    {
      name: 'México',
      code: 'MX',
      cities: ['Ciudad de México', 'Monterrey'],
    },
    {
      name: 'España',
      code: 'ES',
      cities: ['Madrid', 'Barcelona'],
    },
    {
      name: 'Estados Unidos',
      code: 'US',
      cities: ['New York', 'Los Angeles'],
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

    for (const cityName of countryData.cities) {
      await prisma.city.upsert({
        where: {
          countryId_name: {
            countryId: country.id,
            name: cityName,
          },
        },
        update: {},
        create: {
          name: cityName,
          countryId: country.id,
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