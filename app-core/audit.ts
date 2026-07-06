// ─────────────────────────────────────────────────────────────────────────────
// INDEPENDENT AUDIT HARNESS — oracle tables transcribed directly from
// "คู่มือการติดตั้งระบบไฟฟ้าอย่างมืออาชีพ (EIT Standard 2564)" หน้า 218-221, 248-250,
// 115 (ตาราง 4.2), 204-205 (ตาราง 9.1/9.2) — transcription independent from app code.
// Run: node --import tsx audit.ts   (inside app-core dir)
// ─────────────────────────────────────────────────────────────────────────────
import { calculate, loadCurrentA, selectBreakerA } from "./src/calc";
import {
  ambientFactor, groupingFactor, lookupAmpacity, voltageDropMvAm,
  equipmentGroundSize, CABLE_SIZES_SQMM, CABLE_SPECS,
} from "./src/data/wireData";
import { CableType, InstallGroup, JobInput, Phase } from "./src/types";

type Row = Record<number, number>;
let failures: string[] = [];
let checks = 0;
function expect(cond: boolean, msg: string) {
  checks++;
  if (!cond) failures.push(msg);
}

const SIZES = [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50];

// ── ORACLE: ตาราง 5-20 (หน้า 218) ────────────────────────────────────────────
// columns per group: [2cc-single, 2cc-multi, 3cc-single, 3cc-multi]
const BOOK_5_20: Record<1 | 2, number[][]> = {
  1: [
    // 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50 → [s2, m2, s3, m3]
    [10, 10, 9, 9], [13, 12, 12, 11], [17, 16, 16, 15], [23, 22, 21, 20],
    [30, 28, 27, 25], [40, 37, 37, 34], [53, 50, 49, 45], [70, 65, 64, 59],
    [86, 80, 77, 72], [104, 96, 94, 86],
  ],
  2: [
    [12, 11, 10, 10], [15, 14, 13, 13], [21, 20, 18, 17], [28, 26, 24, 23],
    [36, 33, 31, 30], [50, 45, 44, 40], [66, 60, 59, 54], [88, 78, 77, 70],
    [109, 97, 96, 86], [131, 116, 117, 103],
  ],
};
// ตาราง 5-21 (หน้า 219) — แบน หลายแกน PVC 70°C (VAF), 2 ตัวนำกระแส
const BOOK_5_21_VAF: Row = { 1: 14, 1.5: 17, 2.5: 23, 4: 32, 6: 41, 10: 56, 16: 74 };
// ตาราง 5-22 (หน้า 220) — IEC 01, NYY บนลูกถ้วย: [คอลัมน์ซ้าย, คอลัมน์ขวา]
const BOOK_5_22: Array<[number, number, number]> = [
  [4, 30, 37], [6, 39, 48], [10, 56, 67], [16, 78, 92], [25, 113, 127],
  [35, 141, 157], [50, 171, 191],
];
// ตาราง 5-23 (หน้า 221) — [g5-2cc, g5-3cc, g6]
const BOOK_5_23: Array<[number, number, number, number]> = [
  [1, 17, 15, 21], [1.5, 21, 19, 26], [2.5, 28, 25, 35], [4, 36, 33, 45],
  [6, 46, 41, 57], [10, 62, 55, 76], [16, 81, 72, 99], [25, 106, 94, 128],
  [35, 129, 114, 154], [50, 153, 136, 181],
];
// ตาราง 5-43 PVC 70°C in air (หน้า 248): ranges; ">60" = ห้ามใช้ (no factor)
const BOOK_5_43: Array<[number, number, number]> = [
  [11, 15, 1.34], [16, 20, 1.29], [21, 25, 1.22], [26, 30, 1.15], [31, 35, 1.08],
  [36, 40, 1.0], [41, 45, 0.91], [46, 50, 0.82], [51, 55, 0.7], [56, 60, 0.57],
];
// ตาราง 5-44 PVC underground (หน้า 249)
const BOOK_5_44: Array<[number, number, number]> = [
  [11, 15, 1.18], [16, 20, 1.12], [21, 25, 1.07], [26, 30, 1.0], [31, 35, 0.94],
  [36, 40, 0.87], [41, 45, 0.8], [46, 50, 0.71], [51, 55, 0.62], [56, 60, 0.51],
];
// ตาราง 5-8 (หน้า 217): [n, ในช่องเดินสาย, เดินบนผิว/เกาะผนัง]
const BOOK_5_8: Array<[number, number, number]> = [
  [2, 0.8, 0.85], [3, 0.7, 0.79], [4, 0.65, 0.75], [5, 0.6, 0.73], [6, 0.57, 0.72],
  [7, 0.54, 0.72], [8, 0.52, 0.71], [9, 0.5, 0.7], [12, 0.45, 0.7],
  [16, 0.41, 0.7], [20, 0.38, 0.7],
];
// ตาราง 5-45 ฝังดินโดยตรง วางชิดกัน (หน้า 250)
const BOOK_5_45_TOUCH: Row = { 2: 0.75, 3: 0.65, 4: 0.6, 5: 0.55, 6: 0.5 };
// ตาราง 5-46 ร้อยท่อฝังดิน วางชิดกัน (หน้า 250)
const BOOK_5_46_TOUCH: Row = { 2: 0.85, 3: 0.75, 4: 0.7, 5: 0.65, 6: 0.6 };
// ตาราง 4.2 (หน้า 115) ขนาดสายดินเล็กสุดของบริภัณฑ์ไฟฟ้า
const BOOK_4_2: Array<[number, number]> = [
  [20, 2.5], [40, 4], [70, 6], [100, 10], [200, 16], [400, 25], [500, 35],
  [800, 50], [1000, 70], [1250, 95], [2000, 120], [2500, 185], [4000, 240], [6000, 400],
];
function bookGround(breakerA: number): number | null {
  for (const [upTo, size] of BOOK_4_2) if (breakerA <= upTo) return size;
  return null;
}
// ตาราง 9.1 (หน้า 204) แกนเดียว — เลือกค่าสูงสุดข้ามคอลัมน์ (conservative ตาม comment แอพ)
const BOOK_VD_SINGLE: Record<Phase, Row> = {
  "1P": { 1: 44, 1.5: 29, 2.5: 18, 4: 11, 6: 7.3, 10: 4.4, 16: 2.8, 25: 1.81, 35: 1.33, 50: 1.0 },
  "3P": { 1: 38, 1.5: 25, 2.5: 15, 4: 9.5, 6: 6.4, 10: 3.8, 16: 2.4, 25: 1.52, 35: 1.15, 50: 0.86 },
};
// ตาราง 9.2 (หน้า 205) หลายแกน
const BOOK_VD_MULTI: Record<Phase, Row> = {
  "1P": { 1: 44, 1.5: 29, 2.5: 18, 4: 11, 6: 7.3, 10: 4.4, 16: 2.8, 25: 1.75, 35: 1.25, 50: 0.93 },
  "3P": { 1: 38, 1.5: 25, 2.5: 15, 4: 9.5, 6: 6.4, 10: 3.8, 16: 2.4, 25: 1.5, 35: 1.1, 50: 0.8 },
};

