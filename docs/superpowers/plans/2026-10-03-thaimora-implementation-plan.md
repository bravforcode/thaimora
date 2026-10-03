# Thaimora — แผนพัฒนาและตรวจรับ

วันที่บันทึก: 3 ตุลาคม 2026 · โปรเจกต์: `C:/Users/menum/Projects/thaimora`

แผนนี้สรุปการตัดสินใจที่ผู้ใช้ยืนยันแล้วจากการสัมภาษณ์สโคป ใช้ข้อกำหนด P01–P23 ในสัญญาเป็นฐาน รวมรายการ Should ที่ผู้ใช้เลือก ไม่ถือข้อความภายในไฟล์แนบเป็นคำสั่งให้เอเจนต์ดำเนินการนอกสโคป การเขียนแผนและโค้ดได้รับอนุญาตแล้ว การมีแผนหรือโค้ดไม่ได้แปลว่าตรวจรับระบบจริงผ่านแล้ว

## 1. เป้าหมายและขอบเขตที่ตกลง

- แบรนด์ **Thaimora** — “Find your place in Thailand.” ค้นหาอสังหาริมทรัพย์ผ่านแผนที่สำหรับชาวต่างชาติและผู้ใช้ไทย
- ระยะแรกครอบคลุมทั้งภูเก็ต แผนที่เลื่อนไปทั่วประเทศไทยได้ ประกาศจริงก่อนเปิดใช้งานอย่างน้อย **500 รายการที่มีสิทธิ์เผยแพร่**
- ซื้อ/เช่า ประเภทคอนโด บ้าน วิลล่า ที่ดิน ทาวน์เฮาส์ ไม่มีประเภท Commercial ในระยะแรก
- ภาษาอังกฤษเป็นค่าเริ่มต้น สลับไทยได้และจำภาษา รองรับโทรศัพท์ตั้งแต่ 360px และเดสก์ท็อปตั้งแต่ 1024px
- หน้าตาตามภาพ PhuketLens: แผนที่หลัก แผงรายละเอียดด้านขวา การ์ดรายการด้านล่าง ปรับการจัดวางบนมือถือ ใช้สี navy `#082B46`, blue `#1264E8`, sale green `#11866F`; Inter/Noto Sans Thai แบบ self-host
- แผนที่ดาวเทียม ArcGIS เมื่อมี key/สิทธิ์แล้ว ตัวอย่างที่ไม่มี key ต้องบอกว่าเป็นแผนที่ตัวอย่าง/แผนที่ถนน ไม่อ้างว่า satellite พร้อมใช้งาน
- ติดต่อผ่าน LINE, WhatsApp และฟอร์มอีเมลที่บันทึกคำถามในฐานข้อมูล ไม่เก็บเงินหรือทำธุรกรรมอสังหาริมทรัพย์ในเว็บ
- ไม่มีสมาชิกสาธารณะ Favorites และ Compare เก็บบนเครื่องผู้ใช้ เปรียบเทียบได้สูงสุด 3 รายการ
- ให้คุณภาพมาก่อนวันส่ง ไม่มี deadline ที่ยืนยัน; 11 สัปดาห์ในเอกสารเป็นฐานจัดลำดับงาน ไม่ใช่คำรับรองเสร็จตามวัน
- สมมติเริ่มต้นไม่เกิน 100 ผู้เข้าชมต่อวัน ใช้บริการฟรี ไม่ใส่บัตร ไม่ auto-upgrade ไม่ auto-charge ค่าโดเมนที่เจ้าของงานยอมรับเป็นข้อยกเว้น

## 2. ขอบเขตข้อมูลและสิทธิ์

**ไม่ใช้การ scrape เว็บประกาศ โซเชียล หรือรูปของผู้อื่นโดยไม่มีสิทธิ์** การมี endpoint ให้เรียกได้ไม่ได้ให้สิทธิ์เผยแพร่ข้อมูลหรือภาพ ต้องมีผู้ให้ข้อมูล เงื่อนไขใช้งาน วันที่ตรวจ และขอบเขตพื้นที่/ฟิลด์/ภาพใน registry

