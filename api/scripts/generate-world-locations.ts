// Regenerates prisma/data/world-locations.json — the worldwide catalog of
// countries, regions (provinces/states) and main cities fans can pick from
// when they join, on top of the tour cities hardcoded in prisma/seed.ts.
//
// Source: GeoNames (CC BY 4.0, https://www.geonames.org/). Download and
// unzip these files into a folder and pass it as the only argument:
//
//   https://download.geonames.org/export/dump/cities15000.zip
//   https://download.geonames.org/export/dump/countryInfo.txt
//   https://download.geonames.org/export/dump/admin1CodesASCII.txt
//   https://download.geonames.org/export/dump/alternateNamesV2.zip
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
// - Regions are GeoNames' first-level divisions (admin1), all of them per
//   country so seed.ts can also assign tour cities to regions without
//   world cities. Each city carries its region's admin1 code.
// - Region names are Spanish when GeoNames has one, with administrative
//   prefixes dropped ('Provincia de Córdoba' -> 'Córdoba', 'Comunidad
//   Autónoma de Andalucía' -> 'Andalucía'); otherwise GeoNames' own name.
import {
  createReadStream,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const MIN_POPULATION = 100_000;
const MIN_CITIES_PER_COUNTRY = 5;
const EXCLUDED_FEATURE_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW']);
// Paris arrondissements are tagged PPL instead of PPLX ('Paris 16 Passy').
const EXCLUDED_NAME_PATTERN = /^Paris \d{2} /;
// Codes still listed in countryInfo.txt for countries that no longer exist.
const EXCLUDED_COUNTRY_CODES = new Set(['AN', 'CS']);

// Only stripped when followed by a connector, so names that *are* the
// prefix stay intact ('Distrito Federal', 'Región Metropolitana de...').
// 'Distrito' isn't stripped on purpose: 'Distrito de Columbia' must stay.
// Case-sensitive on the connector so articles that belong to the name
// survive ('Comunidad Autónoma de La Rioja' -> 'La Rioja').
const ADMIN_PREFIX =
  /^([Pp]rovincia|[Ee]stado|[Rr]egión|[Cc]omunidad [Aa]utónoma|[Cc]omunidad [Ff]oral|[Cc]omunidad|[Pp]rincipado|[Pp]refectura|[Dd]epartamento|[Gg]obernación|[Cc]ondado|[Cc]antón|[Tt]erritorio|[Vv]oivodato|[Óó]blast) (de las|de los|de la|del|de) /;
// Hand-picked names where the Spanish one would repeat inside a country
// (a capital city that is its own region next to the region around it).
// The generator fails if any other repeated name shows up.
const REGION_NAME_OVERRIDES: Record<string, string> = {
  'PE.LMA': 'Lima Metropolitana',
  'PE.15': 'Lima (región)',
  'BY.04': 'Minsk (ciudad)',
  'BY.05': 'Minsk (provincia)',
  'RU.48': 'Moscú (ciudad)',
  'RU.47': 'Óblast de Moscú',
};

type WorldRegion = { code: string; name: string };
type WorldCity = {
  name: string;
  latitude: number;
  longitude: number;
  region?: string;
};
type WorldCountry = {
  name: string;
  code: string;
  regions: WorldRegion[];
  cities: WorldCity[];
};

const geonamesDir = process.argv[2];
if (!geonamesDir) {
  console.error(
    'Usage: tsx scripts/generate-world-locations.ts <geonames-dir>',
  );
  process.exit(1);
}

type Coordinates = { latitude: number; longitude: number };

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

const spanishNames = new Intl.DisplayNames(['es'], { type: 'region' });

// admin1CodesASCII.txt: "AR.01<TAB>name<TAB>asciiname<TAB>geonameid".
const regionsByCountry = new Map<string, (WorldRegion & { id: string })[]>();
for (const line of readFileSync(
  join(geonamesDir, 'admin1CodesASCII.txt'),
  'utf8',
).split('\n')) {
  if (!line.trim()) continue;
  const [fullCode, name, , geonameId] = line.split('\t');
  const [countryCode, code] = fullCode.split('.');
  const regions = regionsByCountry.get(countryCode) ?? [];
  regions.push({ code, name: name.trim(), id: geonameId.trim() });
  regionsByCountry.set(countryCode, regions);
}

async function loadSpanishRegionNames() {
  const regionIds = new Set(
    [...regionsByCountry.values()].flat().map((region) => region.id),
  );
  const namesById = new Map<string, { name: string; preferred: boolean }[]>();
  const lines = createInterface({
    input: createReadStream(join(geonamesDir, 'alternateNamesV2.txt')),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    // alternateNameId, geonameid, isolanguage, alternate name,
    // isPreferredName, isShortName, isColloquial, isHistoric, from, to
    const cols = line.split('\t');
    if (cols[2] !== 'es' || !regionIds.has(cols[1])) continue;
    if (cols[6] === '1' || cols[7] === '1') continue;
    const names = namesById.get(cols[1]) ?? [];
    names.push({ name: cols[3].trim(), preferred: cols[4] === '1' });
    namesById.set(cols[1], names);
  }

  const result = new Map<string, string>();
  for (const [id, names] of namesById) {
    const preferred = names.find((n) => n.preferred);
    const name = preferred
      ? preferred.name.replace(ADMIN_PREFIX, '')
      : names
          .map((n) => n.name.replace(ADMIN_PREFIX, ''))
          .sort((a, b) => a.length - b.length)[0];
    result.set(id, name);
  }
  return result;
}

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
    region: cols[10] || undefined,
  });
  candidatesByCountry.set(countryCode, candidates);
}

async function main() {
  const spanishRegionNames = await loadSpanishRegionNames();

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
        .map(({ name, latitude, longitude, region }) => ({
          name,
          latitude,
          longitude,
          region,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));

      const regions = (regionsByCountry.get(code) ?? [])
        .map(({ id, code: regionCode, name }) => ({
          code: regionCode,
          name:
            REGION_NAME_OVERRIDES[`${code}.${regionCode}`] ??
            spanishRegionNames.get(id) ??
            name,
        }))
        .sort((a, b) => a.code.localeCompare(b.code));
      // Some cities have no usable admin1 code in GeoNames ('00', e.g. Hong
      // Kong, Nouakchott). They take the region of the nearest city that
      // has one, so they stay reachable through the region picker; only in
      // countries with no regions at all (Singapore...) they keep none.
      const isKnownRegion = (code?: string) =>
        regions.some((r) => r.code === code);
      const withRegion = cities.filter((city) => isKnownRegion(city.region));
      for (const city of cities) {
        if (isKnownRegion(city.region)) continue;
        const nearest = withRegion
          .map((other) => ({ other, km: distanceKm(city, other) }))
          .sort((a, b) => a.km - b.km)[0];
        city.region = nearest?.other.region;
      }

      const usedNames = regions
        .filter((r) => cities.some((city) => city.region === r.code))
        .map((r) => r.name);
      const repeated = usedNames.filter((n, i) => usedNames.indexOf(n) !== i);
      if (repeated.length > 0) {
        throw new Error(
          `Repeated region names in ${code}: ${repeated.join(', ')} — add them to REGION_NAME_OVERRIDES`,
        );
      }

      return {
        name: spanishNames.of(code) ?? code,
        code,
        regions,
        cities,
      };
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
  const regionCount = countries.reduce((sum, c) => sum + c.regions.length, 0);
  console.log(
    `Wrote ${countries.length} countries, ${regionCount} regions and ${cityCount} cities`,
  );
}

void main();
