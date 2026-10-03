import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const project = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(project, 'docs/imports/osm-phuket-pois.json');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
if (source.license !== 'ODbL 1.0' || !Array.isArray(source.records)) throw new Error('Invalid licensed source');
const groups = new Map();
for (const row of source.records) {
  if (row.demo || row.source !== 'osm' || !/^https:\/\/www\.openstreetmap\.org\/node\/\d+$/.test(row.source_url)) throw new Error('Invalid source-backed POI');
  const key = `${row.category}:${Math.floor(row.location.lat / .05)}:${Math.floor(row.location.lng / .05)}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}
const selected = [];
for (let round = 0; selected.length < 96; round++) {
  let added = 0;
  for (const rows of groups.values()) {
    if (rows[round] && selected.length < 96) { selected.push(rows[round]); added++; }
  }
  if (!added) break;
}
const items = selected.map(row => ({id:row.id,name:row.name,category:row.category,lat:row.location.lat,lng:row.location.lng,
  sourceUrl:row.source_url,license:source.license,licenseUrl:source.licenseUrl,attribution:source.attribution}));
const target = join(project, 'public/data');
await mkdir(target, {recursive:true});
await writeFile(join(target, 'phuket-pois.json'), JSON.stringify(items, null, 2) + '\n');
await copyFile(sourcePath, join(target, 'osm-phuket-pois.json'));
console.log(JSON.stringify({previewSourcePOIs:items.length,fullSourceRecords:source.records.length,
  categories:[...new Set(items.map(row=>row.category))],note:'Bounding-region source data, not a field survey or official administrative boundary.'}));