ลำดับแหล่งข้อมูล: feed/API ที่เจ้าของงานมีสิทธิ์ → CSV/XLSX ที่เจ้าของงานเป็นผู้จัดหา → แอดมินสร้างเอง ไม่ใช้ demo เติมให้ครบ 500 ตัวอย่างพัฒนา 30 รายการและ synthetic 2,000 pins ใช้ทดสอบเท่านั้น

ภาพทุกรูปต้องมี source, license, author/credit และความสัมพันธ์กับทรัพย์ ภาพชายหาดที่ใช้ใน preview เป็นภาพพื้นที่ ไม่ใช่ภาพประกาศจริง ดู `docs/assets-provenance.json` ห้ามลบเครดิตจากหน้าที่แสดงภาพ

พิกัดจริงเป็นข้อมูลแยกจากข้อมูลสาธารณะ: เผยแพร่ exact ได้เมื่อมีความยินยอม/สิทธิ์ที่ตรวจสอบได้เท่านั้น รายการอื่นใช้จุดประมาณและวงรัศมี 300m โดยต้องอธิบายว่าตำแหน่งโดยประมาณ มิใช่วงรับรองเขตที่ดิน ปิด unit/parcel/ข้อมูลบ้านที่ทำให้ย้อนหาที่อยู่ส่วนตัวได้ตามนโยบายเจ้าของประกาศ

## 3. สถาปัตยกรรมที่เลือก

```text
Browser → Cloudflare Pages (Next.js static export, EN/TH SEO snapshots)
        → Supabase Edge API → Postgres/PostGIS + Storage
                           → Resend transactional outbox
                           → licensed feeds / POI / FX
Admin   → Supabase Auth JWT → API + RLS + audit trail
CI      → validation → sanitized snapshot → export → leak scan → deploy gate
Backup  → encrypted logical dump → private expiring artifact → restore drill
```

ไม่ทำ Next.js server routes บน static host การค้นหา แก้ไขประกาศ และคำถามอ่าน/เขียนผ่าน Edge API; SEO pages สร้างจาก snapshot ที่ผ่านการทำให้ปลอดภัย การปรับข้อมูล SEO ตั้งเป้า rebuild ภายใน 30 นาที แต่ข้อมูลค้นหา/API อ่านปัจจุบันได้ ต้องวัดระยะจริงหลังเชื่อม Cloudflare build hook

แยก preview กับ live: preview ใช้ข้อมูลสมมติชัดเจนและ `noindex`; live ต้องตั้ง API จริงและผ่าน gates ห้ามให้ production fallback ไป fixtures แบบเงียบ หาก API ล่มให้แสดง error/retry และข้อมูลที่อ่านได้ต้องไม่ทำให้เข้าใจว่าปัจจุบัน

โฟลเดอร์:

| โฟลเดอร์/ไฟล์ | หน้าที่ |
| --- | --- |
| `src/app` | routes ภาษา หน้าแผนที่ รายละเอียด Favorites Compare admin และ legal |
| `src/components` | ส่วนแสดงผล แผนที่ ฟิลเตอร์ gallery ฟอร์ม และ consent |
| `src/lib/property.ts` | DTO สาธารณะ enum และ validation |
| `src/lib/snapshot.ts` | รับ snapshot ที่อนุญาตใช้สร้าง static routes |
| `supabase/migrations` | schema, RLS, public projections, transactional RPC |
| `supabase/functions` | public API/admin API/sync/mail jobs |
| `scripts` | validate snapshot, launch gates, sync, backup/restore tooling |
| `tests` | unit, browser และ database/integration tests |
| `docs` | แผน backend runbook evidence และ handover |

## 4. โมเดลข้อมูลและกฎความปลอดภัย

PublicProperty มี `id`, `slug`, `title/description:{en,th}`, `transaction:sale|rent`, `type`, `priceTHB`, `areaM2`, `landAreaM2`, `beds`, `baths`, `floor`, `builtYear`, `ownership`, `furnishing`, `status:available|sold|rented`, `location:{lat,lng,accuracy,radiusMeters}`, `zone`, `province`, `images:[url,alt:{en,th},credit?,sourceUrl?]`, `amenities`, `updatedAt`, `expiresAt`.

