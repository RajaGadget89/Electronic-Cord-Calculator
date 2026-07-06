# ขั้นตอนออกเวอร์ชัน (Release Workflow) — 9SPYRE Wire

> **กฎ:** ทุกครั้งที่แก้ไขแอป (ฟีเจอร์ใหม่ / แก้บั๊ก / แก้ข้อความ) ต้อง **bump เวอร์ชัน + บันทึกลง changelog + อัปเดตคู่มือ** ก่อน commit เสมอ
> เลขเวอร์ชันต้องตรงกัน 3 ที่: `version.ts` (หน้าเว็บ), `manual-src.html` (คู่มือ), และตารางประวัติในคู่มือ

## 1. Bump เวอร์ชัน (หน้าเว็บ)
แก้ `app/src/version.ts`:
- อัปเดต `APP_VERSION` ตาม semver
  - **MAJOR** (x.0.0) = ผลการคำนวณเปลี่ยน / breaking
  - **MINOR** (0.x.0) = ฟีเจอร์ใหม่
  - **PATCH** (0.0.x) = แก้เล็ก/ข้อความ
- เพิ่ม entry ใหม่ไว้ **บนสุด** ของ `CHANGELOG` → `{ version, date: "YYYY-MM-DD", changes: [...] }`

## 2. อัปเดตคู่มือ (Log + เวอร์ชันในคู่มือ)
แก้ `app/manual-src.html`:
- เปลี่ยนเลขเวอร์ชัน **2 จุด**: `@bottom-center` (ท้ายทุกหน้า) และ `.badge` (หน้าปก)
- เพิ่ม **แถวใหม่บนสุด** ของตาราง "ประวัติเวอร์ชัน" ให้ตรงกับ CHANGELOG

สร้าง PDF ใหม่:
```bash
cd app && ./scripts/build-manual.sh
# หรือ: weasyprint manual-src.html public/manual.pdf   (ต้องมี weasyprint + ฟอนต์ Sarabun)
```

## 3. ถ้าแตะ engine (การคำนวณ) — สำคัญด้านความปลอดภัย
- แก้ทั้ง `app-core/src/**` และ **สำเนา** `app/src/engine/**` ให้ตรงกัน
- รัน:
  ```bash
  cd app-core && npm test                 # ต้องผ่านทุกข้อ
  node --import tsx audit.ts               # ต้องได้ "พบความต่าง 0 รายการ"
  ```
- **ทุกค่าตารางต้องเทียบกับหนังสือ EIT 2564 (วสท.) ห้ามเดา**

## 4. Build + commit
```bash
cd app && npm run build                    # ต้อง build ผ่าน
git add -A && git commit -m "vX.Y.Z: ..."  # แล้ว push เพื่อ deploy (Vercel auto)
```

## หลักความปลอดภัยที่ต้องคงไว้เสมอ
- ค่าการคำนวณต้องตรงมาตรฐาน วสท. (แอปนี้เกี่ยวกับชีวิต/ทรัพย์สิน)
- คงหมายเหตุ **"ควรให้วิศวกรไฟฟ้าที่มีใบอนุญาตทวนก่อนใช้งาน"** ไว้ในหน้าผลลัพธ์และรายงานทุกรูปแบบ
- ค่าเลือกแบบ conservative (ฝั่งปลอดภัย) เมื่อมาตรฐานมีหลายทางเลือก