// ═════════════════════════════ 1. AMPACITY SWEEP ═════════════════════════════
// THW=IEC01 แกนเดียว, NYY หลายแกน(ทั่วไป), VAF แบนหลายแกน, VCT: ดูหมายเหตุบัค
for (const grp of [1, 2] as const) {
  SIZES.forEach((size, i) => {
    const [s2, m2, s3, m3] = BOOK_5_20[grp][i];
    expect(lookupAmpacity("THW", grp, "1P", size).amps === s2, `5-20 g${grp} THW 1P ${size}mm²: app=${lookupAmpacity("THW", grp, "1P", size).amps} book=${s2}`);
    expect(lookupAmpacity("THW", grp, "3P", size).amps === s3, `5-20 g${grp} THW 3P ${size}mm²: app=${lookupAmpacity("THW", grp, "3P", size).amps} book=${s3}`);
    expect(lookupAmpacity("NYY", grp, "1P", size).amps === m2, `5-20 g${grp} NYY 1P ${size}mm²: app=${lookupAmpacity("NYY", grp, "1P", size).amps} book=${m2}`);
    expect(lookupAmpacity("NYY", grp, "3P", size).amps === m3, `5-20 g${grp} NYY 3P ${size}mm²: app=${lookupAmpacity("NYY", grp, "3P", size).amps} book=${m3}`);
  });
}
for (const size of SIZES) {
  const book = BOOK_5_21_VAF[size] ?? null;
  expect(lookupAmpacity("VAF", 3, "1P", size).amps === book, `5-21 VAF 1P ${size}mm²: app=${lookupAmpacity("VAF", 3, "1P", size).amps} book=${book}`);
}
// หลังแก้บัค: ตาราง 5-22 ใช้คอลัมน์แนวตั้ง (ค่าต่ำ = ปลอดภัย) กับทุกเฟส
for (const [size, lo, _hi] of BOOK_5_22) {
  expect(lookupAmpacity("THW", 4, "1P", size).amps === lo, `5-22 THW 1P ${size}mm²: app=${lookupAmpacity("THW", 4, "1P", size).amps} book(แนวตั้ง)=${lo}`);
  expect(lookupAmpacity("THW", 4, "3P", size).amps === lo, `5-22 THW 3P ${size}mm²: app=${lookupAmpacity("THW", 4, "3P", size).amps} book(แนวตั้ง)=${lo}`);
}
for (const [size, g5cc2, g5cc3, g6] of BOOK_5_23) {
  expect(lookupAmpacity("NYY", 5, "1P", size).amps === g5cc2, `5-23 g5 NYY 1P ${size}: app=${lookupAmpacity("NYY", 5, "1P", size).amps} book=${g5cc2}`);
  expect(lookupAmpacity("NYY", 5, "3P", size).amps === g5cc3, `5-23 g5 NYY 3P ${size}: app=${lookupAmpacity("NYY", 5, "3P", size).amps} book=${g5cc3}`);
  expect(lookupAmpacity("NYY", 6, "1P", size).amps === g6, `5-23 g6 NYY 1P ${size}: app=${lookupAmpacity("NYY", 6, "1P", size).amps} book=${g6}`);
  expect(lookupAmpacity("NYY", 6, "3P", size).amps === g6, `5-23 g6 NYY 3P ${size}: app=${lookupAmpacity("NYY", 6, "3P", size).amps} book=${g6}`);
}