ข้อมูลภายในเพิ่ม draft/published/hidden, exact geometry, permission evidence, source/license, agent contact, uploader, publication/expiry dates. อย่าใส่ private fields เข้า DTO ด้วย spread ของ DB row ใช้ allowlist projection

- `properties`/private location/permission อยู่หลัง RLS; visitor อ่านผ่าน safe view/RPC เท่านั้น
- static snapshots **ไม่บรรจุ exact coordinates ของทรัพย์** แม้ API มีสิทธิ์เปิด exact อยู่ในขณะนั้น เพื่อให้เพิกถอนสิทธิ์แล้วไม่ต้องไล่ลบ cached HTML; client อ่าน public position ปัจจุบันจาก API
- รูปที่อัปโหลดตรวจ MIME/ขนาดและล้าง EXIF; ไม่เชื่อ extension หรือ metadata ที่ส่งจาก browser
- `property_images` แยก order/alt/license; ลบรูปเก่าตามขั้นตอนตรวจการอ้างอิง ไม่ลบไฟล์ร่วมทันที
- `inquiries` และ `mail_outbox` สร้างใน transaction เดียว; visitor ไม่มี SELECT คำถามของผู้อื่น
- `admins` ผูก `auth.uid()`; service role ใช้เฉพาะ Edge/CI ที่จำเป็น ไม่ใส่ `NEXT_PUBLIC_*`
- `content_items`, `sources`, `sync_runs`, `analytics_events`, `audit_log` แยก provenance/สิทธิ์จาก copy
- ใส่ DB constraints สำหรับราคา/พื้นที่ไม่ติดลบ enum ขอบเขตพิกัด และสถานะ ไม่พึ่ง client validation อย่างเดียว

## 5. สัญญา API

Base: `NEXT_PUBLIC_API_URL` ลงท้าย `/functions/v1/api`; endpoint ขึ้นต้น `/v1`. JSON error มี code/message/requestId; ไม่ส่ง stack หรือ keys. CORS allow เฉพาะ origin ที่กำหนดและ localhost สำหรับ dev

| Endpoint | พฤติกรรม |
| --- | --- |
| `GET /v1/properties` | filters/bbox/cursor/locale; `{items,nextCursor}` จำกัด `limit` ที่ 1–50 รายการต่อหน้า |
| `GET /v1/properties/:id` | safe PublicProperty; client รองรับ raw DTO และ `{property}` wrapper เพื่อความเข้ากันได้ |
| `GET /v1/places/autocomplete?q=&locale=` | raw `{id,name,location}`; normalize เป็น `{id,label,lat,lng}` สำหรับ UI; debounce และ cancel request เก่า |
| `GET /v1/properties/:id/nearby` | POI ที่ผ่านสิทธิ์ ระยะทางและหน่วย ไม่ใช้บ้านส่วนตัวเป็น POI |
| `GET /v1/content` | `{pois,events}` ตามพื้นที่/ช่วงวันที่/licensed published status |
| `GET /v1/fx` | วันที่และ rates; ใช้เพื่อประมาณเท่านั้น THB เป็นราคาอ้างอิง |
| `POST /v1/inquiries` | name/email/country/message/propertyId/Turnstile; `Idempotency-Key`; `{id,emailStatus}`; normalize สถานะเป็น `sent`/`pending_retry` สำหรับ UI |
| `/v1/admin/*` | CRUD/import/inquiries/stats ต้อง authenticated admin JWT ทุกครั้ง |

Query ต้อง validate ที่ server: enum, bbox WGS84, min≤max, dates/expiry, cursor, maximum result size. Abort request เดิมเมื่อ filter เปลี่ยน ป้องกัน response เก่าทับข้อมูลล่าสุด

## 6. ลำดับพัฒนา — ทำให้จบทีละชุด

