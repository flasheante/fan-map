import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
        {
          name: 'Buenos Aires',
          latitude: -34.576,
          longitude: -58.409,
          region: '07',
        },
        {
          name: 'Córdoba',
          latitude: -31.4,
          longitude: -64.183333,
          region: '05',
        },
        {
          name: 'La Plata',
          latitude: -34.931389,
          longitude: -57.948889,
          region: '01',
        },
        {
          name: 'Mar del Plata',
          latitude: -38,
          longitude: -57.55,
          region: '01',
        },
        {
          name: 'Mendoza',
          latitude: -32.883333,
          longitude: -68.816667,
          region: '13',
        },
        {
          name: 'Rosario',
          latitude: -32.951111,
          longitude: -60.666389,
          region: '21',
        },
        {
          name: 'San Isidro',
          latitude: -34.470833,
          longitude: -58.528611,
          region: '01',
        },
        {
          name: 'Santa Fe',
          latitude: -31.633333,
          longitude: -60.7,
          region: '21',
        },
      ],
    },
    {
      name: 'México',
      code: 'MX',
      cities: [
        {
          name: 'Aguascalientes',
          latitude: 21.883,
          longitude: -102.3,
          region: '01',
        },
        {
          name: 'Cancún',
          latitude: 21.174288,
          longitude: -86.846559,
          region: '23',
        },
        {
          name: 'Chihuahua',
          latitude: 28.633333,
          longitude: -106.083333,
          region: '06',
        },
        {
          name: 'Ciudad Juárez',
          latitude: 31.733333,
          longitude: -106.483333,
          region: '06',
        },
        {
          name: 'Guadalajara',
          latitude: 20.666667,
          longitude: -103.333333,
          region: '14',
        },
        {
          name: 'Irapuato',
          latitude: 20.683333,
          longitude: -101.35,
          region: '11',
        },
        {
          name: 'León',
          latitude: 21.116667,
          longitude: -101.666667,
          region: '11',
        },
        { name: 'Mérida', latitude: 20.967, longitude: -89.617, region: '31' },
        {
          name: 'Mexico City',
          latitude: 19.434,
          longitude: -99.139,
          region: '09',
        },
        { name: 'Monclova', latitude: 26.9, longitude: -101.417, region: '07' },
        {
          name: 'Monterrey',
          latitude: 25.671,
          longitude: -100.308,
          region: '19',
        },
        {
          name: 'Pachuca',
          latitude: 20.116973,
          longitude: -98.733294,
          region: '13',
        },
        {
          name: 'Piedras Negras',
          latitude: 28.7,
          longitude: -100.524,
          region: '07',
        },
        {
          name: 'Puebla de Zaragoza',
          latitude: 19.05,
          longitude: -98.2,
          region: '21',
        },
        {
          name: 'Río Verde',
          latitude: 21.626,
          longitude: -100.172,
          region: '24',
        },
        { name: 'Saltillo', latitude: 25.417, longitude: -101, region: '07' },
        {
          name: 'San Andrés Cholula',
          latitude: 19.05,
          longitude: -98.3,
          region: '21',
        },
        {
          name: 'San Juan Teotihuacán',
          latitude: 19.683333,
          longitude: -98.866667,
          region: '15',
        },
        {
          name: 'San Lucas',
          latitude: 22.890883,
          longitude: -109.912376,
          region: '03',
        },
        {
          name: 'San Luis Potosí',
          latitude: 22.15,
          longitude: -100.983333,
          region: '24',
        },
        {
          name: 'San Pedro Garza García',
          latitude: 25.667,
          longitude: -100.4,
          region: '19',
        },
        {
          name: 'Santiago',
          latitude: 25.425,
          longitude: -100.152,
          region: '19',
        },
        {
          name: 'Santiago de Querétaro',
          latitude: 20.591,
          longitude: -100.392,
          region: '22',
        },
        {
          name: 'Tijuana',
          latitude: 32.533333,
          longitude: -117.016667,
          region: '02',
        },
        {
          name: 'Toluca',
          latitude: 19.288333,
          longitude: -99.667222,
          region: '15',
        },
        { name: 'Torreón', latitude: 25.55, longitude: -103.433, region: '07' },
        {
          name: 'Zacatecas',
          latitude: 22.776,
          longitude: -102.572,
          region: '32',
        },
        {
          name: 'Zapopan',
          latitude: 20.716667,
          longitude: -103.4,
          region: '14',
        },
      ],
    },
    {
      name: 'España',
      code: 'ES',
      cities: [
        {
          name: 'Barcelona',
          latitude: 41.388787,
          longitude: 2.158985,
          region: '56',
        },
        {
          name: 'Bilbao',
          latitude: 43.262706,
          longitude: -2.925282,
          region: '59',
        },
        {
          name: 'Madrid',
          latitude: 40.416502,
          longitude: -3.702564,
          region: '29',
        },
        {
          name: 'Santa Coloma de Gramenet',
          latitude: 41.451524,
          longitude: 2.208102,
          region: '56',
        },
        {
          name: 'Santiago de Compostela',
          latitude: 42.880524,
          longitude: -8.54569,
          region: '58',
        },
      ],
    },
    {
      name: 'Estados Unidos',
      code: 'US',
      cities: [
        {
          name: 'Albuquerque',
          latitude: 35.084,
          longitude: -106.651,
          region: 'NM',
        },
        {
          name: 'Alpharetta',
          latitude: 34.075376,
          longitude: -84.29409,
          region: 'GA',
        },
        {
          name: 'Anaheim',
          latitude: 33.835293,
          longitude: -117.914504,
          region: 'CA',
        },
        {
          name: 'Asbury Park',
          latitude: 40.220391,
          longitude: -74.012082,
          region: 'NJ',
        },
        {
          name: 'Atlanta',
          latitude: 33.748995,
          longitude: -84.387982,
          region: 'GA',
        },
        {
          name: 'Atlantic City',
          latitude: 39.364283,
          longitude: -74.422927,
          region: 'NJ',
        },
        {
          name: 'Austin',
          latitude: 30.267153,
          longitude: -97.743061,
          region: 'TX',
        },
        {
          name: 'Baltimore',
          latitude: 39.290385,
          longitude: -76.612189,
          region: 'MD',
        },
        {
          name: 'Berkeley',
          latitude: 37.871593,
          longitude: -122.272747,
          region: 'CA',
        },
        {
          name: 'Boston',
          latitude: 42.358431,
          longitude: -71.059773,
          region: 'MA',
        },
        {
          name: 'Bridgeport',
          latitude: 41.167041,
          longitude: -73.204835,
          region: 'CT',
        },
        { name: 'Brooklyn', latitude: 40.65, longitude: -73.95, region: 'NY' },
        {
          name: 'Brownsville',
          latitude: 25.901747,
          longitude: -97.497484,
          region: 'TX',
        },
        {
          name: 'Burbank',
          latitude: 34.180839,
          longitude: -118.308966,
          region: 'CA',
        },
        {
          name: 'Camden',
          latitude: 39.925946,
          longitude: -75.11962,
          region: 'NJ',
        },
        {
          name: 'Cedar Knolls',
          latitude: 40.822044,
          longitude: -74.448765,
          region: 'NJ',
        },
        {
          name: 'Charlotte',
          latitude: 35.227087,
          longitude: -80.843127,
          region: 'NC',
        },
        {
          name: 'Chesterfield',
          latitude: 38.663108,
          longitude: -90.577067,
          region: 'MO',
        },
        {
          name: 'Chicago',
          latitude: 41.850033,
          longitude: -87.650052,
          region: 'IL',
        },
        {
          name: 'Cincinnati',
          latitude: 39.162004,
          longitude: -84.456886,
          region: 'OH',
        },
        {
          name: 'Cleveland',
          latitude: 41.499495,
          longitude: -81.695409,
          region: 'OH',
        },
        {
          name: 'Colorado Springs',
          latitude: 38.833882,
          longitude: -104.821363,
          region: 'CO',
        },
        {
          name: 'Columbus',
          latitude: 39.961176,
          longitude: -82.998794,
          region: 'OH',
        },
        {
          name: 'Concord',
          latitude: 37.977978,
          longitude: -122.031073,
          region: 'CA',
        },
        {
          name: 'Corpus Christi',
          latitude: 27.800583,
          longitude: -97.396381,
          region: 'TX',
        },
        {
          name: 'Cuyahoga Falls',
          latitude: 41.133945,
          longitude: -81.484558,
          region: 'OH',
        },
        {
          name: 'Dallas',
          latitude: 32.783056,
          longitude: -96.806667,
          region: 'TX',
        },
        {
          name: 'Daytona Beach',
          latitude: 29.210815,
          longitude: -81.022833,
          region: 'FL',
        },
        {
          name: 'Denver',
          latitude: 39.739154,
          longitude: -104.984703,
          region: 'CO',
        },
        {
          name: 'Destin',
          latitude: 30.393534,
          longitude: -86.495783,
          region: 'FL',
        },
        {
          name: 'Detroit',
          latitude: 42.331427,
          longitude: -83.045754,
          region: 'MI',
        },
        {
          name: 'Durant',
          latitude: 33.993986,
          longitude: -96.370824,
          region: 'OK',
        },
        {
          name: 'Flint',
          latitude: 43.012527,
          longitude: -83.687456,
          region: 'MI',
        },
        {
          name: 'Gilford',
          latitude: 43.547577,
          longitude: -71.406738,
          region: 'NH',
        },
        {
          name: 'Glendale',
          latitude: 33.538652,
          longitude: -112.185987,
          region: 'AZ',
        },
        {
          name: 'Grand Junction',
          latitude: 39.063871,
          longitude: -108.550649,
          region: 'CO',
        },
        {
          name: 'Grand Rapids',
          latitude: 42.96336,
          longitude: -85.668086,
          region: 'MI',
        },
        {
          name: 'Hollywood',
          latitude: 26.011201,
          longitude: -80.14949,
          region: 'FL',
        },
        {
          name: 'Holmdel',
          latitude: 40.34511,
          longitude: -74.184032,
          region: 'NJ',
        },
        {
          name: 'Houston',
          latitude: 29.763284,
          longitude: -95.363271,
          region: 'TX',
        },
        {
          name: 'Huntsville',
          latitude: 34.730369,
          longitude: -86.586104,
          region: 'AL',
        },
        {
          name: 'Indianapolis',
          latitude: 39.768377,
          longitude: -86.158042,
          region: 'IN',
        },
        {
          name: 'Irving',
          latitude: 32.814018,
          longitude: -96.948894,
          region: 'TX',
        },
        {
          name: 'Kansas City',
          latitude: 39.099727,
          longitude: -94.578567,
          region: 'MO',
        },
        {
          name: 'Kent',
          latitude: 47.380934,
          longitude: -122.234843,
          region: 'WA',
        },
        {
          name: 'Lake Buena Vista',
          latitude: 28.393619,
          longitude: -81.538684,
          region: 'FL',
        },
        {
          name: 'Las Vegas',
          latitude: 36.174971,
          longitude: -115.137223,
          region: 'NV',
        },
        {
          name: 'Los Angeles',
          latitude: 34.052,
          longitude: -118.244,
          region: 'CA',
        },
        {
          name: 'Louisville',
          latitude: 38.254238,
          longitude: -85.759407,
          region: 'KY',
        },
        {
          name: 'Lubbock',
          latitude: 33.577863,
          longitude: -101.855166,
          region: 'TX',
        },
        {
          name: 'Maryland Heights',
          latitude: 38.713107,
          longitude: -90.42984,
          region: 'MO',
        },
        {
          name: 'McAllen',
          latitude: 26.203407,
          longitude: -98.230012,
          region: 'TX',
        },
        {
          name: 'Miami',
          latitude: 25.774266,
          longitude: -80.193659,
          region: 'FL',
        },
        {
          name: 'Miami Beach',
          latitude: 25.790654,
          longitude: -80.130045,
          region: 'FL',
        },
        {
          name: 'Milwaukee',
          latitude: 43.038903,
          longitude: -87.906474,
          region: 'WI',
        },
        {
          name: 'Minneapolis',
          latitude: 44.979965,
          longitude: -93.263836,
          region: 'MN',
        },
        {
          name: 'Monterey',
          latitude: 36.600238,
          longitude: -121.894676,
          region: 'CA',
        },
        {
          name: 'Morrison',
          latitude: 39.653599,
          longitude: -105.1911,
          region: 'CO',
        },
        {
          name: 'Napa',
          latitude: 38.297137,
          longitude: -122.285529,
          region: 'CA',
        },
        {
          name: 'Nashville',
          latitude: 36.16589,
          longitude: -86.784443,
          region: 'TN',
        },
        {
          name: 'New Orleans',
          latitude: 29.955,
          longitude: -90.075,
          region: 'LA',
        },
        {
          name: 'New York',
          latitude: 40.714269,
          longitude: -74.005973,
          region: 'NY',
        },
        {
          name: 'Newark',
          latitude: 40.735657,
          longitude: -74.172367,
          region: 'NJ',
        },
        {
          name: 'Oceanside',
          latitude: 33.19587,
          longitude: -117.379483,
          region: 'CA',
        },
        {
          name: 'Oklahoma City',
          latitude: 35.46756,
          longitude: -97.516428,
          region: 'OK',
        },
        {
          name: 'Orlando',
          latitude: 28.538336,
          longitude: -81.379236,
          region: 'FL',
        },
        {
          name: 'Philadelphia',
          latitude: 39.952335,
          longitude: -75.163789,
          region: 'PA',
        },
        {
          name: 'Phoenix',
          latitude: 33.448377,
          longitude: -112.074037,
          region: 'AZ',
        },
        {
          name: 'Pittsburgh',
          latitude: 40.440625,
          longitude: -79.995886,
          region: 'PA',
        },
        {
          name: 'Pomona',
          latitude: 34.055289,
          longitude: -117.752279,
          region: 'CA',
        },
        {
          name: 'Port Canaveral',
          latitude: 28.416114,
          longitude: -80.607829,
          region: 'FL',
        },
        {
          name: 'Portland',
          latitude: 45.523452,
          longitude: -122.676207,
          region: 'OR',
        },
        {
          name: 'Portsmouth',
          latitude: 36.835426,
          longitude: -76.298274,
          region: 'VA',
        },
        {
          name: 'Raleigh',
          latitude: 35.772096,
          longitude: -78.638614,
          region: 'NC',
        },
        {
          name: 'Reading',
          latitude: 40.335648,
          longitude: -75.926875,
          region: 'PA',
        },
        {
          name: 'Reno',
          latitude: 39.529633,
          longitude: -119.813803,
          region: 'NV',
        },
        {
          name: 'Richmond',
          latitude: 37.553758,
          longitude: -77.460262,
          region: 'VA',
        },
        {
          name: 'Rogers',
          latitude: 36.33202,
          longitude: -94.118537,
          region: 'AR',
        },
        {
          name: 'Sacramento',
          latitude: 38.581572,
          longitude: -121.4944,
          region: 'CA',
        },
        {
          name: 'Salt Lake City',
          latitude: 40.760779,
          longitude: -111.891047,
          region: 'UT',
        },
        {
          name: 'San Antonio',
          latitude: 29.424122,
          longitude: -98.493628,
          region: 'TX',
        },
        {
          name: 'San Diego',
          latitude: 32.715329,
          longitude: -117.157255,
          region: 'CA',
        },
        {
          name: 'San Francisco',
          latitude: 37.775,
          longitude: -122.419,
          region: 'CA',
        },
        {
          name: 'San Luis Obispo',
          latitude: 35.354,
          longitude: -120.6625,
          region: 'CA',
        },
        {
          name: 'Santa Ana',
          latitude: 33.745573,
          longitude: -117.867834,
          region: 'CA',
        },
        {
          name: 'Scranton',
          latitude: 41.408969,
          longitude: -75.662412,
          region: 'PA',
        },
        {
          name: 'Seattle',
          latitude: 47.60621,
          longitude: -122.332071,
          region: 'WA',
        },
        {
          name: 'Silver Spring',
          latitude: 38.990666,
          longitude: -77.026088,
          region: 'MD',
        },
        {
          name: 'St. Louis',
          latitude: 38.627273,
          longitude: -90.197889,
          region: 'MO',
        },
        {
          name: 'Sterling Heights',
          latitude: 42.580312,
          longitude: -83.030203,
          region: 'MI',
        },
        {
          name: 'Syracuse',
          latitude: 43.048122,
          longitude: -76.147424,
          region: 'NY',
        },
        {
          name: 'Tampa',
          latitude: 27.947522,
          longitude: -82.458428,
          region: 'FL',
        },
        {
          name: 'The Woodlands',
          latitude: 30.157994,
          longitude: -95.489384,
          region: 'TX',
        },
        {
          name: 'Towson',
          latitude: 39.401496,
          longitude: -76.601912,
          region: 'MD',
        },
        {
          name: 'Tucson',
          latitude: 32.221743,
          longitude: -110.926479,
          region: 'AZ',
        },
        {
          name: 'Warrendale',
          latitude: 40.6534,
          longitude: -80.079503,
          region: 'PA',
        },
        {
          name: 'Washington',
          latitude: 38.895,
          longitude: -77.036,
          region: 'DC',
        },
        {
          name: 'West Hollywood',
          latitude: 34.090009,
          longitude: -118.361744,
          region: 'CA',
        },
      ],
    },
    {
      name: 'Alemania',
      code: 'DE',
      cities: [
        { name: 'Berlin', latitude: 52.516667, longitude: 13.4, region: '16' },
        { name: 'Cologne', latitude: 50.933333, longitude: 6.95, region: '07' },
        {
          name: 'Frankfurt',
          latitude: 50.116667,
          longitude: 8.683333,
          region: '05',
        },
        {
          name: 'Freiburg',
          latitude: 47.995895,
          longitude: 7.852221,
          region: '01',
        },
        {
          name: 'Munich',
          latitude: 48.137433,
          longitude: 11.575491,
          region: '02',
        },
        {
          name: 'Münster',
          latitude: 51.962356,
          longitude: 7.625713,
          region: '07',
        },
        { name: 'Nürburg', latitude: 50.333333, longitude: 6.95, region: '08' },
        {
          name: 'Nuremberg',
          latitude: 49.447778,
          longitude: 11.068333,
          region: '02',
        },
        { name: 'Wacken', latitude: 54.021, longitude: 9.376, region: '10' },
      ],
    },
    {
      name: 'Austria',
      code: 'AT',
      cities: [
        {
          name: 'Feldkirch',
          latitude: 47.233056,
          longitude: 9.6,
          region: '08',
        },
        {
          name: 'Nickelsdorf',
          latitude: 47.940556,
          longitude: 17.069444,
          region: '01',
        },
      ],
    },
    {
      name: 'Bélgica',
      code: 'BE',
      cities: [
        { name: 'Dessel', latitude: 51.233, longitude: 5.117, region: 'VLG' },
        { name: 'Lokeren', latitude: 51.1, longitude: 3.983, region: 'VLG' },
      ],
    },
    {
      name: 'Brasil',
      code: 'BR',
      cities: [
        {
          name: 'Curitiba',
          latitude: -25.427778,
          longitude: -49.273056,
          region: '18',
        },
        {
          name: 'Porto Alegre',
          latitude: -30.033056,
          longitude: -51.23,
          region: '23',
        },
        {
          name: 'São Paulo',
          latitude: -23.5475,
          longitude: -46.636111,
          region: '27',
        },
      ],
    },
    {
      name: 'Canadá',
      code: 'CA',
      cities: [
        {
          name: 'Barrie',
          latitude: 44.883421,
          longitude: -77.116137,
          region: '08',
        },
        {
          name: 'Burlington',
          latitude: 43.386208,
          longitude: -79.83713,
          region: '08',
        },
        {
          name: 'Calgary',
          latitude: 51.050112,
          longitude: -114.085285,
          region: '01',
        },
        {
          name: 'Edmonton',
          latitude: 53.550136,
          longitude: -113.468712,
          region: '01',
        },
        {
          name: 'Kelowna',
          latitude: 49.883074,
          longitude: -119.485675,
          region: '02',
        },
        {
          name: 'Kitchener',
          latitude: 43.450096,
          longitude: -80.482987,
          region: '08',
        },
        {
          name: 'Laval',
          latitude: 45.569953,
          longitude: -73.691998,
          region: '10',
        },
        {
          name: 'London',
          latitude: 42.983389,
          longitude: -81.233042,
          region: '08',
        },
        {
          name: 'Montreal',
          latitude: 45.508838,
          longitude: -73.587809,
          region: '10',
        },
        {
          name: 'Oshawa',
          latitude: 43.90012,
          longitude: -78.849569,
          region: '08',
        },
        {
          name: 'Ottawa',
          latitude: 45.420941,
          longitude: -75.690286,
          region: '08',
        },
        {
          name: 'Penticton',
          latitude: 49.499765,
          longitude: -119.585692,
          region: '02',
        },
        {
          name: 'Quebec City',
          latitude: 46.812,
          longitude: -71.215,
          region: '10',
        },
        {
          name: "St. John's",
          latitude: 47.5675,
          longitude: -52.707222,
          region: '05',
        },
        {
          name: 'Toronto',
          latitude: 43.700114,
          longitude: -79.416304,
          region: '08',
        },
        {
          name: 'Vancouver',
          latitude: 49.249657,
          longitude: -123.11934,
          region: '02',
        },
        {
          name: 'Winnipeg',
          latitude: 49.884399,
          longitude: -97.147045,
          region: '03',
        },
      ],
    },
    {
      name: 'Chile',
      code: 'CL',
      cities: [
        {
          name: 'Santiago',
          latitude: -33.426,
          longitude: -70.567,
          region: '12',
        },
      ],
    },
    {
      name: 'Colombia',
      code: 'CO',
      cities: [
        { name: 'Bogota', latitude: 4.6, longitude: -74.083, region: '34' },
      ],
    },
    {
      name: 'Corea del Sur',
      code: 'KR',
      cities: [
        {
          name: 'Seoul',
          latitude: 37.566389,
          longitude: 126.999722,
          region: '11',
        },
      ],
    },
    {
      name: 'Dinamarca',
      code: 'DK',
      cities: [
        {
          name: 'Copenhagen',
          latitude: 55.677681,
          longitude: 12.570934,
          region: '17',
        },
      ],
    },
    {
      name: 'Francia',
      code: 'FR',
      cities: [
        { name: 'Arras', latitude: 50.293, longitude: 2.782, region: '32' },
        { name: 'Clisson', latitude: 47.083, longitude: -1.283, region: '52' },
        {
          name: 'Décines-Charpieu',
          latitude: 45.75,
          longitude: 4.967,
          region: '84',
        },
        {
          name: 'La Plaine-Saint-Denis',
          latitude: 48.9,
          longitude: 2.367,
          region: '11',
        },
        { name: 'Nîmes', latitude: 43.833, longitude: 4.35, region: '76' },
        { name: 'Paris', latitude: 48.853, longitude: 2.349, region: '11' },
      ],
    },
    {
      name: 'Irlanda',
      code: 'IE',
      cities: [
        {
          name: 'Dublin',
          latitude: 53.333056,
          longitude: -6.248889,
          region: 'L',
        },
      ],
    },
    {
      name: 'Italia',
      code: 'IT',
      cities: [
        {
          name: 'Bologna',
          latitude: 44.493811,
          longitude: 11.338749,
          region: '05',
        },
        {
          name: 'Florence',
          latitude: 43.766667,
          longitude: 11.25,
          region: '16',
        },
        {
          name: 'Milan',
          latitude: 45.464269,
          longitude: 9.189506,
          region: '09',
        },
      ],
    },
    {
      name: 'Japón',
      code: 'JP',
      cities: [
        { name: 'Chiba', latitude: 35.362, longitude: 140.622, region: '04' },
        { name: 'Osaka', latitude: 34.694, longitude: 135.502, region: '32' },
        { name: 'Suita', latitude: 34.761, longitude: 135.516, region: '32' },
        { name: 'Tokyo', latitude: 35.69, longitude: 139.692, region: '40' },
      ],
    },
    {
      name: 'Luxemburgo',
      code: 'LU',
      cities: [
        {
          name: 'Luxembourg',
          latitude: 49.611667,
          longitude: 6.13,
          region: 'LU',
        },
      ],
    },
    {
      name: 'Noruega',
      code: 'NO',
      cities: [
        {
          name: 'Oslo',
          latitude: 59.912697,
          longitude: 10.741367,
          region: '12',
        },
      ],
    },
    {
      name: 'Países Bajos',
      code: 'NL',
      cities: [
        { name: 'Amsterdam', latitude: 52.373, longitude: 4.9, region: '07' },
        {
          name: 'Haarlem',
          latitude: 52.380839,
          longitude: 4.636831,
          region: '07',
        },
        {
          name: 'Landgraaf',
          latitude: 50.907092,
          longitude: 6.02716,
          region: '05',
        },
        {
          name: 'Nijmegen',
          latitude: 51.8425,
          longitude: 5.852778,
          region: '03',
        },
      ],
    },
    {
      name: 'Paraguay',
      code: 'PY',
      cities: [
        {
          name: 'Luque',
          latitude: -25.266667,
          longitude: -57.566667,
          region: '06',
        },
      ],
    },
    {
      name: 'Perú',
      code: 'PE',
      cities: [
        {
          name: 'Lima',
          latitude: -12.083333,
          longitude: -77.083333,
          region: 'LMA',
        },
      ],
    },
    {
      name: 'Polonia',
      code: 'PL',
      cities: [
        {
          name: 'Broczyno',
          latitude: 53.523421,
          longitude: 16.310663,
          region: '87',
        },
        { name: 'Warsaw', latitude: 52.25, longitude: 21, region: '78' },
      ],
    },
    {
      name: 'Portugal',
      code: 'PT',
      cities: [
        {
          name: 'Lisbon',
          latitude: 38.716667,
          longitude: -9.133333,
          region: '14',
        },
        {
          name: 'Oeiras',
          latitude: 38.683333,
          longitude: -9.316667,
          region: '14',
        },
      ],
    },
    {
      name: 'Reino Unido',
      code: 'GB',
      cities: [
        {
          name: 'Belfast',
          latitude: 54.583333,
          longitude: -5.933333,
          region: 'NIR',
        },
        {
          name: 'Birmingham',
          latitude: 52.466667,
          longitude: -1.916667,
          region: 'ENG',
        },
        { name: 'Cardiff', latitude: 51.48, longitude: -3.18, region: 'WLS' },
        {
          name: 'Castle Donington',
          latitude: 52.842906,
          longitude: -1.341877,
          region: 'ENG',
        },
        {
          name: 'Ebbw Vale',
          latitude: 51.783333,
          longitude: -3.2,
          region: 'WLS',
        },
        {
          name: 'Glasgow',
          latitude: 55.833333,
          longitude: -4.25,
          region: 'SCT',
        },
        {
          name: 'Huddersfield',
          latitude: 53.65,
          longitude: -1.783333,
          region: 'ENG',
        },
        {
          name: 'Leeds',
          latitude: 53.797356,
          longitude: -1.545389,
          region: 'ENG',
        },
        {
          name: 'Liverpool',
          latitude: 53.416667,
          longitude: -3,
          region: 'ENG',
        },
        {
          name: 'London',
          latitude: 51.508415,
          longitude: -0.125533,
          region: 'ENG',
        },
        {
          name: 'Maidstone',
          latitude: 51.266667,
          longitude: 0.516667,
          region: 'ENG',
        },
        {
          name: 'Manchester',
          latitude: 53.480946,
          longitude: -2.237434,
          region: 'ENG',
        },
        {
          name: 'Milton Keynes',
          latitude: 52.041722,
          longitude: -0.755825,
          region: 'ENG',
        },
        {
          name: 'Newcastle upon Tyne',
          latitude: 54.973,
          longitude: -1.614,
          region: 'ENG',
        },
        {
          name: 'Nottingham',
          latitude: 52.953602,
          longitude: -1.150475,
          region: 'ENG',
        },
        {
          name: 'Plymouth',
          latitude: 50.371525,
          longitude: -4.143047,
          region: 'ENG',
        },
        {
          name: 'Sheffield',
          latitude: 53.383,
          longitude: -1.466,
          region: 'ENG',
        },
      ],
    },
    {
      name: 'República Checa',
      code: 'CZ',
      cities: [
        {
          name: 'Hradec Králové',
          latitude: 50.209228,
          longitude: 15.832768,
          region: '82',
        },
        {
          name: 'Prague',
          latitude: 50.087837,
          longitude: 14.424132,
          region: '52',
        },
      ],
    },
    {
      name: 'Suecia',
      code: 'SE',
      cities: [
        {
          name: 'Norje',
          latitude: 56.116667,
          longitude: 14.666667,
          region: '02',
        },
        {
          name: 'Stockholm',
          latitude: 59.332577,
          longitude: 18.064903,
          region: '26',
        },
      ],
    },
    {
      name: 'Suiza',
      code: 'CH',
      cities: [
        { name: 'Gränichen', latitude: 47.35, longitude: 8.1, region: 'AG' },
        {
          name: 'Matten bei Interlaken',
          latitude: 46.67349,
          longitude: 7.87411,
          region: 'BE',
        },
        { name: 'Zurich', latitude: 47.366667, longitude: 8.55, region: 'ZH' },
      ],
    },
  ];

  // Worldwide catalog so fans from anywhere can pick their city, generated
  // from GeoNames by scripts/generate-world-locations.ts. Tour data above
  // wins on any overlap: a country already listed keeps its name, and a
  // world city within MERGE_DISTANCE_KM of a tour city in the same country
  // is treated as the same place under another spelling ('Bogotá' vs
  // 'Bogota', 'New York City' vs 'New York') and skipped, so the
  // setlist.fm spelling stays the only one.
  //
  // Regions (provinces/states) come only from that catalog; each tour city
  // above points at one by its GeoNames admin1 code (`region`), which can
  // be looked up in the country's `regions` in world-locations.json.
  //
  // Regions and world cities are written in bulk per country (createMany +
  // one UPDATE ... FROM unnest) instead of one upsert each: there are ~4k
  // regions and ~6k cities, and per-row round trips to a remote database
  // take over an hour.
  const MERGE_DISTANCE_KM = 3;
  const worldCountries = JSON.parse(
    readFileSync(join(__dirname, 'data', 'world-locations.json'), 'utf8'),
  ) as WorldCountry[];

  const missing = countries.filter(
    (tour) => !worldCountries.some((world) => world.code === tour.code),
  );
  if (missing.length > 0) {
    throw new Error(
      `Tour countries missing from world-locations.json: ${missing.map((c) => c.code).join(', ')}`,
    );
  }

  for (const worldCountry of worldCountries) {
    const tourCountry = countries.find((c) => c.code === worldCountry.code);
    const tourCities = tourCountry?.cities ?? [];
    const name = tourCountry?.name ?? worldCountry.name;

    const country = await prisma.country.upsert({
      where: { code: worldCountry.code },
      update: { name },
      create: { name, code: worldCountry.code },
    });

    await prisma.region.createMany({
      data: worldCountry.regions.map((region) => ({
        ...region,
        countryId: country.id,
      })),
      skipDuplicates: true,
    });
    await prisma.$executeRaw`
      UPDATE regions r SET name = v.name
      FROM unnest(
        ${worldCountry.regions.map((r) => r.code)}::text[],
        ${worldCountry.regions.map((r) => r.name)}::text[]
      ) AS v(code, name)
      WHERE r."countryId" = ${country.id} AND r.code = v.code`;
    const regionIdByCode = new Map(
      (
        await prisma.region.findMany({
          where: { countryId: country.id },
          select: { id: true, code: true },
        })
      ).map((region) => [region.code, region.id]),
    );
    const regionIdOf = (code?: string) =>
      code ? (regionIdByCode.get(code) ?? null) : null;

    for (const city of tourCities) {
      const data = {
        latitude: city.latitude,
        longitude: city.longitude,
        regionId: regionIdOf(city.region),
      };
      await prisma.city.upsert({
        where: { countryId_name: { countryId: country.id, name: city.name } },
        update: data,
        create: { name: city.name, countryId: country.id, ...data },
      });
    }

    const worldCities = worldCountry.cities.filter(
      (worldCity) =>
        !tourCities.some(
          (tourCity) =>
            tourCity.name === worldCity.name ||
            distanceKm(tourCity, worldCity) < MERGE_DISTANCE_KM,
        ),
    );
    await prisma.city.createMany({
      data: worldCities.map((city) => ({
        name: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
        regionId: regionIdOf(city.region),
        countryId: country.id,
      })),
      skipDuplicates: true,
    });
    // createMany skips cities that already exist, so this brings their
    // coordinates and region up to date on re-runs.
    await prisma.$executeRaw`
      UPDATE cities c
      SET latitude = v.latitude, longitude = v.longitude, "regionId" = v.region_id
      FROM unnest(
        ${worldCities.map((city) => city.name)}::text[],
        ${worldCities.map((city) => city.latitude)}::float8[],
        ${worldCities.map((city) => city.longitude)}::float8[],
        ${worldCities.map((city) => regionIdOf(city.region))}::text[]
      ) AS v(name, latitude, longitude, region_id)
      WHERE c."countryId" = ${country.id} AND c.name = v.name`;
  }

  await prisma.artist.upsert({
    where: { slug: 'the-warning' },
    update: { name: 'The Warning' },
    create: { name: 'The Warning', slug: 'the-warning' },
  });

  console.log('Seed completed successfully');
}

type Coordinates = { latitude: number; longitude: number };

type WorldCountry = {
  name: string;
  code: string;
  regions: { code: string; name: string }[];
  cities: (Coordinates & { name: string; region?: string })[];
};

// Great-circle (haversine) distance between two points, in kilometers.
function distanceKm(a: Coordinates, b: Coordinates) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