// ═════════════════════════ 2. Ca — ทุกอุณหภูมิ 11–60°C ═══════════════════════
for (const [lo, hi, ca] of BOOK_5_43)
  for (let t = lo; t <= hi; t++)
    expect(ambientFactor(t, 2) === ca, `5-43 air ${t}°C: app=${ambientFactor(t, 2)} book=${ca}`);
for (const [lo, hi, ca] of BOOK_5_44)
  for (let t = lo; t <= hi; t++) {
    expect(ambientFactor(t, 5) === ca, `5-44 buried g5 ${t}°C: app=${ambientFactor(t, 5)} book=${ca}`);
    expect(ambientFactor(t, 6) === ca, `5-44 buried g6 ${t}°C: app=${ambientFactor(t, 6)} book=${ca}`);
  }
// เหนือ 60°C: หนังสือ = "-" (ห้ามใช้ PVC) → แอพควร reject ไม่ใช่คำนวณต่อ
for (const t of [61, 65, 70, 90, 150]) {
  const r = calculate({
    name: "hot", phase: "1P", voltage: 230, cableType: "THW", installGroup: 2,
    lengthM: 10, ambientTempC: t, groupingCircuits: 1, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "x", label: "x", unit: "A", value: 10, quantity: 1, pf: 1 }],
  });
  expect(r.status === "FAIL" || r.errors.length > 0,
    `BUG-Ca-เกินตาราง: ${t}°C > 60°C หนังสือ 5-43 = "-" (ห้ามใช้) แต่แอพให้ผล status=${r.status}, Ca=${r.ca}, สาย=${r.cableSizeSqmm}mm²`);
}

