# ข้อมูลสถานที่จาก OpenStreetMap

ดึงข้อมูลจริงจาก Overpass หนึ่งคำขอแบบจำกัดเวลาเมื่อ 3 ตุลาคม 2026 ได้ 1,868 named nodes ในกรอบพื้นที่รอบภูเก็ต ไม่ใช่การสำรวจภาคสนามหรือเส้นเขตจังหวัดอย่างเป็นทางการ

แหล่งข้อมูลและหลักฐานอยู่ใน `docs/imports/osm-phuket-pois.json` และ `osm-phuket-source.json`. ตัดชื่อบัญชีผู้แก้ไข หมายเลขโทรศัพท์ อีเมล และ tags ที่ไม่ใช้ในการแสดงสถานที่ออก เก็บชื่อ แหล่งที่มา หมวด พิกัด และวันที่จากต้นทาง ชื่อที่ไม่มีคำแปลใช้ชื่อเดิมจากต้นทาง

ข้อมูลนี้มีใบอนุญาต **ODbL 1.0** ให้เครดิต **© OpenStreetMap contributors** และแยกข้อมูลที่ได้จาก OSM ออกจากฐานข้อมูลประกาศของเจ้าของงาน ไฟล์แจกจ่ายต้องคงประกาศใบอนุญาตและเงื่อนไข share-alike ที่เกี่ยวข้อง ใบอนุญาตฐานข้อมูลไม่ได้ให้สิทธิ์รูปถ่าย

- ข้อมูลชุดเต็มแจกจ่ายอิสระ: `public/data/osm-phuket-pois.json`
- ตัวอย่างหน้าเว็บ 96 รายการที่เลือกให้กระจายหมวดและพื้นที่: `public/data/phuket-pois.json`
- ทำชุดตัวอย่างซ้ำ: `node docs/build-preview-pois.mjs`
- ดึงชุดใหม่ด้วยมือ: `node docs/fetch-open-pois.mjs`
- นำเข้าฐานข้อมูล: ดู `scripts/import-pois.ts` และ `docs/backend.md`; ต้องยืนยัน license และใช้บัญชีของเจ้าของก่อน ไม่มีการนำเข้าฐานข้อมูล hosted ในการทำงานครั้งนี้

ไม่เรียก public Overpass จากผู้เข้าชมแต่ละคนหรือใช้เป็น backend ที่เว็บพึ่งพา การดึงครั้งนี้เป็นการเตรียม snapshot แบบจำกัดขอบเขต Public instance ไม่มี SLA

อ้างอิงที่อ่าน:

- https://www.openstreetmap.org/copyright
- https://opendatacommons.org/licenses/odbl/1-0/
- https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
