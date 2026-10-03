import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// One bounded manual import. Never call public Overpass from visitor requests.
// Keep this OSM-derived dataset independently available under ODbL 1.0.
const site = 'thaimora';
const region = 'phuket';
const bbox = [7.7, 98.2, 8.2, 98.5];
const query = `[out:json][timeout:25][maxsize:16777216];(node["name"]["amenity"~"^(restaurant|cafe|bar|pub|pharmacy|clinic|fuel|atm)$"](${bbox.join(',')});node["name"]["tourism"~"^(attraction|viewpoint)$"](${bbox.join(',')});node["name"]["natural"="beach"](${bbox.join(',')});node["name"]["sport"="scuba_diving"](${bbox.join(',')}););out meta;`;
const endpoint = 'https://overpass-api.de/api/interpreter';
const fetchedAt = new Date().toISOString();
const response = await fetch(endpoint, {
  method: 'POST', body: new URLSearchParams({data: query}),
  signal: AbortSignal.timeout(40000),
  headers: {'User-Agent':`${site}-development/1.0 (single bounded licensed POI snapshot)`},
});
if (!response.ok) throw new Error(`Overpass unavailable (${response.status}); no data was published`);
const text = await response.text();
if (Buffer.byteLength(text) > 2_000_000) throw new Error('POI snapshot exceeds 2MB bound');
const result = JSON.parse(text);
if (result.remark) throw new Error(`Overpass incomplete response: ${result.remark}`);
if (!Array.isArray(result.elements)) throw new Error('Invalid Overpass schema');
const plain = value => String(value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 200);
const approvedTags = ['name','name:en','name:th','amenity','tourism','natural','sport'];
const raw = result.elements.filter(row => row.type === 'node' && Number.isFinite(row.lat) && Number.isFinite(row.lon)
  && row.lat >= bbox[0] && row.lat <= bbox[2] && row.lon >= bbox[1] && row.lon <= bbox[3] && plain(row.tags?.name))
  .map(row => ({id:row.id,lat:row.lat,lon:row.lon,timestamp:row.timestamp,version:row.version,
    tags:Object.fromEntries(Object.entries(row.tags ?? {}).filter(([key]) => approvedTags.includes(key)))}));
const records = raw.map(row => {
  const category = row.tags.sport === 'scuba_diving' ? 'diving' : row.tags.natural === 'beach' ? 'beach'
    : row.tags.tourism === 'viewpoint' ? 'viewpoint' : row.tags.tourism === 'attraction' ? 'attraction' : row.tags.amenity;
  return {id:`osm:node:${row.id}`,name:{en:plain(row.tags['name:en'] ?? row.tags.name),th:plain(row.tags['name:th'] ?? row.tags.name)},
    description:{en:'Place information from OpenStreetMap.',th:'ข้อมูลสถานที่จาก OpenStreetMap'},category,
    location:{lat:row.lat,lng:row.lon},zone_id:null,source:'osm',source_url:`https://www.openstreetmap.org/node/${row.id}`,
    license:'ODbL 1.0; © OpenStreetMap contributors',rights_status:'approved',published:true,demo:false,admin_override:false,
    fetched_at:fetchedAt,source_updated_at:row.timestamp ?? null};
});
const folder = join(dirname(fileURLToPath(import.meta.url)), 'imports');
await mkdir(folder, {recursive:true});
await writeFile(join(folder, `osm-${region}-pois.json`), JSON.stringify({source:endpoint,fetchedAt,bbox,
  attribution:'© OpenStreetMap contributors',license:'ODbL 1.0',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',
  copyrightUrl:'https://www.openstreetmap.org/copyright',osmBaseTimestamp:result.osm3s?.timestamp_osm_base,
  query,records}, null, 2) + '\n');
await writeFile(join(folder, `osm-${region}-source.json`), JSON.stringify({fetchedAt,license:'ODbL 1.0',
  licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',attribution:'© OpenStreetMap contributors',elements:raw},null,2) + '\n');
console.log(JSON.stringify({fetchedAt,realSourceRecords:records.length,categories:[...new Set(records.map(r=>r.category))],
  note:'Source-backed OSM places, not a field survey. Missing translated names retain original source names. Zone assignments and physical accuracy still need UAT.'}));