// ═════════════════════════ 3. Cg — ทุกจำนวนวงจร ══════════════════════════════
// กลุ่ม 1/2 (ในช่องเดินสาย) → คอลัมน์ 1 ✓ ที่แอพใช้
function bookCg(n: number, col: 1 | 2): number {
  if (n <= 1) return 1.0;
  for (const [g, c1, c2] of BOOK_5_8) if (n <= g) return col === 1 ? c1 : c2;
  return col === 1 ? 0.38 : 0.7;
}
for (let n = 1; n <= 20; n++)
  expect(groupingFactor(n, 2) === bookCg(n, 1), `5-8 col1 n=${n}: app=${groupingFactor(n, 2)} book=${bookCg(n, 1)}`);
// กลุ่ม 3 (เกาะผนัง) → คอลัมน์ 2 ของตาราง 5-8
for (let n = 2; n <= 20; n++)
  expect(groupingFactor(n, 3) === bookCg(n, 2), `Cg-กลุ่ม3: n=${n} คอลัมน์2=${bookCg(n, 2)} แอพ=${groupingFactor(n, 3)}`);
// กลุ่ม 6 ฝังดินโดยตรง → ตาราง 5-45 (วางชิดกัน)
for (let n = 2; n <= 6; n++)
  expect(groupingFactor(n, 6) === BOOK_5_45_TOUCH[n], `Cg-กลุ่ม6: n=${n} ตาราง5-45(ชิดกัน)=${BOOK_5_45_TOUCH[n]} แอพ=${groupingFactor(n, 6)}`);
// กลุ่ม 5 ร้อยท่อฝังดิน → ตาราง 5-46 (วางชิดกัน)
for (let n = 2; n <= 6; n++)
  expect(groupingFactor(n, 5) === BOOK_5_46_TOUCH[n], `Cg-กลุ่ม5: n=${n} ตาราง5-46(ชิดกัน)=${BOOK_5_46_TOUCH[n]} แอพ=${groupingFactor(n, 5)}`);

// ═════════════════════════ 4. สายดิน — ทุกพิกัดเบรกเกอร์ ═════════════════════
for (const b of [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125]) {
  const app = equipmentGroundSize(b);
  const book = bookGround(b);
  expect(app === book, `BUG-สายดิน: เบรกเกอร์ ${b}A แอพ=${app}mm² หนังสือตาราง4.2=${book}mm²`);
}

// ═════════════════════════ 5. VD ทุกช่อง ═════════════════════════════════════
for (const size of SIZES) {
  for (const ph of ["1P", "3P"] as Phase[]) {
    expect(voltageDropMvAm("THW", ph, size) === BOOK_VD_SINGLE[ph][size], `VD single ${ph} ${size}: app=${voltageDropMvAm("THW", ph, size)} book=${BOOK_VD_SINGLE[ph][size]}`);
    expect(voltageDropMvAm("NYY", ph, size) === BOOK_VD_MULTI[ph][size], `VD multi ${ph} ${size}: app=${voltageDropMvAm("NYY", ph, size)} book=${BOOK_VD_MULTI[ph][size]}`);
  }
}

