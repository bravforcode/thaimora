# Thaimora

เว็บค้นหาอสังหาริมทรัพย์ผ่านแผนที่ แยกโปรเจกต์จาก TaoTide ใช้ Next.js static export บน Vercel และ Supabase API

ตัวอย่างบนเครื่องใช้ประกาศสมมติและภาพประกอบพื้นที่ ไม่มีการส่งอีเมลจริงหรือเปิดใช้งานระบบ live โดยอัตโนมัติ ก่อนเปิดใช้งานจริงต้องมีสิทธิ์ข้อมูลและภาพ 500 รายการ บัญชีบริการ และผล UAT ตามแผน

## เปิดตัวอย่าง

ต้องมี Node.js 24 ขึ้นไป ไม่ต้องใช้ API key เพื่อดู preview

```powershell
Set-Location -LiteralPath 'C:/Users/menum/Projects/thaimora'
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3100
```

เปิด http://127.0.0.1:3100/ หน้าผู้ดูแลอยู่ `/admin/` ใน preview การแก้ไขเป็นข้อมูลบนเครื่อง มีป้ายบอกสถานะ ไม่ใช่ฐานข้อมูลจริง

## ตรวจงาน

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run test:backend
npm run build
npm run test:e2e
```

ตัวอย่าง static ที่เปิดไว้ในรอบส่งมอบ: http://127.0.0.1:4100/ (ใช้ไฟล์ `out/`; หากปิดเครื่องให้เปิดใหม่ตามคำสั่งด้านบน)

คำสั่ง API/ฐานข้อมูล/provider integration และ backup ดู `docs/backend.md`. ผลที่รันจริงและข้อจำกัดดู `docs/verification.md`; ไฟล์นี้ไม่รับรองว่า tests หรือบริการภายนอกผ่านแล้ว

## เอกสาร

- แผนละเอียด: `docs/superpowers/plans/2026-10-03-thaimora-implementation-plan.md`
- Backend/configuration/runbook: `docs/backend.md`
- คู่มือส่งมอบและรายการก่อนเปิดจริง: `docs/handover.md`
- ผลทดสอบที่รันจริงและ review: `docs/verification.md`
- ภาพและใบอนุญาต: `docs/assets-provenance.json` และหน้าภาพเครดิตในเว็บ
- Design ที่ส่งจริง: `DESIGN.md` และ `.impeccable/design.json`
- Environment template: `.env.example` — secret keys อยู่ server เท่านั้น อย่า commit `.env.local`
- Production configuration/build/deploy: `docs/deployment.md`; เริ่มด้วย `npm run production:check`
- Actual rollout status and remaining inputs: [production-status.md](docs/production-status.md)
- Executed local recovery evidence and hosted recovery procedure: [production-recovery.md](docs/production-recovery.md)

Live build ใช้ sanitized snapshot และ mode ที่กำหนดใน backend runbook; production gate ต้องทำงานหลัง export อย่า deploy preview เป็นระบบที่อ้างว่าพร้อมเปิดใช้จริง