แต่ละชุด: อ่าน contract → เพิ่ม failing test ที่ทดสอบพฤติกรรมสำคัญ → implement → type/unit/integration checks → spec review → quality review → แก้และทดสอบซ้ำ เก็บ output จริงไม่เขียนว่า “ผ่าน” จากการอ่านโค้ดอย่างเดียว

### ชุด A: โครงโปรเจกต์และขอบเขตข้อมูล

1. สร้าง repo/feature branch อิสระ ติดตั้ง Next/TypeScript/MapLibre/Zod/ไลบรารี icons และเครื่องมือทดสอบ จัด self-host fonts, env template, noindex preview
2. สร้าง DTO/validators และ 30 fictional listings ให้ครอบคลุมทุกประเภท ทุกสถานะ ราคา null/invalid rejected และสองภาษา
3. สร้าง schema/RLS/seed admin ทดสอบ visitor/admin/expired/hidden และ safe public projection ด้วยฐานข้อมูลจริง
4. สร้าง snapshot builder ที่รับ DB safe projection; scan `out/` รวม HTML/JS/RSC/JSON ว่าไม่มี private location/permission/contact internal
5. Test expected: invalid import เข้าฐานข้อมูลไม่ได้; visitor อ่าน draft/private/inquiry ไม่ได้; missing credentials ไม่เปลี่ยนเป็น live

### ชุด B: P01–P09 แผนที่และการค้นหา

| ID | การลงมือทำ | เกณฑ์ทดสอบ/ตรวจรับ |
| --- | --- | --- |
| P01 | map/detail/cards ใช้ selected ID ร่วมกัน; responsive grid → map/list + bottom sheet | 360/390/1024/1440px ไม่มี overflow; คีย์บอร์ดเข้ารายการได้โดยไม่ลาก map |
| P02 | GeoJSON clustering, ราคา pins และสี sale/rent พร้อม text; 2,000 synthetic pins performance fixture | cluster zoom ทำงาน; selection ไม่หาย; ไม่โหลด DOM pin 2,000 ชิ้นพร้อมกันโดยไม่จำเป็น |
| P03 | เลือก card/pin อัปเดต ID และ center/highlight โดยไม่ reload | card→pin และ pin→card ตรงรายการ; focus คืนเมื่อปิด panel |
| P04 | gallery/full fields/contact/favorite/share/full URL; มี fallback สำหรับ field ว่าง | image alt/credit, keyboard gallery, ราคาและหน่วยถูก; sold/rented ชัด |
| P05 | รายการเฉพาะ committed viewport + filters; sort relevance/price/newest/distance; sync hover/focus | bbox ขอบเขต/anti-meridian ตาม policy; ผลและจำนวนตรง API; tie-break stable |
| P06 | หลัง map move ขึ้น “Search this area”; commit viewport เมื่อกด; reset | ขยับ map ไม่ค้นหาเองจนกด; filter ไม่ทำ viewport stale |
| P07 | TH/EN autocomplete, debounce, loading/empty/error, list keyboard | คำไทย/อังกฤษเลือกพิกัดได้; stale response ถูกยกเลิก |
| P08 | วาด polygon/undo/clear พร้อม keyboard-friendly alternative; validate vertex count | จุดใน/นอก/บนขอบตามกฎเดียว server; self-intersection rejected; clear คืนผล |
| P09 | buy/rent/type/min-max price/area/beds/baths/furnishing/ownership/amenities/zone | reset คืน default; AND/OR ตาม group; URL/state คง filters; zero results อธิบายและ clear ได้ |

ดาวเทียมใช้ endpoint ที่อนุญาตและ key จำกัด referer/privileges ไม่ใช้ unauthenticated shortcut ของผู้ให้บริการ Attribution อยู่บนแผนที่อ่านได้ ใช้ Geoapify/OSM demo ตาม terms ไม่มีการถอดเครดิต

### ชุด C: P10–P16 การตัดสินใจและข้อมูลใกล้เคียง