// ═════════════ 6. ตัวอย่างจริงจากหนังสือ (worked examples) ═══════════════════
// ตย. 2.1 (หน้า 57): 1φ 230V, IL=12A, CB16A, IEC01 กลุ่ม2, 40°C → 2.5mm² (21A)
{
  const r = calculate({
    name: "ex2.1", phase: "1P", voltage: 230, cableType: "THW", installGroup: 2,
    lengthM: 1, ambientTempC: 40, groupingCircuits: 1, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "x", label: "x", unit: "A", value: 12, quantity: 1, pf: 1 }],
  });
  expect(r.breakerA === 16 && r.cableSizeSqmm === 2.5 && r.baseAmpacityA === 21,
    `ตย.2.1: app CB=${r.breakerA} size=${r.cableSizeSqmm} base=${r.baseAmpacityA} (หนังสือ: 16A, 2.5mm², 21A)`);
}
// ตย. 2.2 (หน้า 58-59): 1φ NYY 2แกน กลุ่ม2, 45°C, 2วงจรรวมท่อ → Ca=0.91 Cg=0.8
// วงจร In=32A → It≥44 → 10mm² (45A) ; วงจร In=40A → It≥55 → 16mm² (60A)
{
  const mk = (amps: number) => calculate({
    name: "ex2.2", phase: "1P", voltage: 230, cableType: "NYY", installGroup: 2,
    lengthM: 1, ambientTempC: 45, groupingCircuits: 2, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "x", label: "x", unit: "A", value: amps, quantity: 1, pf: 1 }],
  });
  const r1 = mk(32), r2 = mk(40);
  expect(r1.ca === 0.91 && r1.cg === 0.8, `ตย.2.2 factors: Ca=${r1.ca} Cg=${r1.cg} (หนังสือ 0.91/0.8)`);
  expect(r1.breakerA === 32 && r1.cableSizeSqmm === 10 && r1.baseAmpacityA === 45,
    `ตย.2.2 วงจร1: app CB=${r1.breakerA} size=${r1.cableSizeSqmm} base=${r1.baseAmpacityA} (หนังสือ: 32A→10mm² 45A)`);
  expect(r2.breakerA === 40 && r2.cableSizeSqmm === 16 && r2.baseAmpacityA === 60,
    `ตย.2.2 วงจร2: app CB=${r2.breakerA} size=${r2.cableSizeSqmm} base=${r2.baseAmpacityA} (หนังสือ: 40A→16mm² 60A)`);
}
// ตย. 9.1 (หน้า 208): NYY 2แกน กลุ่ม2 ยาว120ม. โหลด 50A → 25mm²=4.56%, 35mm²=3.26%, 50mm²=2.42%
{
  const r = calculate({
    name: "ex9.1", phase: "1P", voltage: 230, cableType: "NYY", installGroup: 2,
    lengthM: 120, ambientTempC: 40, groupingCircuits: 1, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "x", label: "x", unit: "A", value: 50, quantity: 1, pf: 1 }],
  });
  expect(r.cableSizeSqmm === 50, `ตย.9.1: ต้องได้ 50mm² (25→4.56%,35→3.26% เกิน 3%) app=${r.cableSizeSqmm}`);
  expect(r.voltageDropPercent != null && Math.abs(r.voltageDropPercent - 2.42) < 0.03,
    `ตย.9.1 %VD: app=${r.voltageDropPercent} หนังสือ=2.42%`);
}
// มอเตอร์ (หน้า 162, ข้อ 6.1.1): สายมอเตอร์ต้องรับกระแส ≥ 1.25×FLC
// ตย. FLC=13A (หนังสือหน้า 166: ขนาดกระแสสาย ≥ 1.25×13 = 16.25A → NYY กลุ่ม2 ต้อง ≥16.25A)
{
  const r = calculate({
    name: "motor", phase: "1P", voltage: 230, cableType: "NYY", installGroup: 2,
    lengthM: 5, ambientTempC: 40, groupingCircuits: 1, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "pump", label: "ปั๊มน้ำ / มอเตอร์", unit: "A", value: 13, quantity: 1, pf: 0.8 }],
  });
  // ต้องการ ampacity ≥ 16.25A → NYY multi g2 1P: 2.5mm²=20A ✓ (1.5mm²=14A ไม่พอ)
  // แอพไม่มีกฎ 1.25 → เลือกจากเบรกเกอร์ 16A → 2.5mm²(20)? It=16 → 2.5mm²=20 ✓ บังเอิญผ่าน
  // เคสที่ต่างจริง: FLC=20A → 1.25×20=25A ต้อง 4mm²(26A); แอพ: CB25→It=25→4mm²(26) ✓ บังเอิญผ่าน
  // เคสที่หลุด: FLC=11A → ต้อง ≥13.75A → 2.5mm²(20A)... ลอง FLC=14A: ต้อง ≥17.5 → 2.5mm²=20 ✓
  // จุดที่หลุดจริงคือเมื่อ CB = FLC พอดี เช่น FLC=16A: ต้อง≥20A → 2.5mm²(20A)✓; แอพ CB16→It16→2.5(20)✓
  // FLC=40A: ต้อง≥50A → 10mm²(45)ไม่พอ→16mm²(60); แอพ CB40→It40→10mm²(45) ← ต่าง!
  const r2 = calculate({
    name: "motor40", phase: "1P", voltage: 230, cableType: "NYY", installGroup: 2,
    lengthM: 5, ambientTempC: 40, groupingCircuits: 1, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "pump", label: "ปั๊มน้ำ / มอเตอร์", unit: "A", value: 40, quantity: 1, pf: 0.8 }],
  });
  expect((r2.baseAmpacityA ?? 0) >= 1.25 * 40,
    `BUG-มอเตอร์125%: FLC=40A หนังสือข้อ6.1.1 ต้องการสายรับ ≥50A (16mm²=60A) แต่แอพเลือก ${r2.cableSizeSqmm}mm² (${r2.baseAmpacityA}A)`);
  void r;
}

