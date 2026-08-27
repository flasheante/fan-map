import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // City names below are kept as setlist.fm's own venue.city.name spelling
  // (e.g. 'Mexico City', not 'Ciudad de México') — SetlistFmSyncService
  // resolves cities by exact { countryId, name } match against what
  // setlist.fm sends, so any divergence here means synced shows for that
  // city get silently skipped (see resolveCity() in
  // src/shows/setlist-fm-sync.service.ts and its citiesNotFound summary).
  // Coordinates come from setlist.fm's own venue.city.coords (fetched
  // directly from GET /artist/{mbid}/setlists) rather than a separate
  // geocoder, for the same reason: it's the source of truth this catalog is
  // matched against. Two setlist.fm entries had bad coordinates and were
  // corrected by hand: 'San Luis Obispo' (US) had its longitude sign
  // flipped (120 instead of -120), and 'Leeds' (GB) was tagged to a Kent
  // village of the same name rather than the West Yorkshire city where its
  // one show's venue (First Direct Arena) actually is.
  const countries = [
    {
      name: 'Argentina',
      code: 'AR',
      cities: [
        { name: 'Buenos Aires', latitude: -34.576, longitude: -58.409 },
        { name: 'Córdoba', latitude: -31.4, longitude: -64.183333 },
        { name: 'La Plata', latitude: -34.931389, longitude: -57.948889 },
        { name: 'Mar del Plata', latitude: -38, longitude: -57.55 },
        { name: 'Mendoza', latitude: -32.883333, longitude: -68.816667 },
        { name: 'Rosario', latitude: -32.951111, longitude: -60.666389 },
        { name: 'San Isidro', latitude: -34.470833, longitude: -58.528611 },
        { name: 'Santa Fe', latitude: -31.633333, longitude: -60.7 },
      ],
    },
    {
      name: 'México',
      code: 'MX',
      cities: [
        { name: 'Aguascalientes', latitude: 21.883, longitude: -102.3 },
        { name: 'Cancún', latitude: 21.174288, longitude: -86.846559 },
        { name: 'Chihuahua', latitude: 28.633333, longitude: -106.083333 },
        { name: 'Ciudad Juárez', latitude: 31.733333, longitude: -106.483333 },
        { name: 'Guadalajara', latitude: 20.666667, longitude: -103.333333 },
        { name: 'Irapuato', latitude: 20.683333, longitude: -101.35 },
        { name: 'León', latitude: 21.116667, longitude: -101.666667 },
        { name: 'Mérida', latitude: 20.967, longitude: -89.617 },
        { name: 'Mexico City', latitude: 19.434, longitude: -99.139 },
        { name: 'Monclova', latitude: 26.9, longitude: -101.417 },
        { name: 'Monterrey', latitude: 25.671, longitude: -100.308 },
        { name: 'Pachuca', latitude: 20.116973, longitude: -98.733294 },
        { name: 'Piedras Negras', latitude: 28.7, longitude: -100.524 },
        { name: 'Puebla de Zaragoza', latitude: 19.05, longitude: -98.2 },
        { name: 'Río Verde', latitude: 21.626, longitude: -100.172 },
        { name: 'Saltillo', latitude: 25.417, longitude: -101 },
        { name: 'San Andrés Cholula', latitude: 19.05, longitude: -98.3 },
        {
          name: 'San Juan Teotihuacán',
          latitude: 19.683333,
          longitude: -98.866667,
        },
        { name: 'San Lucas', latitude: 22.890883, longitude: -109.912376 },
        { name: 'San Luis Potosí', latitude: 22.15, longitude: -100.983333 },
        { name: 'San Pedro Garza García', latitude: 25.667, longitude: -100.4 },
        { name: 'Santiago', latitude: 25.425, longitude: -100.152 },
        {
          name: 'Santiago de Querétaro',
          latitude: 20.591,
          longitude: -100.392,
        },
        { name: 'Tijuana', latitude: 32.533333, longitude: -117.016667 },
        { name: 'Toluca', latitude: 19.288333, longitude: -99.667222 },
        { name: 'Torreón', latitude: 25.55, longitude: -103.433 },
        { name: 'Zacatecas', latitude: 22.776, longitude: -102.572 },
        { name: 'Zapopan', latitude: 20.716667, longitude: -103.4 },
      ],
    },
    {
      name: 'España',
      code: 'ES',
      cities: [
        { name: 'Barcelona', latitude: 41.388787, longitude: 2.158985 },
        { name: 'Bilbao', latitude: 43.262706, longitude: -2.925282 },
        { name: 'Madrid', latitude: 40.416502, longitude: -3.702564 },
        {
          name: 'Santa Coloma de Gramenet',
          latitude: 41.451524,
          longitude: 2.208102,
        },
        {
          name: 'Santiago de Compostela',
          latitude: 42.880524,
          longitude: -8.54569,
        },
      ],
    },
    {
      name: 'Estados Unidos',
      code: 'US',
      cities: [
        { name: 'Albuquerque', latitude: 35.084, longitude: -106.651 },
        { name: 'Alpharetta', latitude: 34.075376, longitude: -84.29409 },
        { name: 'Anaheim', latitude: 33.835293, longitude: -117.914504 },
        { name: 'Asbury Park', latitude: 40.220391, longitude: -74.012082 },
        { name: 'Atlanta', latitude: 33.748995, longitude: -84.387982 },
        { name: 'Atlantic City', latitude: 39.364283, longitude: -74.422927 },
        { name: 'Austin', latitude: 30.267153, longitude: -97.743061 },
        { name: 'Baltimore', latitude: 39.290385, longitude: -76.612189 },
        { name: 'Berkeley', latitude: 37.871593, longitude: -122.272747 },
        { name: 'Boston', latitude: 42.358431, longitude: -71.059773 },
        { name: 'Bridgeport', latitude: 41.167041, longitude: -73.204835 },
        { name: 'Brooklyn', latitude: 40.65, longitude: -73.95 },
        { name: 'Brownsville', latitude: 25.901747, longitude: -97.497484 },
        { name: 'Burbank', latitude: 34.180839, longitude: -118.308966 },
        { name: 'Camden', latitude: 39.925946, longitude: -75.11962 },
        { name: 'Cedar Knolls', latitude: 40.822044, longitude: -74.448765 },
        { name: 'Charlotte', latitude: 35.227087, longitude: -80.843127 },
        { name: 'Chesterfield', latitude: 38.663108, longitude: -90.577067 },
        { name: 'Chicago', latitude: 41.850033, longitude: -87.650052 },
        { name: 'Cincinnati', latitude: 39.162004, longitude: -84.456886 },
        { name: 'Cleveland', latitude: 41.499495, longitude: -81.695409 },
        {
          name: 'Colorado Springs',
          latitude: 38.833882,
          longitude: -104.821363,
        },
        { name: 'Columbus', latitude: 39.961176, longitude: -82.998794 },
        { name: 'Concord', latitude: 37.977978, longitude: -122.031073 },
        { name: 'Corpus Christi', latitude: 27.800583, longitude: -97.396381 },
        { name: 'Cuyahoga Falls', latitude: 41.133945, longitude: -81.484558 },
        { name: 'Dallas', latitude: 32.783056, longitude: -96.806667 },
        { name: 'Daytona Beach', latitude: 29.210815, longitude: -81.022833 },
        { name: 'Denver', latitude: 39.739154, longitude: -104.984703 },
        { name: 'Destin', latitude: 30.393534, longitude: -86.495783 },
        { name: 'Detroit', latitude: 42.331427, longitude: -83.045754 },
        { name: 'Durant', latitude: 33.993986, longitude: -96.370824 },
        { name: 'Flint', latitude: 43.012527, longitude: -83.687456 },
        { name: 'Gilford', latitude: 43.547577, longitude: -71.406738 },
        { name: 'Glendale', latitude: 33.538652, longitude: -112.185987 },
        { name: 'Grand Junction', latitude: 39.063871, longitude: -108.550649 },
        { name: 'Grand Rapids', latitude: 42.96336, longitude: -85.668086 },
        { name: 'Hollywood', latitude: 26.011201, longitude: -80.14949 },
        { name: 'Holmdel', latitude: 40.34511, longitude: -74.184032 },
        { name: 'Houston', latitude: 29.763284, longitude: -95.363271 },
        { name: 'Huntsville', latitude: 34.730369, longitude: -86.586104 },
        { name: 'Indianapolis', latitude: 39.768377, longitude: -86.158042 },
        { name: 'Irving', latitude: 32.814018, longitude: -96.948894 },
        { name: 'Kansas City', latitude: 39.099727, longitude: -94.578567 },
        { name: 'Kent', latitude: 47.380934, longitude: -122.234843 },
        {
          name: 'Lake Buena Vista',
          latitude: 28.393619,
          longitude: -81.538684,
        },
        { name: 'Las Vegas', latitude: 36.174971, longitude: -115.137223 },
        { name: 'Los Angeles', latitude: 34.052, longitude: -118.244 },
        { name: 'Louisville', latitude: 38.254238, longitude: -85.759407 },
        { name: 'Lubbock', latitude: 33.577863, longitude: -101.855166 },
        { name: 'Maryland Heights', latitude: 38.713107, longitude: -90.42984 },
        { name: 'McAllen', latitude: 26.203407, longitude: -98.230012 },
        { name: 'Miami', latitude: 25.774266, longitude: -80.193659 },
        { name: 'Miami Beach', latitude: 25.790654, longitude: -80.130045 },
        { name: 'Milwaukee', latitude: 43.038903, longitude: -87.906474 },
        { name: 'Minneapolis', latitude: 44.979965, longitude: -93.263836 },
        { name: 'Monterey', latitude: 36.600238, longitude: -121.894676 },
        { name: 'Morrison', latitude: 39.653599, longitude: -105.1911 },
        { name: 'Napa', latitude: 38.297137, longitude: -122.285529 },
        { name: 'Nashville', latitude: 36.16589, longitude: -86.784443 },
        { name: 'New Orleans', latitude: 29.955, longitude: -90.075 },
        { name: 'New York', latitude: 40.714269, longitude: -74.005973 },
        { name: 'Newark', latitude: 40.735657, longitude: -74.172367 },
        { name: 'Oceanside', latitude: 33.19587, longitude: -117.379483 },
        { name: 'Oklahoma City', latitude: 35.46756, longitude: -97.516428 },
        { name: 'Orlando', latitude: 28.538336, longitude: -81.379236 },
        { name: 'Philadelphia', latitude: 39.952335, longitude: -75.163789 },
        { name: 'Phoenix', latitude: 33.448377, longitude: -112.074037 },
        { name: 'Pittsburgh', latitude: 40.440625, longitude: -79.995886 },
        { name: 'Pomona', latitude: 34.055289, longitude: -117.752279 },
        { name: 'Port Canaveral', latitude: 28.416114, longitude: -80.607829 },
        { name: 'Portland', latitude: 45.523452, longitude: -122.676207 },
        { name: 'Portsmouth', latitude: 36.835426, longitude: -76.298274 },
        { name: 'Raleigh', latitude: 35.772096, longitude: -78.638614 },
        { name: 'Reading', latitude: 40.335648, longitude: -75.926875 },
        { name: 'Reno', latitude: 39.529633, longitude: -119.813803 },
        { name: 'Richmond', latitude: 37.553758, longitude: -77.460262 },
        { name: 'Rogers', latitude: 36.33202, longitude: -94.118537 },
        { name: 'Sacramento', latitude: 38.581572, longitude: -121.4944 },
        { name: 'Salt Lake City', latitude: 40.760779, longitude: -111.891047 },
        { name: 'San Antonio', latitude: 29.424122, longitude: -98.493628 },
        { name: 'San Diego', latitude: 32.715329, longitude: -117.157255 },
        { name: 'San Francisco', latitude: 37.775, longitude: -122.419 },
        { name: 'San Luis Obispo', latitude: 35.354, longitude: -120.6625 },
        { name: 'Santa Ana', latitude: 33.745573, longitude: -117.867834 },
        { name: 'Scranton', latitude: 41.408969, longitude: -75.662412 },
        { name: 'Seattle', latitude: 47.60621, longitude: -122.332071 },
        { name: 'Silver Spring', latitude: 38.990666, longitude: -77.026088 },
        { name: 'St. Louis', latitude: 38.627273, longitude: -90.197889 },
        {
          name: 'Sterling Heights',
          latitude: 42.580312,
          longitude: -83.030203,
        },
        { name: 'Syracuse', latitude: 43.048122, longitude: -76.147424 },
        { name: 'Tampa', latitude: 27.947522, longitude: -82.458428 },
        { name: 'The Woodlands', latitude: 30.157994, longitude: -95.489384 },
        { name: 'Towson', latitude: 39.401496, longitude: -76.601912 },
        { name: 'Tucson', latitude: 32.221743, longitude: -110.926479 },
        { name: 'Warrendale', latitude: 40.6534, longitude: -80.079503 },
        { name: 'Washington', latitude: 38.895, longitude: -77.036 },
        { name: 'West Hollywood', latitude: 34.090009, longitude: -118.361744 },
      ],
    },
    {
      name: 'Alemania',
      code: 'DE',
      cities: [
        { name: 'Berlin', latitude: 52.516667, longitude: 13.4 },
        { name: 'Cologne', latitude: 50.933333, longitude: 6.95 },
        { name: 'Frankfurt', latitude: 50.116667, longitude: 8.683333 },
        { name: 'Freiburg', latitude: 47.995895, longitude: 7.852221 },
        { name: 'Munich', latitude: 48.137433, longitude: 11.575491 },
        { name: 'Münster', latitude: 51.962356, longitude: 7.625713 },
        { name: 'Nürburg', latitude: 50.333333, longitude: 6.95 },
        { name: 'Nuremberg', latitude: 49.447778, longitude: 11.068333 },
        { name: 'Wacken', latitude: 54.021, longitude: 9.376 },
      ],
    },
    {
      name: 'Austria',
      code: 'AT',
      cities: [
        { name: 'Feldkirch', latitude: 47.233056, longitude: 9.6 },
        { name: 'Nickelsdorf', latitude: 47.940556, longitude: 17.069444 },
      ],
    },
    {
      name: 'Bélgica',
      code: 'BE',
      cities: [
        { name: 'Dessel', latitude: 51.233, longitude: 5.117 },
        { name: 'Lokeren', latitude: 51.1, longitude: 3.983 },
      ],
    },
    {
      name: 'Brasil',
      code: 'BR',
      cities: [
        { name: 'Curitiba', latitude: -25.427778, longitude: -49.273056 },
        { name: 'Porto Alegre', latitude: -30.033056, longitude: -51.23 },
        { name: 'São Paulo', latitude: -23.5475, longitude: -46.636111 },
      ],
    },
    {
      name: 'Canadá',
      code: 'CA',
      cities: [
        { name: 'Barrie', latitude: 44.883421, longitude: -77.116137 },
        { name: 'Burlington', latitude: 43.386208, longitude: -79.83713 },
        { name: 'Calgary', latitude: 51.050112, longitude: -114.085285 },
        { name: 'Edmonton', latitude: 53.550136, longitude: -113.468712 },
        { name: 'Kelowna', latitude: 49.883074, longitude: -119.485675 },
        { name: 'Kitchener', latitude: 43.450096, longitude: -80.482987 },
        { name: 'Laval', latitude: 45.569953, longitude: -73.691998 },
        { name: 'London', latitude: 42.983389, longitude: -81.233042 },
        { name: 'Montreal', latitude: 45.508838, longitude: -73.587809 },
        { name: 'Oshawa', latitude: 43.90012, longitude: -78.849569 },
        { name: 'Ottawa', latitude: 45.420941, longitude: -75.690286 },
        { name: 'Penticton', latitude: 49.499765, longitude: -119.585692 },
        { name: 'Quebec City', latitude: 46.812, longitude: -71.215 },
        { name: "St. John's", latitude: 47.5675, longitude: -52.707222 },
        { name: 'Toronto', latitude: 43.700114, longitude: -79.416304 },
        { name: 'Vancouver', latitude: 49.249657, longitude: -123.11934 },
        { name: 'Winnipeg', latitude: 49.884399, longitude: -97.147045 },
      ],
    },
    {
      name: 'Chile',
      code: 'CL',
      cities: [{ name: 'Santiago', latitude: -33.426, longitude: -70.567 }],
    },
    {
      name: 'Colombia',
      code: 'CO',
      cities: [{ name: 'Bogota', latitude: 4.6, longitude: -74.083 }],
    },
    {
      name: 'Corea del Sur',
      code: 'KR',
      cities: [{ name: 'Seoul', latitude: 37.566389, longitude: 126.999722 }],
    },
    {
      name: 'Dinamarca',
      code: 'DK',
      cities: [
        { name: 'Copenhagen', latitude: 55.677681, longitude: 12.570934 },
      ],
    },
    {
      name: 'Francia',
      code: 'FR',
      cities: [
        { name: 'Arras', latitude: 50.293, longitude: 2.782 },
        { name: 'Clisson', latitude: 47.083, longitude: -1.283 },
        { name: 'Décines-Charpieu', latitude: 45.75, longitude: 4.967 },
        { name: 'La Plaine-Saint-Denis', latitude: 48.9, longitude: 2.367 },
        { name: 'Nîmes', latitude: 43.833, longitude: 4.35 },
        { name: 'Paris', latitude: 48.853, longitude: 2.349 },
      ],
    },
    {
      name: 'Irlanda',
      code: 'IE',
      cities: [{ name: 'Dublin', latitude: 53.333056, longitude: -6.248889 }],
    },
    {
      name: 'Italia',
      code: 'IT',
      cities: [
        { name: 'Bologna', latitude: 44.493811, longitude: 11.338749 },
        { name: 'Florence', latitude: 43.766667, longitude: 11.25 },
        { name: 'Milan', latitude: 45.464269, longitude: 9.189506 },
      ],
    },
    {
      name: 'Japón',
      code: 'JP',
      cities: [
        { name: 'Chiba', latitude: 35.362, longitude: 140.622 },
        { name: 'Osaka', latitude: 34.694, longitude: 135.502 },
        { name: 'Suita', latitude: 34.761, longitude: 135.516 },
        { name: 'Tokyo', latitude: 35.69, longitude: 139.692 },
      ],
    },
    {
      name: 'Luxemburgo',
      code: 'LU',
      cities: [{ name: 'Luxembourg', latitude: 49.611667, longitude: 6.13 }],
    },
    {
      name: 'Noruega',
      code: 'NO',
      cities: [{ name: 'Oslo', latitude: 59.912697, longitude: 10.741367 }],
    },
    {
      name: 'Países Bajos',
      code: 'NL',
      cities: [
        { name: 'Amsterdam', latitude: 52.373, longitude: 4.9 },
        { name: 'Haarlem', latitude: 52.380839, longitude: 4.636831 },
        { name: 'Landgraaf', latitude: 50.907092, longitude: 6.02716 },
        { name: 'Nijmegen', latitude: 51.8425, longitude: 5.852778 },
      ],
    },
    {
      name: 'Paraguay',
      code: 'PY',
      cities: [{ name: 'Luque', latitude: -25.266667, longitude: -57.566667 }],
    },
    {
      name: 'Perú',
      code: 'PE',
      cities: [{ name: 'Lima', latitude: -12.083333, longitude: -77.083333 }],
    },
    {
      name: 'Polonia',
      code: 'PL',
      cities: [
        { name: 'Broczyno', latitude: 53.523421, longitude: 16.310663 },
        { name: 'Warsaw', latitude: 52.25, longitude: 21 },
      ],
    },
    {
      name: 'Portugal',
      code: 'PT',
      cities: [
        { name: 'Lisbon', latitude: 38.716667, longitude: -9.133333 },
        { name: 'Oeiras', latitude: 38.683333, longitude: -9.316667 },
      ],
    },
    {
      name: 'Reino Unido',
      code: 'GB',
      cities: [
        { name: 'Belfast', latitude: 54.583333, longitude: -5.933333 },
        { name: 'Birmingham', latitude: 52.466667, longitude: -1.916667 },
        { name: 'Cardiff', latitude: 51.48, longitude: -3.18 },
        { name: 'Castle Donington', latitude: 52.842906, longitude: -1.341877 },
        { name: 'Ebbw Vale', latitude: 51.783333, longitude: -3.2 },
        { name: 'Glasgow', latitude: 55.833333, longitude: -4.25 },
        { name: 'Huddersfield', latitude: 53.65, longitude: -1.783333 },
        { name: 'Leeds', latitude: 53.797356, longitude: -1.545389 },
        { name: 'Liverpool', latitude: 53.416667, longitude: -3 },
        { name: 'London', latitude: 51.508415, longitude: -0.125533 },
        { name: 'Maidstone', latitude: 51.266667, longitude: 0.516667 },
        { name: 'Manchester', latitude: 53.480946, longitude: -2.237434 },
        { name: 'Milton Keynes', latitude: 52.041722, longitude: -0.755825 },
        { name: 'Newcastle upon Tyne', latitude: 54.973, longitude: -1.614 },
        { name: 'Nottingham', latitude: 52.953602, longitude: -1.150475 },
        { name: 'Plymouth', latitude: 50.371525, longitude: -4.143047 },
        { name: 'Sheffield', latitude: 53.383, longitude: -1.466 },
      ],
    },
    {
      name: 'República Checa',
      code: 'CZ',
      cities: [
        { name: 'Hradec Králové', latitude: 50.209228, longitude: 15.832768 },
        { name: 'Prague', latitude: 50.087837, longitude: 14.424132 },
      ],
    },
    {
      name: 'Suecia',
      code: 'SE',
      cities: [
        { name: 'Norje', latitude: 56.116667, longitude: 14.666667 },
        { name: 'Stockholm', latitude: 59.332577, longitude: 18.064903 },
      ],
    },
    {
      name: 'Suiza',
      code: 'CH',
      cities: [
        { name: 'Gränichen', latitude: 47.35, longitude: 8.1 },
        {
          name: 'Matten bei Interlaken',
          latitude: 46.67349,
          longitude: 7.87411,
        },
        { name: 'Zurich', latitude: 47.366667, longitude: 8.55 },
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

  await prisma.artist.upsert({
    where: { slug: 'the-warning' },
    update: { name: 'The Warning' },
    create: { name: 'The Warning', slug: 'the-warning' },
  });

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