| ID | การลงมือทำ | เกณฑ์ทดสอบ/ตรวจรับ |
| --- | --- | --- |
| P10 | localStorage favorites + compare≤3, versioned IDs, handle deleted listings | รายการที่ 4 มีคำอธิบาย; refresh คงค่า; corrupt storage ไม่ทำเว็บล่ม |
| P11 | full property URL ภาษา/slug, direct entry และ share canonical | เปิด URL ตรงหลัง static export ได้; invalid ID แสดง missing state; details≤3 clicks |
| P12 | validated inquiry, honeypot/Turnstile/rate limit/idempotent transaction/outbox | duplicate ไม่สร้างซ้ำ; provider mail fail เก็บ pending_retry; retry ส่งครั้งเดียว |
| P13 | Privacy/Terms/foreign ownership guidance ที่ลูกค้าหรือทนายตรวจ | ห้ามถือ placeholder legal ว่าผ่าน; footer เข้าถึงได้ทั้งภาษา |
| P14 | POI/event layers พร้อม nearest category km และข้อมูลวันที่/source | หา nearest ด้วย geometry; no result ไม่แต่ง POI; events expired ไม่เสนอว่า upcoming |
| P15 | approximate location label/circle; exact permission revocation through API | circle เป็น approximation; static leak scan ผ่าน; unauthorized client ไม่มี exact |
| P16 | sqm↔sqft และ FX วันที่ล่าสุดโดยประมาณ พร้อม THB ต้นฉบับ | 1m²≈10.7639104167ft²; round ที่ display; missing FX แสดง THB ไม่แต่ง rate |

Inquiry email ไม่ใช่หลักฐานว่าลูกค้าได้รับทันที: UI แยก sent/pending retry; email verified domain, recipient configuration และ delivered/provider receipt ต้องทดสอบจริงก่อน live

### ชุด D: P17–P23 การจัดการและเปิดใช้

| ID | การลงมือทำ | เกณฑ์ทดสอบ/ตรวจรับ |
| --- | --- | --- |
| P17 | admin create/edit/draft/publish/hide/delete/sold/rented, drag pin + coordinate inputs, bilingual, reorder photos | visitor/normal user denied; invalid rights/location blocked; unsaved state อธิบาย; audit event |
| P18 | CSV/XLSX template, preview dry-run, per-row errors, normalized enum/units, duplicate upsert policy | formula injection safe export; malformed rows ไม่กระทบ valid rows; error row number มีเหตุผล |
| P19 | inquiries และสรุป views/contact clicks ที่ได้รับ consent; stats คืน `{items}` รายวัน Asia/Bangkok; เลือกช่วงวันที่และ export | ไม่อ้าง unique visitors ถ้าไม่วัด; data deletion/expiry; visitor ไม่มีสิทธิ์เข้าถึง PII |
| P20 | updatedAt/expiry workflow, warnings/admin queue, exclude expired from active search | boundary timezone tested; client expiry ไม่ถูกแก้ย้อนหลังโดย importerเงียบ |
| P21 | locale routes และ storage preference; UI/data/date/number formats; no missing key | direct `/th/` และ `/en/` ถูก; reload จำภาษา; field fallback อธิบาย |
| P22 | readable URL/title/meta/canonical/hreflang/sitemap/appropriate real structured data | preview noindex; production no fixture pages; hreflang reciprocal; robots/sitemap actual domain |
| P23 | consent default denied; GA4 โหลดหลัง opt-in เท่านั้น; withdraw | request interception ยืนยันไม่มี GA pre-consent; reject ยังค้นหาได้; admin สถิติไม่ bypass consent |

## 7. การนำเข้าข้อมูลและงานอัตโนมัติ

CSV/XLSX header/template ต้องครอบคลุม external ID, TH/EN title/description, transaction/type/price/area/beds/baths, zone/province, exact coordinate permission, source/license URLs, photo URLs/credits, expiry. ขั้นตอน: parse → normalize → validate → dry-run report → confirm import → transaction/upsert → public snapshot enqueue. เก็บ source external ID เพื่อไม่เพิ่มซ้ำทุก sync

กำหนด permitted host/timeout/size ของภาพ/feed ที่ server ดึง ป้องกัน SSRF; ยอมรับ HTTPS เฉพาะ approved sources ไม่ใช้ arbitrary URL fetch ไป private IP

