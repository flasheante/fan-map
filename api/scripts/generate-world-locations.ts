// Regenerates prisma/data/world-locations.json — the worldwide catalog of
// countries and main cities fans can pick from when they join, on top of
// the tour cities hardcoded in prisma/seed.ts.
//
// Source: GeoNames (CC BY 4.0, https://www.geonames.org/). Download and
// unzip these two files into a folder and pass it as the only argument:
//
//   https://download.geonames.org/export/dump/cities15000.zip
//   https://download.geonames.org/export/dump/countryInfo.txt
//
//   npx tsx scripts/generate-world-locations.ts <geonames-dir>
//
// Selection rules:
// - Every current, inhabited country/territory in countryInfo.txt, named in Spanish
//   via Intl.DisplayNames (same language as the tour countries in seed.ts).
// - Per country, every city with >= MIN_POPULATION inhabitants, plus the
//   MIN_CITIES_PER_COUNTRY most populous ones so small countries aren't
//   left empty.
// - City names keep GeoNames' `name` column (e.g. 'Mexico City'), which
//   matches setlist.fm's spelling for most cities.
// - Sections of populated places (PPLX, e.g. city districts), Paris
//   arrondissements and historical/abandoned places are dropped.
// - Overlaps with tour cities (same place, different spelling, e.g.
//   'Bogotá' vs 'Bogota') are resolved at seed time, not here — see
//   prisma/seed.ts.
// - Names are unique per country (cities.@@unique([countryId, name])), so
//   only the most populous city with a given name is kept.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MIN_POPULATION = 100_000;
const MIN_CITIES_PER_COUNTRY = 5;
const EXCLUDED_FEATURE_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW']);
// Paris arrondissements are tagged PPL instead of PPLX ('Paris 16 Passy').
const EXCLUDED_NAME_PATTERN = /^Paris \d{2} /;
// Codes still listed in countryInfo.txt for countries that no longer exist.
const EXCLUDED_COUNTRY_CODES = new Set(['AN', 'CS']);

type WorldCity = { name: string; latitude: number; longitude: number };
type WorldCountry = { name: string; code: string; cities: WorldCity[] };

const geonamesDir = process.argv[2];
if (!geonamesDir) {
  console.error(
    'Usage: tsx scripts/generate-world-locations.ts <geonames-dir>',
  );
  process.exit(1);
}

const spanishNames = new Intl.DisplayNames(['es'], { type: 'region' });

const countryCodes = readFileSync(join(geonamesDir, 'countryInfo.txt'), 'utf8')
  .split('\n')
  .filter((line) => line.trim() && !line.startsWith('#'))
  .map((line) => line.split('\t')[0])
  .filter((code) => !EXCLUDED_COUNTRY_CODES.has(code));

type Candidate = WorldCity & { population: number };
const candidatesByCountry = new Map<string, Candidate[]>();

for (const line of readFileSync(
  join(geonamesDir, 'cities15000.txt'),
  'utf8',
).split('\n')) {
  if (!line.trim()) continue;
  const cols = line.split('\t');
  const featureCode = cols[7];
  if (EXCLUDED_FEATURE_CODES.has(featureCode)) continue;
  if (EXCLUDED_NAME_PATTERN.test(cols[1])) continue;

  const countryCode = cols[8];
  const candidates = candidatesByCountry.get(countryCode) ?? [];
  candidates.push({
    name: cols[1].trim(),
    latitude: Number(cols[4]),
    longitude: Number(cols[5]),
    population: Number(cols[14]),
  });
  candidatesByCountry.set(countryCode, candidates);
}

const countries: WorldCountry[] = countryCodes
  .map((code) => {
    const seen = new Set<string>();
    const cities = (candidatesByCountry.get(code) ?? [])
      .sort((a, b) => b.population - a.population)
      .filter((city) => {
        if (seen.has(city.name)) return false;
        seen.add(city.name);
        return true;
      })
      .filter(
        (city, index) =>
          city.population >= MIN_POPULATION || index < MIN_CITIES_PER_COUNTRY,
      )
      .map(({ name, latitude, longitude }) => ({ name, latitude, longitude }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    return { name: spanishNames.of(code) ?? code, code, cities };
  })
  // Uninhabited territories (Antarctica, Bouvet Island...) have no city a
  // fan could pick, so they'd only be dead ends in the country dropdown.
  .filter((country) => country.cities.length > 0)
  .sort((a, b) => a.name.localeCompare(b.name, 'es'));

const outDir = join(__dirname, '..', 'prisma', 'data');
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'world-locations.json'),
  JSON.stringify(countries, null, 2) + '\n',
);

const cityCount = countries.reduce((sum, c) => sum + c.cities.length, 0);
console.log(`Wrote ${countries.length} countries and ${cityCount} cities`);
