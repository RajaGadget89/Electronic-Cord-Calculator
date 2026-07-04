# เอกสารสถาปัตยกรรม (เฟส 2) — แอปคำนวณขนาดสายไฟและเบรกเกอร์

> ต่อยอดจาก `PRD_electrical-wire-calculator.md`
> จุดประสงค์: กำหนดสถาปัตยกรรมและแผนพัฒนา **ก่อนลงมือเขียนโค้ด**
> ผู้สร้างโครงการ: Pisut Khungkamano

---

## 1. สรุปการตัดสินใจด้านสถาปัตยกรรม (Architecture Decisions)

| หัวข้อ | ตัวเลือกที่เลือก | เหตุผล |
|---|---|---|
| รูปแบบแอป | **PWA** (Progressive Web App) | ติดตั้งลงหน้าจอ Android ได้ ทำงาน offline ไม่ต้องผ่าน Play Store ไฟล์เล็ก |
| Frontend | **React + Vite + TypeScript** | เบา สร้าง PWA ง่าย TypeScript ช่วยลด bug ในสูตรคำนวณ |
| UI Styling | **Tailwind CSS** (โทน dark/electrical) | ทำ UI ทันสมัยเร็ว ขนาด CSS เล็ก |
| เก็บข้อมูล | **IndexedDB** (ผ่าน library `Dexie.js`) | เก็บงานจำนวนมากในเครื่อง, query ง่าย, offline 100% |
| Offline | **Service Worker** (`vite-plugin-pwa`) | แคชแอปให้เปิดได้แม้ไม่มีเน็ต |
| สร้าง PDF | **`jsPDF` + ฟอนต์ Sarabun (embed)** | สร้าง PDF ฝั่ง client รองรับภาษาไทย ไม่ต้องมี server |
| สร้าง Markdown | สร้าง string เอง | ง่าย เบา |
| แชร์ไฟล์ | **Web Share API** | แชร์ PDF/MD ไปแอปอื่นบนมือถือได้ตรง ๆ |

**หลักการ:** ไม่มี backend, ไม่มี cloud, ไม่มี login — ทุกอย่างรันในเบราว์เซอร์บนเครื่องผู้ใช้

---

## 2. โครงสร้างข้อมูล (Data Model)

### 2.1 Job (งานที่บันทึก)
```
Job {
  id: string (uuid)
  name: string              // ชื่องาน
  createdAt: number
  updatedAt: number
  system: "1P" | "3P"       // ระบบไฟ
  voltage: number           // 230 หรือ 400
  cableType: "THW"|"VCT"|"VAF"|"NYY"
  installMethod: string     // วิธีติดตั้ง (ผูก default ตาม cableType)
  lengthM: number           // ความยาวสาย (เมตร)
  ambientTempC: number      // default 40
  groupingCircuits: number  // จำนวนวงจรรวมกลุ่ม default 1
  loads: Load[]             // รายการโหลดในวงจร
  result: CalcResult | null // ผลลัพธ์ล่าสุด (cache)
}

Load {
  loadTypeId: string        // อ้างถึง LoadType
  label: string
  valueType: "W" | "A"      // กรอกเป็นวัตต์หรือแอมป์
  value: number
  quantity: number          // จำนวนโหลดชนิดนี้
}

LoadType {                  // ชนิดโหลด (มี preset + ผู้ใช้เพิ่มเอง)
  id: string
  name: string              // เช่น "ปั๊มน้ำ/มอเตอร์"
  pf: number                // เช่น 0.8
  isCustom: boolean
}

CalcResult {
  totalCurrentA: number
  recommendedCableSize: number   // sq.mm.
  cableAmpacityA: number         // หลัง derate
  voltageDropPercent: number
  recommendedBreakerA: number
  status: "PASS" | "WARN" | "FAIL"
  warnings: string[]
}
```

### 2.2 ตารางอ้างอิง (ฝังในแอปเป็นไฟล์ข้อมูล) — **ต้องตรวจสอบกับ วสท. จริง**
- `ampacityTable` — ampacity ต่อ (ชนิดสาย × วิธีติดตั้ง × ขนาด sq.mm.)
- `cableResistanceTable` — R (Ω/km) หรือ mV/A/m ต่อขนาดสาย
- `tempDeratingTable` — ตัวคูณตามอุณหภูมิแวดล้อม
- `groupingDeratingTable` — ตัวคูณตามจำนวนวงจรรวมกลุ่ม
- `breakerRatings` — [6,10,16,20,25,32,40,50,63,80,100...]

---

## 3. Flow การคำนวณ (Calculation Engine)