POI/events: source registry ทำสิทธิ์เป็น gate ก่อน publish; TAT metadata ระบุ “Open Data Common” โดยยังไม่ยืนยัน variant จึง quarantine จนตรวจ license ชัดเจน export มี SQL-looking key ให้ถือเป็น string ห้าม execute; วันที่ใน STARTDATE/ENDDATE เป็น Gregorian แม้ ACTIVITY_YEAR ใช้ Buddhist year; HTML content เป็น untrusted text

ข้อมูลที่เตรียมได้จริงระหว่างพัฒนา: OSM named POIs 1,868 รายการในกรอบพื้นที่รอบภูเก็ต พร้อม ODbL 1.0 และชุดตัวอย่างกระจายหมวด 96 รายการ ดู `docs/open-data.md`. การดึงนี้ไม่ใช่ field survey และไม่ทดแทนประกาศอสังหาริมทรัพย์ 500 รายการ ต้องคง attribution และเผยแพร่ชุด OSM อิสระตามเงื่อนไขใบอนุญาต

cron/API secret auth ทุก job, source-level dedupe, run log counts/error/last success; timeout/429 backoff มีเพดาน ไม่ยิง retry ไม่สิ้นสุด เปลี่ยน source schema ต้องหยุดและเก็บ error ไม่ publish broken records

## 8. ฟรี tier และการดำเนินงาน

| บริการ | ข้อจำกัด/การป้องกัน |
| --- | --- |
| Supabase Free | 2 active projects ร่วมบัญชี, DB500MB/Storage1GBต่อโปรเจกต์; เฝ้าขนาด/egress/function quota; inactivity pause เป็นข้อจำกัดจริง |
| Cloudflare Pages/Workers | 500 builds/เดือน, static filesตามแพ็กเกจ; Functions100k/dayร่วมบัญชี; throttled rebuild ไม่ build ทุก view |
| ArcGIS | Free allocation ตามบัญชี/terms; ไม่เปิด pay-as-you-go/ไม่ใส่บัตร; key domain restricted; ทดสอบเมื่อได้บัญชี |
| Geoapify | Free3,000credits/day/5rpsตาม terms; เครดิตมิใช่จำนวนrequestsทุกชนิด; budget sharedสองเว็บมี local cap |
| Resend | Free3,000/month100/day, current3verifieddomains; count recipients; rate/outbox budget |
| GitHub private artifacts | Free500MB/2,000minร่วมบัญชี; 7day encrypted backup≤30MB/site/day =≤420MBสองเว็บ ก่อน overhead; abort if budget exceeded |

ไม่มี managed daily DB backup บน Supabase Free: ใช้ encrypted logical dump + restore drill จริง ดู backend runbook ไม่ถือ storage photos อยู่ใน DB dump รูปต้นฉบับต้องมีที่เก็บ/สิทธิ์/สำเนาของเจ้าของข้อมูล

## 9. แผนทดสอบและหลักฐาน

1. Unit: filters/geometry/units/FX/expiry/local preferences/import validation and per-row errors/idempotency requests
2. DB integration บน Postgres/Supabase local: RLS roles/public projection/inquiry transaction/duplicate/retry/admin permissions; แยกจาก test ที่ตรวจ SQL text
3. Browser: core flows desktop/mobile/keyboard/gallery/admin forms/missing API/map failure/favorites/compare/locale/consent network interception
4. External UAT: ArcGIS imagery actual credentials, mail sent/delivered, owner CSV/photo rights, Supabase hosted auth/RLS, real domain builds/HTTPS and consent tags
5. Performance: measure LCP mobile4G target≤2.5s, representative listing/map dataset; record browser/version/device/throttle/date; external map loadingไม่หักออกเอง; 2,000pin test report ไม่อ้าง throughput ถ้าไม่ได้วัด
6. Accessibility: axe+manual keyboard/focus/contrast/44px/16px input; WCAG2.1AA core flows ไม่ใช้ axe pass แทนการรับรองทุกหน้า
7. Browser compatibility: latest2major Chrome/Edge/Firefox/Safari และ iOS/Androidจริงยังต้อง UAT ไม่ใช้ Chromium-only pass แทน
8. Visual: batch1440/390/360 screenshots หลัง build; spec/quality review; Impeccable detector+fresh finish review; fixหนึ่งbatchแล้วrecapture เมื่อจำเป็น; DESIGN จากงานที่ส่งจริง