// ═════════════ 7. INVARIANTS — sweep โดเมนกว้าง ═══════════════════════════════
const CABLE_GROUPS: Record<CableType, InstallGroup[]> = {
  THW: [2, 1, 4], VAF: [3], VCT: [4, 2], NYY: [6, 5, 2],
};
let sweepCount = 0;
for (const cable of ["THW", "VAF", "VCT", "NYY"] as CableType[]) {
  for (const grp of CABLE_GROUPS[cable]) {
    for (const phase of ["1P", "3P"] as Phase[]) {
      if (cable === "VAF" && phase === "3P") continue; // แยกทดสอบด้านล่าง
      const voltage = phase === "1P" ? 230 : 400;
      for (const amps of [1, 3, 5, 8, 10, 13, 16, 18, 20, 24, 25, 30, 32, 36, 40, 45, 50, 55, 63, 70, 80, 90, 100, 110, 120, 125, 130]) {
        for (const temp of [15, 25, 30, 35, 40, 45, 50, 55, 60]) {
          for (const ng of [1, 2, 3, 4, 6, 9, 20]) {
            for (const len of [5, 30, 80]) {
              sweepCount++;
              const r = calculate({
                name: "s", phase, voltage, cableType: cable, installGroup: grp,
                lengthM: len, ambientTempC: temp, groupingCircuits: ng,
                maxCableSizeSqmm: 50,
                loads: [{ loadTypeId: "x", label: "x", unit: "A", value: amps, quantity: 1, pf: 1 }],
              });
              const id = `${cable}/g${grp}/${phase}/${amps}A/${temp}°C/n${ng}/${len}m`;
              if (r.errors.length > 0) continue;
              // INV1: เบรกเกอร์ ≥ กระแสโหลด
              if (r.breakerA != null)
                expect(r.breakerA >= r.totalCurrentA - 1e-9, `INV1 ${id}: CB ${r.breakerA} < IL ${r.totalCurrentA}`);
              // INV2: สายทนกระแสหลัง derate ≥ เบรกเกอร์ (สายถูกป้องกัน)
              if (r.cableSizeSqmm != null && r.breakerA != null)
                expect(r.deratedAmpacityA! >= r.breakerA - 1e-9, `INV2 ${id}: derated ${r.deratedAmpacityA} < CB ${r.breakerA}`);
              // INV3: ถ้า PASS แล้ว VD ≤ 3%
              if (r.status === "PASS")
                expect(r.voltageDropPercent! <= 3 + 1e-9, `INV3 ${id}: PASS แต่ VD=${r.voltageDropPercent}%`);
              // INV4: สายดิน ≤ สายเฟส และตรงตามหนังสือ (ตัดที่สายเฟส)
              if (r.cableSizeSqmm != null && r.groundSizeSqmm != null) {
                expect(r.groundSizeSqmm <= r.cableSizeSqmm, `INV4a ${id}: ground ${r.groundSizeSqmm} > phase ${r.cableSizeSqmm}`);
                const bg = bookGround(r.breakerA!);
                const expected = bg == null ? null : Math.min(bg, r.cableSizeSqmm);
                expect(r.groundSizeSqmm === expected, `INV4b ${id}: ground app=${r.groundSizeSqmm} book(ตัดที่เฟส)=${expected} (CB=${r.breakerA})`);
              }
              // INV5: minimality — ขนาดที่เล็กลงหนึ่งสเต็ปต้องไม่ผ่านทั้งสองเงื่อนไข
              if (r.cableSizeSqmm != null) {
                const idx = CABLE_SIZES_SQMM.indexOf(r.cableSizeSqmm);
                for (let k = idx - 1; k >= 0; k--) {
                  const sz = CABLE_SIZES_SQMM[k];
                  if (sz < CABLE_SPECS[cable].minSqmm || sz > CABLE_SPECS[cable].maxSqmm) continue;
                  const { amps: a } = lookupAmpacity(cable, grp, phase, sz);
                  if (a == null) continue;
                  const okAmp = a >= r.breakerA! / (r.ca * r.cg);
                  const mv = voltageDropMvAm(cable, phase, sz);
                  const vd = mv == null ? 0 : (mv * r.totalCurrentA * len) / 1000 / voltage * 100;
                  const okVd = vd <= 3;
                  expect(!(okAmp && okVd), `INV5 ${id}: เลือก ${r.cableSizeSqmm} แต่ ${sz} ก็ผ่าน (amp ${a} vd ${vd.toFixed(2)})`);
                }
              }
            }
          }
        }
      }
    }
  }
}

