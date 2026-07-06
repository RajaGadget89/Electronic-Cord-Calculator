# 9SPYRE Wire — แอปคำนวณขนาดสายไฟและเบรกเกอร์ (มาตรฐาน วสท.)

แอป PWA คำนวณขนาดสายไฟและเบรกเกอร์ที่เหมาะสม ตาม **มาตรฐานการติดตั้งทางไฟฟ้าสำหรับประเทศไทย พ.ศ. 2564 (วสท.)**
รองรับสาย THW, VAF, VCT, NYY · ระบบ 1 เฟส/3 เฟส · ตรวจแรงดันตก · เลือกเบรกเกอร์ · บันทึกงาน offline · ออกรายงาน

สร้างโดย **Pisut Khungkamano**

---

## โครงสร้างโปรเจกต์ (monorepo)

| โฟลเดอร์ | คำอธิบาย |
|---|---|
| **`app/`** | แอป PWA (React + Vite + TypeScript + Tailwind) — **โฟลเดอร์ที่ใช้ deploy** |
| **`app-core/`** | แกนคำนวณ (calculation engine) + unit tests (ผ่าน 39/39) + `audit.ts` (ชุดตรวจอิสระเทียบหนังสือ EIT 2564) |
| `PRD_electrical-wire-calculator.md` | เอกสารความต้องการ (PRD) |
| `ARCHITECTURE_phase2.md` | เอกสารสถาปัตยกรรม |
| `REFERENCE_wst-electrical-data.md` | ข้อมูลอ้างอิงตาราง วสท. (พร้อมแหล่งที่มา) |

## รันแอป (dev)
```bash
cd app
npm install
npm run dev          # http://localhost:5173
```

## รันเทสต์ของ engine
```bash
cd app-core
npm install
npm test                        # 39/39 pass
node --import tsx audit.ts      # ชุดตรวจอิสระ ~545,000 รายการ เทียบตารางหนังสือ EIT 2564
```

## Deploy ขึ้น Vercel
- **Root Directory: `app`** (สำคัญ — ตั้งใน Vercel เพราะ repo เป็น monorepo)
- Framework: Vite (auto-detect) · Build: `npm run build` · Output: `dist`

หรือใช้ CLI:
```bash
cd app
npm install && npm run build
npx vercel --prod
```

## หมายเหตุลิขสิทธิ์
ตัวเลขในตารางอ้างอิงคัดจากมาตรฐาน วสท. 2564 เพื่อใช้คำนวณ — ไฟล์หนังสือ/เอกสารต้นฉบับที่มีลิขสิทธิ์ **ไม่ได้** รวมอยู่ใน repo นี้ (ถูก .gitignore)
เครื่องมือนี้ช่วยประเมินเบื้องต้น ไม่ใช่เอกสารรับรองทางวิศวกรรม