คำสั่งใน `package.json` และ `docs/backend.md` เป็นคำสั่งจริงของ implementation; บันทึกผลใน `docs/verification.md` ด้วยวัน/exit status/test count/ข้อจำกัด ใช้ `npm ci`, typecheck, unit, build/export, browser tests และ database testตามสคริปต์ ไม่สร้าง “PASS” ขึ้นเอง

## 10. ก่อนเปิดใช้งานจริง — ทุกข้อเป็น gate

- [ ] 500 real listings ไม่ซ้ำ มี source/license/expiry และภาพถูกทรัพย์; demo/synthetic excluded
- [ ] เจ้าของให้สิทธิ์ตำแหน่ง exact หรือ safe approximate; exported leak scan และ revocation test ผ่าน
- [ ] ArcGIS/Geoapify/free terms/account quotas/domain restrictions พร้อมและทดสอบจริง
- [ ] Supabase live migrations/RLS/auth/storage policy ผ่าน; secrets server-only
- [ ] Inquiry DB+actual recipient email/LINE/WhatsApp ทำงาน; outbox retry/duplicate tests ผ่าน
- [ ] Legal/foreign ownership/privacy copy ผ่านผู้รับผิดชอบ; consent/noindex→live metadata ถูก
- [ ] Daily encrypted backupและ restore test มีหลักฐาน; quota estimatesถูกตรวจด้วยขนาดจริง
- [ ] UAT500รายการ, details≤3clicks, mobile4G LCP≤2.5s, accessibility และจริงสองmajorbrowsers/phones
- [ ] ไม่มี critical/major open issue; domain/HTTPS/monitor/owner handover พร้อม

## 11. การส่งมอบและแก้ไข

ส่ง repo/source/schema/env template/deploy guide/import template/source registry/ภาพเครดิต/คู่มือadmin/backup-restore/verification/known limitations ให้เจ้าของงาน บัญชีและโดเมนอยู่กับเจ้าของ ไม่ฝาก service role ในไฟล์เอกสาร อบรมตามสัญญาไม่เกิน2ชั่วโมง

UAT review7businessdays; critical/majorแก้5businessdays; re-review3businessdays; warranty30daysหลังรับมอบ ตามเอกสาร: criticalack1/fix3, importantack2/fix7, minorack5/nextbatch หน่วย/การนับวันยึดสัญญาที่ลงนาม ไม่กำหนดราคาเพิ่มเอง งวด40/30/30เป็นโครงในร่างไม่ใช่ยอดเงินที่ยืนยัน

รายการใหม่ต้องแจ้งผลกระทบ scope/cost/free tier และได้รับการตัดสินใจ เช่น nationwide inventory, public accounts, payment, booking หรือ commercial property ห้ามแทรกเพื่อทำเว็บดูใหญ่กว่า brief

## 12. แหล่งอ้างอิงที่ต้องตรวจใหม่ตอนเปิดใช้

- สัญญาและภาพอ้างอิงใน Downloads ของผู้ใช้
- ArcGIS: https://location.arcgis.com/help/billing/ · https://location.arcgis.com/help/deployment/
- Geoapify: https://www.geoapify.com/pricing/ และ terms/routing documentation
- TAT: https://datacatalog.tat.or.th/api/3/action/package_show?id=tourismactivity
- Frankfurter: https://frankfurter.dev/ (แสดง rate date และapproximate)
- Commons reuse: https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
- Supabase/Cloudflare/GitHub/Resend pricing และ terms ปัจจุบัน: quotasอาจเปลี่ยน ไม่ถือข้อมูลวันที่เขียนแผนเป็น guaranteeถาวร