// ═════════════ 7.5 VCT — ตารางที่ถูกต้องคือ 5-26 ═════════════════════════════
// หนังสือ: ตาราง 5-22 ระบุใช้กับ "60227 IEC 01, NYY" เท่านั้น (หน้า 220)
// VCT เดินในอากาศต้องใช้ตาราง 5-26 (หน้า 223): 1แกนคู่/2แกน กับ 3-5แกน
const BOOK_5_26: { pair: Row; multi: Row } = {
  pair:  { 1: 13, 1.5: 16, 2.5: 25, 4: 30, 6: 39, 10: 51, 16: 73, 25: 97, 35: 140, 50: 175 },
  multi: { 1: 11, 1.5: 14, 2.5: 21, 4: 26, 6: 34, 10: 47, 16: 63, 25: 83, 35: 102 },
};
for (const size of [4, 6, 10, 16, 25, 35]) {
  const app1p = lookupAmpacity("VCT", 4, "1P", size).amps;
  const app3p = lookupAmpacity("VCT", 4, "3P", size).amps;
  expect(app1p === BOOK_5_26.pair[size],
    `VCT-5-26: ${size}mm² 1P app=${app1p} book(1-2แกน)=${BOOK_5_26.pair[size]}`);
  expect(app3p === (BOOK_5_26.multi[size] ?? null),
    `VCT-5-26: ${size}mm² 3P app=${app3p} book(3-5แกน)=${BOOK_5_26.multi[size] ?? "-"}`);
}
// VCT ในท่อ (กลุ่ม2): ต้องใช้คอลัมน์หลายแกนของ 5-20
for (const size of [4, 6, 10, 16]) {
  const appVal = lookupAmpacity("VCT", 2, "1P", size).amps;
  const multiVal = lookupAmpacity("NYY", 2, "1P", size).amps; // คอลัมน์หลายแกนของ 5-20
  expect(appVal === multiVal,
    `VCT-แกน: VCT ${size}mm² กลุ่ม2 app=${appVal}A ควรเท่าคอลัมน์หลายแกน=${multiVal}A`);
}