```
1. แปลงแต่ละโหลด → กระแส (I = P/(V·pf) หรือ P/(√3·V·pf)); ถ้ากรอก A ใช้ตรง ๆ
2. รวมกระแส × quantity → totalCurrentA
3. ดึง ampacity ฐานตาม (cableType, installMethod, size)
4. ampacity หลัง derate = base × k(temp) × k(grouping)
5. ไล่ขนาดสายจากเล็ก→ใหญ่ หาตัวแรกที่ ampacity(derated) ≥ totalCurrentA
6. คำนวณ %แรงดันตกของขนาดนั้น → ถ้า > 3% เลื่อนขึ้นขนาดถัดไป
7. เลือกเบรกเกอร์: In ≥ totalCurrentA และ In ≤ ampacity(derated)
8. สรุป status + warnings
```

**Engine แยกเป็น pure function** (ไม่ผูก UI) เพื่อเขียน **unit test** ครอบทุกสูตรและ edge case ได้

---

## 4. โครงสร้างหน้าจอ (Screens)

1. **หน้าหลัก** — รายการงานที่บันทึก (ค้นหา/เรียง), ปุ่ม "สร้างงานใหม่", ปุ่ม Export/Import สำรอง
2. **ฟอร์มกรอกงาน** — ชื่องาน → ระบบไฟ → ชนิดสาย/วิธีติดตั้ง → ความยาว → เพิ่มโหลด (dropdown ชนิดโหลด + เพิ่มเอง) → derate
3. **หน้าผลลัพธ์** — การ์ดสถานะ PASS/WARN/FAIL เด่นชัด, ขนาดสาย, ampacity, %แรงดันตก, เบรกเกอร์, ปุ่มออกรายงาน/แชร์
4. **จัดการชนิดโหลด** — เพิ่ม/แก้ pf ของชนิดที่ผู้ใช้สร้าง
5. ทุกหน้า: **footer "สร้างโดย Pisut Khungkamano"**

---

## 5. แผนพัฒนา (Roadmap แบบเป็นขั้น)

**Milestone 1 — แกนคำนวณ (ไม่มี UI)**
- รวบรวม + ตรวจสอบตาราง วสท. → ใส่เป็น data file
- เขียน calculation engine (pure functions) + unit tests

**Milestone 2 — โครง PWA + ฟอร์ม**
- ตั้งโปรเจกต์ Vite+React+TS+Tailwind+PWA
- ฟอร์มกรอกงาน + validation + หน้าผลลัพธ์

**Milestone 3 — จัดเก็บข้อมูล**
- IndexedDB (Dexie): บันทึก/ดูย้อนหลัง/แก้ไข
- ชนิดโหลด preset + custom

**Milestone 4 — รายงาน & แชร์**
- Export PDF (Sarabun) + Markdown, พิมพ์, Web Share
- Export/Import ไฟล์สำรอง

**Milestone 5 — เก็บงาน**
- ทดสอบบน Honor Magic 7 Pro, ปรับ UI, ทดสอบ offline, ทำ icon/ติดตั้งลงหน้าจอ

---

## 6. ความเสี่ยง & จุดต้องระวัง

| ความเสี่ยง | การรับมือ |
|---|---|
| **ค่าตาราง วสท. ผิด → คำนวณผิด (อันตราย)** | รวบรวมจากเอกสาร วสท. ฉบับจริง + ให้ผู้มีความรู้ทวนก่อนใช้ + ใส่หมายเหตุอ้างอิงตารางในแอป |
| ฟอนต์ไทยใน PDF ไม่ขึ้น | ทดสอบ embed Sarabun ตั้งแต่ต้น (พิสูจน์แล้วว่าทำได้) |
| ผู้ใช้เข้าใจผลลัพธ์ผิด | ข้อความเตือนชัดเจน + ระบุว่าเป็นเครื่องมือช่วยประเมิน ไม่ใช่เอกสารรับรอง |
| ข้อมูลหายเมื่อล้างเครื่อง | ปุ่ม Export สำรอง + เตือนผู้ใช้ |

---

## 7. สิ่งที่ต้องการจากผู้ใช้ (Pisut) ก่อนเริ่ม Milestone 1
1. **แหล่งตาราง วสท.** ที่เชื่อถือได้ (เล่มมาตรฐาน/หน้า/ฉบับปีที่ใช้) — เพื่อกรอกค่า ampacity, R, ตัวคูณ derate ให้ถูกต้อง
2. ยืนยันโหลดสูงสุดในฟาร์มจริง (เผื่อขยายตารางเกิน 50 sq.mm.)
3. สี/โลโก้ที่อยากใช้ (ถ้ามี) สำหรับธีมแอป
