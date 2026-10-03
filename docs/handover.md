# คู่มือส่งมอบ — Thaimora

โปรเจกต์: `C:/Users/menum/Projects/thaimora`

แผน: [implementation plan](superpowers/plans/2026-10-03-thaimora-implementation-plan.md)

ตัวอย่างที่เปิดไว้: [http://127.0.0.1:4100/](http://127.0.0.1:4100/)

ตัวอย่างค้นหาอสังหาริมทรัพย์และหลังบ้านพร้อมตรวจบนเครื่อง ส่วนการเปิดระบบจริงยังต้องใช้ข้อมูลและบัญชีของผู้ว่าจ้าง ประกาศ preview ไม่ใช่ทรัพย์จริง ภาพชายฝั่ง/อาคารเป็นภาพประกอบพื้นที่ที่มีเครดิต

## ตรวจ flow ที่ส่งมอบ

1. เปิดหน้าแรก EN และ `/th/`; สลับภาษา, ค้นหา/filters, map/list, เลือก pin และ card ให้ตรงกัน; ใช้มือถือ 360px และ desktop
2. เปิดรายละเอียดทรัพย์, gallery, nearby distance, favorite และเปรียบเทียบไม่เกินสามรายการ; static coordinates เป็น approximate เสมอ
3. ใน preview ทดสอบ inquiry ได้ตามป้ายสถานะ แต่ไม่มีอีเมลจริง; live ต้องตรวจ Turnstile, idempotency และ outbox/delivery จริง
4. เปิด `/admin/`: CRUD, gallery order, source/ownership/rights, private pin และ public consent; import CSV/XLSX แบบ partial rows และ duplicate skip/update/error
5. Live admin: ตรวจ inquiry export, consented view/contact statistics ตามวัน Bangkok และ audit ที่มี actor; anonymous ต้องอ่าน protected evidence/private points ไม่ได้

## เงื่อนไขเฉพาะ Thaimora

ต้องมี **500 real licensed Phuket listings**; condo, house, villa, land, townhouse สำหรับ sale/rent ตามแผน การแสดงแผนที่ครอบคลุมไทยไม่ได้เพิ่ม commercial listings เข้ามาในสโคป

Private point เก็บในตารางแยก การแสดง exact ใน public API ต้องมี consent evidence จริง ถ้าเพิกถอน/ลบ private point ต้องถอน publication/projection ตามกฎ SQL; static snapshot ยัง coarsen แม้มี consent ห้ามใส่ private catalog ลง public folder

API public key: `NEXT_PUBLIC_API_URL` ต้องลงท้าย `/functions/v1/api`; `NEXT_PUBLIC_ARCGIS_API_KEY` จำกัด domain; `NEXT_PUBLIC_DATA_MODE=live`. Build private configuration: `THAIMORA_SNAPSHOT_PATH` และ `THAIMORA_LEGAL_PATH`.

Legal JSON ที่อนุมัติแล้ว:

```json
{
  "approved": true,
  "privacy": {"en": "<approved English text>", "th": "<approved Thai text>"},
  "terms": {"en": "<approved English text>", "th": "<approved Thai text>"}
}
```

ข้อความแต่ละช่องต้องยาวอย่างน้อย 100 ตัวอักษรและ client-approved จริง ข้อความ placeholder ข้างบนไม่ผ่าน gate Snapshot ต้อง `mode:"production"` และ public real properties อย่างน้อย 500

Resend, Turnstile, sender/recipient และ `EMAIL_WORKER_SECRET` อยู่ฝั่ง server; deploy email worker แยกและตั้ง scheduler ที่ client อนุมัติ ไม่มีการส่ง worker secret ไป browser คำตอบ inquiry saved/pending ไม่เท่ากับ delivered

## วิธีเปิดและตรวจบนเครื่อง

ใช้ Node.js 24 ขึ้นไป และติดตั้งตาม lockfile:

```powershell
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3100
```

หน้า `/admin/` และ `/th/admin/` ใน preview ใช้ข้อมูลจำลองบนเครื่อง ไม่ได้แก้ฐานข้อมูลจริง ต้องเปิด live mode และเข้าบัญชีผู้ดูแลที่ได้รับสิทธิ์จึงใช้ hosted API ได้ ภาษาเริ่มต้นเป็นอังกฤษและจำภาษาที่เลือกไว้

การทดสอบซ้ำและผลที่รันจริงดู [verification](verification.md) ส่วน API, migrations, secrets, source jobs และ recovery ดู [backend runbook](backend.md)

## บัญชีและข้อมูลที่ต้องส่งมอบก่อนเปิดระบบจริง

ผู้ว่าจ้างเป็นเจ้าของ domain, Cloudflare Pages, Supabase, repository และบัญชี API ทั้งหมด ใช้สอง Supabase projects แยกกันตามโปรเจกต์ ตรวจ free entitlement และยอดใช้รวมจริงของบัญชีก่อนเปิด workflow ไม่มีการเพิ่มบัตร อัปเกรดอัตโนมัติ หรือสมัครบริการเสียเงินในรอบนี้

ส่ง key ผ่าน secret store หรือช่องทางส่วนตัวที่ตกลงกัน ห้ามใส่ในไฟล์ plan, public snapshot, repository, URL ที่มา หรือภาพหลักฐาน ใช้ [.env.example](../.env.example) เป็นรายการช่องที่ต้องตั้ง ไม่ใช้ค่าจำลองเป็นหลักฐานเปิดระบบ

| สิ่งที่ต้องเตรียม | วิธีตรวจรับ |
| --- | --- |
| Domain และบัญชี client-owned | ยืนยันผู้ถือสิทธิ์, origin, DNS และสิทธิ์ผู้ดูแล; จำกัด public map key ตาม hostname |
| Supabase | Auth user จริงและ `admin_memberships`; public/unauthenticated ห้ามอ่านข้อมูลส่วนตัวหรือ evidence; ไม่มีรหัส admin เริ่มต้น |
| Cloudflare/GitHub | repository ส่วนตัวสำหรับ workflow backup; ตรวจ account projects/repositories ทั้งหมดและงบใช้งานจริง |
| เนื้อหาและภาพ | source URL, license, rights evidence, EN/TH, พิกัดที่อนุญาต, รูป sanitized ไม่มี EXIF ตำแหน่ง |
| Legal | EN/TH privacy/terms ที่ client ตรวจและอนุมัติ; ไม่ใช้ข้อความ preview เป็นข้อสรุปทางกฎหมาย |
| Recovery | AGE public recipient/private recovery key ของ client, target ทดสอบที่แยกจาก live, วิธีสำรองไฟล์ Storage |
| UAT | ผู้ตรวจรับจริงและบันทึกผลการเชื่อมต่อบริการ/อุปกรณ์/performance ตามแผน |

## ลำดับติดตั้ง live

1. เก็บ private catalog/legal files ไว้นอก public folder และใน path ที่ ignored; ตรวจที่มาและสิทธิ์ก่อนนำเข้า
2. อ่าน migrations ทั้งชุด แล้ว link Supabase project และ apply ด้วย `supabase db push` ตาม runbook; bootstrap admin ด้วย client-controlled SQL console หลัง user เข้าระบบ Auth แล้ว
3. ตั้ง private Edge secrets และ exact `ALLOWED_ORIGINS`; deploy API ของแต่ละโปรเจกต์แยกกัน ไม่มี service-role key ใน browser
4. นำเข้าข้อมูลที่มีสิทธิ์เป็น draft ตรวจและอนุมัติ gallery/content/publication ผ่านผู้ดูแล; ทดสอบว่า failed save ไม่เปลี่ยน published data
5. Export public snapshot ด้วย `EXPORT_MODE=production`; ตั้ง snapshot/legal paths และ site-specific live mode ตามรายละเอียดด้านล่าง
6. ทดสอบ hosted API และ flow จริง รวมการไม่มีสิทธิ์/source outage/แก้ข้อมูล/ถอนสิทธิ์รูป โดยไม่อ้างผล mock ว่าเป็น live
7. คัดลอก `scripts/launch-evidence.example.json` เป็น ignored `scripts/launch-evidence.json` แล้วกรอกเฉพาะผลที่วัดหรืออนุมัติจริง ค่า false/0 ใน template ไม่ใช่การผ่านตรวจ
8. รัน `npm run build:production`; preflight/postflight ต้องผ่านทั้งคู่ ตรวจ `out/` ว่าไม่มี fixtures, private data หรือ secrets และจำนวนไฟล์อยู่ในขีดจำกัด
9. ทดสอบ restore รอบใหม่จากฐานข้อมูลเวอร์ชันสุดท้ายและแผน Storage; ตรวจ DNS/SEO/ภาษา/affiliate disclosure ที่ domain จริง แล้วให้ผู้ตรวจรับบันทึก UAT
10. เปิดเฉพาะ workflow ที่ผ่าน budget/rights checks แล้ว; งาน source automation เริ่มเมื่อ `AUTOMATION_ENABLED=true` เท่านั้น ติดตาม quota จริงและหยุดเมื่อถึง guard

รายการนี้เป็นคู่มือติดตั้ง ยังไม่มีการ deploy, push, เปลี่ยน DNS หรือเปิด scheduled job ในรอบส่งมอบนี้

## การใช้งานและบำรุงรักษา

- รายวัน: ตรวจ source sync และสิทธิ์ข้อมูล, failed API/email ตามโปรเจกต์, quota จริง, อายุข้อมูลและวันหมดอายุ, encrypted backup และขนาดไฟล์
- เมื่อแก้ catalog/content: ตรวจ EN/TH, source/license และ ordered gallery; publish หลังตรวจสิทธิ์ แล้วรอ export/rebuild จากข้อมูลที่เปลี่ยน เป้าหมาย 30 นาทีเป็น target ที่ยังไม่ได้วัด
- เมื่อ source ล่ม: คง catalog ที่อนุมัติไว้; ไม่สร้าง future event, ไม่แทน live offer ด้วยราคาเก่า; แสดง unavailable พร้อม retry ตาม flow
- รายสัปดาห์: ตรวจ daily backup ว่ามีจริงและ retention 7 วัน; เก็บเฉพาะ encrypted artifacts <=30 MiB/โปรเจกต์/วัน และตรวจยอดใช้รวม
- หลัง migration/ก่อนเปลี่ยนระบบ: restore ลง target disposable ที่แยกจาก live ตรวจ public/private permissions, Auth ownership และแยกกู้ Storage objects; ไม่ทดสอบ reset schema กับ live
- หาก production release มีปัญหา: rollback Pages ไป deployment ก่อนหน้าที่ตรวจรับ และปิด workflow ที่สร้างข้อมูลผิด เก็บ evidence แล้วแก้ข้อมูลตามสิทธิ์; การย้อน database ใช้ backup ที่ตรวจ restore แล้วตาม runbook

## แผนอบรมไม่เกิน 2 ชั่วโมง

ยังไม่ได้จัดอบรมจริง กำหนด session ส่งมอบ 120 นาทีดังนี้:

| เวลา | งานที่ผู้ดูแลทำเอง |
| --- | --- |
| 20 นาที | เข้า Auth, แยก preview/live, เปลี่ยน EN/TH, ตรวจสิทธิ์บัญชีและ secrets |
| 40 นาที | เพิ่ม/แก้ catalog, source/rights, พิกัดและ gallery, draft/publish/withdraw |
| 35 นาที | ทดสอบ flow หลัก, อ่าน stats แบบ Bangkok/export, ตรวจ audit และ failure states |
| 25 นาที | ตรวจ workflow/quota, ดาวน์โหลด encrypted backup, ทำ restore drill และทบทวน UAT |

ใช้ข้อมูล synthetic สำหรับฝึกก่อนทดสอบ catalog จริง บันทึกคำถามและผลฝึกไว้กับคู่มือ โดยไม่ถ่าย secrets หรือ private locations ลง evidence

## สิ่งที่ส่งมอบใน repository

Source และ lockfile, migrations/SQL checks, Edge functions, Pages function ถ้ามี, tests/configuration, workflows, env template, implementation plan, [DESIGN](../DESIGN.md) และ design JSON, source/image provenance, [verification](verification.md), review records และ runbook อยู่ในโปรเจกต์นี้ Generated `out/`, dependencies, secret files และ backup artifacts ถูก ignore; สร้างใหม่ด้วย build commands ไม่ใช่ source ที่ต้องแก้ด้วยมือ