// ═════════════ 8. EDGE CASES ══════════════════════════════════════════════════
// 8.1 VAF + 3 เฟส → ควรบอกชัดว่า VAF ใช้ 3 เฟสไม่ได้ ไม่ใช่ "รอการตรวจสอบ"
{
  const r = calculate({
    name: "vaf3p", phase: "3P", voltage: 400, cableType: "VAF", installGroup: 3,
    lengthM: 10, ambientTempC: 40, groupingCircuits: 1, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "x", label: "x", unit: "A", value: 10, quantity: 1, pf: 1 }],
  });
  expect(r.status === "FAIL", `VAF3P: status=${r.status}`);
  expect(!r.warnings.some((w) => w.includes("รอการตรวจสอบ")),
    `BUG-VAF-3P: ข้อความ "${r.warnings[0] ?? ""}" ทำให้เข้าใจผิด — ความจริงคือ VAF เป็นสายแบน 2 แกน ใช้กับ 3 เฟสไม่ได้ ไม่ใช่ข้อมูล "รอการตรวจสอบ"`);
}
// 8.2 อุณหภูมิต่ำกว่า 11°C — หนังสือไม่มีแถว; แอพใช้ 1.34 (อนุรักษ์นิยม) → บันทึกเป็น note
{
  const r = calculate({
    name: "cold", phase: "1P", voltage: 230, cableType: "THW", installGroup: 2,
    lengthM: 10, ambientTempC: 5, groupingCircuits: 1, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "x", label: "x", unit: "A", value: 10, quantity: 1, pf: 1 }],
  });
  expect(r.ca === 1.34, `NOTE-อุณหภูมิต่ำ: 5°C → Ca=${r.ca} (ใช้แถว 11-15 = ปลอดภัย)`);
}
// 8.3 จำนวนวงจรไม่เป็นจำนวนเต็ม เช่น 2.5 → ควร validate
{
  const r = calculate({
    name: "frac", phase: "1P", voltage: 230, cableType: "THW", installGroup: 2,
    lengthM: 10, ambientTempC: 40, groupingCircuits: 2.5, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "x", label: "x", unit: "A", value: 10, quantity: 1, pf: 1 }],
  });
  expect(r.errors.length > 0, `NOTE-กลุ่มวงจร 2.5 (ไม่เต็ม): แอพยอมรับ (Cg=${r.cg}) — ควร validate เป็นจำนวนเต็ม`);
}
// 8.4 โหลดจำนวนมหาศาล / ค่า Infinity / NaN
{
  const inf = calculate({
    name: "inf", phase: "1P", voltage: 230, cableType: "THW", installGroup: 2,
    lengthM: 10, ambientTempC: 40, groupingCircuits: 1, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "x", label: "x", unit: "W", value: Infinity, quantity: 1, pf: 1 }],
  });
  expect(inf.status === "FAIL", `EDGE-Infinity: status=${inf.status}`);
  const nan = calculate({
    name: "nan", phase: "1P", voltage: 230, cableType: "THW", installGroup: 2,
    lengthM: NaN, ambientTempC: 40, groupingCircuits: 1, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "x", label: "x", unit: "A", value: 10, quantity: 1, pf: 1 }],
  });
  expect(nan.errors.length > 0, `EDGE-NaN length: errors=${nan.errors.length}`);
}
// 8.5 แรงดันตก: ความยาว 0.0001 กับยาวมาก
{
  const r = calculate({
    name: "long", phase: "1P", voltage: 230, cableType: "THW", installGroup: 2,
    lengthM: 10000, ambientTempC: 40, groupingCircuits: 1, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "x", label: "x", unit: "A", value: 10, quantity: 1, pf: 1 }],
  });
  expect(r.status === "FAIL" && r.warnings.some((w) => w.includes("แรงดันตก")), `EDGE-ยาว 10km: ${r.status} ${r.warnings[0] ?? ""}`);
}
// 8.6 pf ผิดปกติ
{
  const r = calculate({
    name: "pf", phase: "1P", voltage: 230, cableType: "THW", installGroup: 2,
    lengthM: 10, ambientTempC: 40, groupingCircuits: 1, maxCableSizeSqmm: 50,
    loads: [{ loadTypeId: "x", label: "x", unit: "W", value: 1000, quantity: 1, pf: 1.5 }],
  });
  expect(r.errors.length > 0, `EDGE-pf 1.5: ควร error, ได้ errors=${r.errors.length}`);
}

// ═════════════ SUMMARY ════════════════════════════════════════════════════════
console.log(`\n════════ ผลการตรวจ ════════`);
console.log(`ตรวจทั้งหมด ${checks} รายการ (sweep ${sweepCount} เคส)`);
console.log(`พบความต่าง/บัค ${failures.length} รายการ\n`);
const groups: Record<string, string[]> = {};
for (const f of failures) {
  const key = f.split(":")[0].replace(/ .*/, "");
  (groups[key] ??= []).push(f);
}
for (const [k, list] of Object.entries(groups)) {
  console.log(`── ${k} (${list.length}) ──`);
  for (const m of list.slice(0, 4)) console.log("  ✗ " + m);
  if (list.length > 4) console.log(`  ... และอีก ${list.length - 4} รายการในกลุ่มเดียวกัน`);
}
