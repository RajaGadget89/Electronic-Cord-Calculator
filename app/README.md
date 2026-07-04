# 9SPYRE Wire — แอปคำนวณขนาดสายไฟและเบรกเกอร์ (มาตรฐาน วสท.)

PWA (Progressive Web App) ทำงาน offline · React + Vite + TypeScript + Tailwind
คำนวณตามมาตรฐานการติดตั้งทางไฟฟ้าสำหรับประเทศไทย พ.ศ. 2564 (วสท.)
สร้างโดย **Pisut Khungkamano**

## ✅ ผ่านการ build แล้ว
TypeScript type-check ผ่าน + Vite production build สำเร็จ + สร้าง Service Worker (PWA)

## วิธีรัน (บนเครื่องคุณ)

> หมายเหตุ: โฟลเดอร์ `node_modules` ที่ติดมาถูกล็อกโดย sandbox — ให้ลบทิ้งแล้วติดตั้งใหม่

```bash
cd app
rm -rf node_modules            # ลบของเดิมที่ค้าง
npm install                    # ติดตั้ง dependencies
npm run dev                    # เปิด dev server → http://localhost:5173
```

สร้างไฟล์สำหรับ deploy จริง:
```bash
npm run build                  # ผลลัพธ์อยู่ในโฟลเดอร์ dist/
npm run preview                # ลองเปิดตัว production build
```

## ติดตั้งลงมือถือ (Honor Magic 7 Pro / Android)
1. Deploy โฟลเดอร์ `dist/` ขึ้นเว็บ (เช่น Netlify, Vercel, GitHub Pages — ฟรี)
2. เปิดลิงก์ในเบราว์เซอร์บนมือถือ → เมนู → "เพิ่มลงในหน้าจอหลัก / Install app"
3. ใช้งานได้แบบ offline หลังเปิดครั้งแรก

## โครงสร้าง
```
app/
├── src/
│   ├── engine/          ← แกนคำนวณ (จาก Milestone 1, ผ่านเทสต์ 21/21)
│   │   ├── calc.ts
│   │   ├── types.ts
│   │   └── data/wireData.ts   ← ตาราง วสท. 2564 (ampacity, แรงดันตก, derate)
│   ├── components/
│   │   ├── Home.tsx     ← รายการงาน + สำรอง/กู้คืน
│   │   ├── JobForm.tsx  ← ฟอร์มกรอกงาน + จัดการชนิดโหลด
│   │   ├── ResultCard.tsx  ← ผลลัพธ์ + รายงาน/แชร์
│   │   └── Footer.tsx
│   ├── db.ts            ← IndexedDB (Dexie) เก็บงาน+ชนิดโหลด+สำรองข้อมูล
│   ├── report.ts        ← รายงาน Markdown / พิมพ์ PDF / Web Share
│   └── App.tsx
└── public/             ← โลโก้ + PWA icons
```

## ฟีเจอร์
- กรอกงาน: ชื่อ, ระบบไฟ (1φ/3φ), ชนิดสาย (THW/VAF/VCT/NYY), วิธีติดตั้ง, ความยาว, อุณหภูมิ, จำนวนกลุ่มวงจร
- โหลดหลายรายการ + dropdown ชนิดโหลด (มี pf) + เพิ่มชนิดเอง
- คำนวณ: ขนาดสาย, พิกัดหลัง derate, แรงดันตก (เลื่อนขนาดอัตโนมัติถ้าเกิน 3%), เบรกเกอร์
- สถานะ PASS/WARN/FAIL + คำเตือน (รวมกรณีโหลดสูงให้ปรึกษาช่าง)
- บันทึกงาน / ดูย้อนหลัง / แก้ไข / คำนวณใหม่ (offline, IndexedDB)
- รายงาน: Markdown, พิมพ์เป็น PDF, แชร์ (Web Share)
- สำรอง/กู้คืนข้อมูลเป็นไฟล์ JSON
- ธีม 9SPYRE + footer เครดิตผู้สร้างทุกหน้า
