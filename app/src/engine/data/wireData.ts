// ─────────────────────────────────────────────────────────────────────────────
// Standard data tables — มาตรฐานการติดตั้งทางไฟฟ้าสำหรับประเทศไทย พ.ศ. 2564 (วสท./EIT)
//
// SOURCE (VERIFIED 2026-07-06 — audit เทียบทีละค่ากับภาพหน้าหนังสือจริง):
// "คู่มือการติดตั้งระบบไฟฟ้าอย่างมืออาชีพ (EIT Standard 2564)" โดย ลือชัย ทองนิล
//   ตาราง 5-20 (หน้า 218), 5-21 (219), 5-22 (220), 5-23 (221), 5-26 (223)
//   ตาราง 5-8 (217), 5-43 (248), 5-44 (249), 5-45/5-46 (250)
//   ตาราง 4.2 สายดินบริภัณฑ์ (หน้า 115), ตาราง 9.1/9.2 แรงดันตก (204-205)
// ─────────────────────────────────────────────────────────────────────────────

import { CableType, InstallGroup, Phase } from "../types";

export const BREAKER_RATINGS_A = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
export const CABLE_SIZES_SQMM = [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50];

// กฎ 125% สำหรับโหลดมอเตอร์ — วสท. ข้อ 6.1.1 (หนังสือหน้า 162):
// "สายไฟฟ้าของมอเตอร์ต้องมีขนาดกระแสไม่ต่ำกว่า 1.25 เท่าของกระแสโหลดเต็มที่"
// หมายเหตุ: แอปคูณ 1.25 กับโหลดมอเตอร์ทุกตัว (มาตรฐานกำหนด 1.25×ตัวใหญ่สุด + ตัวอื่น 100%
// สำหรับหลายมอเตอร์ — วิธีของแอปให้ผล ≥ มาตรฐานเสมอ จึงอยู่ฝั่งปลอดภัย)
export const MOTOR_FACTOR = 1.25;
// preset ids ที่ถือเป็นโหลดมอเตอร์ (fallback สำหรับงานที่บันทึกไว้ก่อนมีฟิลด์ isMotor)
export const MOTOR_TYPE_IDS = new Set(["pump", "ac", "fan", "fridge"]);

// Equipment grounding conductor size by overcurrent-device (breaker) rating.
// วสท. ตารางที่ 4-2 — ตาราง 4.2 ในหนังสือ (หน้า 115) "ขนาดสายดินเล็กสุดของบริภัณฑ์ไฟฟ้า"
// [VERIFIED กับภาพหน้าหนังสือ]
const EQUIP_GROUND: Array<{ upTo: number; size: number }> = [
  { upTo: 20, size: 2.5 }, { upTo: 40, size: 4 }, { upTo: 70, size: 6 },
  { upTo: 100, size: 10 }, { upTo: 200, size: 16 }, { upTo: 400, size: 25 },
  { upTo: 500, size: 35 }, { upTo: 800, size: 50 }, { upTo: 1000, size: 70 },
  { upTo: 1250, size: 95 }, { upTo: 2000, size: 120 }, { upTo: 2500, size: 185 },
  { upTo: 4000, size: 240 }, { upTo: 6000, size: 400 },
];

/** Equipment grounding conductor size (sq.mm) for a given breaker rating. */
export function equipmentGroundSize(breakerA: number): number | null {
  for (const r of EQUIP_GROUND) if (breakerA <= r.upTo) return r.size;
  return null;
}

// Cable characteristics & allowed sizes.
export const CABLE_SPECS: Record<
  CableType,
  { minSqmm: number; maxSqmm: number; note: string }
> = {
  THW: { minSqmm: 1.5, maxSqmm: 400, note: "60227 IEC 01, 450/750V, 70°C, แกนเดี่ยว; ห้ามฝังดิน" },
  VAF: { minSqmm: 1.0, maxSqmm: 16, note: "300/500V, 70°C, สายแบน 1 เฟส; เกาะผนัง; ห้ามร้อยท่อ/ฝังดิน/ใช้ 3 เฟส" },
  VCT: { minSqmm: 4.0, maxSqmm: 35, note: "450/750V, 70°C, สายอ่อนหลายแกน; ต่อเครื่องใช้ไฟฟ้า (ตาราง 5-26)" },
  NYY: { minSqmm: 1.0, maxSqmm: 500, note: "450/750V, 70°C; ฝังดิน/ร้อยท่อฝังดินได้" },
};

// Default install group per cable type (user can override).
export const DEFAULT_INSTALL_GROUP: Record<CableType, InstallGroup> = {
  THW: 2, // in conduit                → Table 5-20
  VAF: 3, // clipped to wall (flat)    → Table 5-21
  VCT: 4, // in air (flexible cable)   → Table 5-26
  NYY: 6, // direct buried             → Table 5-23
};

export function tableForGroup(g: InstallGroup): "5-20" | "5-21" | "5-22" | "5-23" {
  if (g === 1 || g === 2) return "5-20";
  if (g === 3) return "5-21";
  if (g === 4) return "5-22";
  return "5-23"; // 5 & 6
}

// ── Ambient-temperature derating (Ca) ────────────────────────────────────────
// Table 5-43, PVC 70°C, IN AIR, base 40°C.  [VERIFIED]
// เกิน 60°C หนังสือระบุ "-" = ห้ามใช้สาย PVC → ตรวจจับที่ validate() ใน calc.ts
export const MAX_AMBIENT_C = 60;
const CA_AIR_PVC: Array<{ upTo: number; ca: number }> = [
  { upTo: 15, ca: 1.34 }, { upTo: 20, ca: 1.29 }, { upTo: 25, ca: 1.22 },
  { upTo: 30, ca: 1.15 }, { upTo: 35, ca: 1.08 }, { upTo: 40, ca: 1.0 },
  { upTo: 45, ca: 0.91 }, { upTo: 50, ca: 0.82 }, { upTo: 55, ca: 0.7 },
  { upTo: 60, ca: 0.57 },
];
// Table 5-44, PVC 70°C, UNDERGROUND, base 30°C.  [VERIFIED]
const CA_GROUND_PVC: Array<{ upTo: number; ca: number }> = [
  { upTo: 15, ca: 1.18 }, { upTo: 20, ca: 1.12 }, { upTo: 25, ca: 1.07 },
  { upTo: 30, ca: 1.0 }, { upTo: 35, ca: 0.94 }, { upTo: 40, ca: 0.87 },
  { upTo: 45, ca: 0.8 }, { upTo: 50, ca: 0.71 }, { upTo: 55, ca: 0.62 },
  { upTo: 60, ca: 0.51 },
];
export function ambientFactor(ambientC: number, group: InstallGroup): number {
  const buried = group === 5 || group === 6;
  const rows = buried ? CA_GROUND_PVC : CA_AIR_PVC;
  // ต่ำกว่าแถวแรก (11°C) ใช้ค่าแถวแรก = ฝั่งปลอดภัย (อากาศเย็นระบายความร้อนดีกว่า)
  for (const r of rows) if (ambientC <= r.upTo) return r.ca;
  return rows[rows.length - 1].ca; // >60°C: validate() บล็อกไว้ก่อนแล้ว
}

// ── Grouping derating (Cg) — แยกตามวิธีติดตั้ง ────────────────────────────────
// ตาราง 5-8 (หน้า 217) มี 2 คอลัมน์:  [VERIFIED กับภาพหน้าหนังสือ]
//   คอลัมน์ 1 "ในช่องเดินสายไฟฟ้าหรือรางเคเบิลที่มีฝาปิด" → กลุ่ม 1, 2
//   คอลัมน์ 2 "เดินสายบนผิวหรือเดินสายเกาะผนัง"          → กลุ่ม 3
// ฝังดิน >1 วงจร (หมายเหตุ 2 ตาราง 5-23):
//   ตาราง 5-45 ฝังดินโดยตรง (กลุ่ม 6), ตาราง 5-46 ร้อยท่อฝังดิน (กลุ่ม 5)
//   — ใช้คอลัมน์ "วางชิดกัน" (ค่าต่ำสุด = ฝั่งปลอดภัย เพราะแอปไม่ทราบระยะห่างจริง)
// กลุ่ม 4 (บนลูกถ้วย): ตาราง 5-22 ไม่ระบุตารางปรับค่า → ใช้คอลัมน์ 1 (อนุรักษ์นิยม)
const CG_5_8_COL1: Array<{ groups: number; cg: number }> = [
  { groups: 1, cg: 1.0 }, { groups: 2, cg: 0.8 }, { groups: 3, cg: 0.7 },
  { groups: 4, cg: 0.65 }, { groups: 5, cg: 0.6 }, { groups: 6, cg: 0.57 },
  { groups: 7, cg: 0.54 }, { groups: 8, cg: 0.52 }, { groups: 9, cg: 0.5 },
  { groups: 12, cg: 0.45 }, { groups: 16, cg: 0.41 }, { groups: 20, cg: 0.38 },
];
const CG_5_8_COL2: Array<{ groups: number; cg: number }> = [
  { groups: 1, cg: 1.0 }, { groups: 2, cg: 0.85 }, { groups: 3, cg: 0.79 },
  { groups: 4, cg: 0.75 }, { groups: 5, cg: 0.73 }, { groups: 6, cg: 0.72 },
  { groups: 7, cg: 0.72 }, { groups: 8, cg: 0.71 }, { groups: 9, cg: 0.7 },
  { groups: 20, cg: 0.7 },
];
const CG_5_45_TOUCHING: Array<{ groups: number; cg: number }> = [
  { groups: 1, cg: 1.0 }, { groups: 2, cg: 0.75 }, { groups: 3, cg: 0.65 },
  { groups: 4, cg: 0.6 }, { groups: 5, cg: 0.55 }, { groups: 6, cg: 0.5 },
];
const CG_5_46_TOUCHING: Array<{ groups: number; cg: number }> = [
  { groups: 1, cg: 1.0 }, { groups: 2, cg: 0.85 }, { groups: 3, cg: 0.75 },
  { groups: 4, cg: 0.7 }, { groups: 5, cg: 0.65 }, { groups: 6, cg: 0.6 },
];

function cgTableFor(group: InstallGroup): Array<{ groups: number; cg: number }> {
  if (group === 3) return CG_5_8_COL2;
  if (group === 5) return CG_5_46_TOUCHING;
  if (group === 6) return CG_5_45_TOUCHING;
  return CG_5_8_COL1; // กลุ่ม 1, 2, 4, 7
}

/** Cg + ธงบอกว่าจำนวนวงจรอยู่ในขอบเขตตารางของมาตรฐานหรือไม่ */
export function groupingFactorEx(
  nGroups: number,
  group: InstallGroup
): { cg: number; withinTable: boolean } {
  const rows = cgTableFor(group);
  if (nGroups <= 1) return { cg: 1.0, withinTable: true };
  for (const r of rows) if (nGroups <= r.groups) return { cg: r.cg, withinTable: true };
  // เกินขอบเขตตาราง (ฝังดิน >6 วงจร หรือ >20 วงจร) → ใช้ค่าต่ำสุด + ให้ผู้เรียกเตือน
  return { cg: rows[rows.length - 1].cg, withinTable: false };
}

export function groupingFactor(nGroups: number, group: InstallGroup = 2): number {
  return groupingFactorEx(nGroups, group).cg;
}

// ── Ampacity tables (A) — VERIFIED, full range 1–50 mm² ───────────────────────
type Row = Record<number, number>;

// Table 5-20 (in conduit). Sub-column by group (1/2), core (single/multi),
// and current-carrying conductors cc (2 = 1φ, 3 = 3φ).
const T5_20: Record<1 | 2, { single: { 2: Row; 3: Row }; multi: { 2: Row; 3: Row } }> = {
  1: {
    single: {
      2: { 1: 10, 1.5: 13, 2.5: 17, 4: 23, 6: 30, 10: 40, 16: 53, 25: 70, 35: 86, 50: 104 },
      3: { 1: 9, 1.5: 12, 2.5: 16, 4: 21, 6: 27, 10: 37, 16: 49, 25: 64, 35: 77, 50: 94 },
    },
    multi: {
      2: { 1: 10, 1.5: 12, 2.5: 16, 4: 22, 6: 28, 10: 37, 16: 50, 25: 65, 35: 80, 50: 96 },
      3: { 1: 9, 1.5: 11, 2.5: 15, 4: 20, 6: 25, 10: 34, 16: 45, 25: 59, 35: 72, 50: 86 },
    },
  },
  2: {
    single: {
      2: { 1: 12, 1.5: 15, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 66, 25: 88, 35: 109, 50: 131 },
      3: { 1: 10, 1.5: 13, 2.5: 18, 4: 24, 6: 31, 10: 44, 16: 59, 25: 77, 35: 96, 50: 117 },
    },
    multi: {
      2: { 1: 11, 1.5: 14, 2.5: 20, 4: 26, 6: 33, 10: 45, 16: 60, 25: 78, 35: 97, 50: 116 },
      3: { 1: 10, 1.5: 13, 2.5: 17, 4: 23, 6: 30, 10: 40, 16: 54, 25: 70, 35: 86, 50: 103 },
    },
  },
};

// Table 5-21 (clipped to wall, group 3). VAF = flat PVC multicore, 2 cc only.
const T5_21_VAF: Row = { 1: 14, 1.5: 17, 2.5: 23, 4: 32, 6: 41, 10: 56, 16: 74 };

// Table 5-22 (on insulators in air, group 4) — ใช้กับ 60227 IEC 01 และ NYY เท่านั้น
// (หัวตาราง หน้า 220). สองคอลัมน์ของตารางคือ "รูปแบบการวางสาย":
//   คอลัมน์ซ้าย = วางแนวตั้ง (ค่าต่ำ) · คอลัมน์ขวา = วางแนวนอนมีระยะห่าง (ค่าสูง)
// ไม่ใช่จำนวนเฟส! ตัวอย่างในหนังสือ (หน้า 142, 148) ใช้คอลัมน์แนวตั้งกับงานเมนทั่วไป
// → แอปใช้คอลัมน์แนวตั้ง (ต่ำ) กับทุกกรณี = ฝั่งปลอดภัย เพราะไม่ทราบการวางจริง
const T5_22_VERTICAL: Row = { 4: 30, 6: 39, 10: 56, 16: 78, 25: 113, 35: 141, 50: 171 };
// เก็บไว้เผื่ออนาคตเพิ่มตัวเลือกการวางแนวนอน:
export const T5_22_HORIZONTAL: Row = { 4: 37, 6: 48, 10: 67, 16: 92, 25: 127, 35: 157, 50: 191 };

// Table 5-26 (หน้า 223) — สายเคเบิลอ่อน (flexible cable) VCT เดินในอากาศ:
//   คอลัมน์ 1: เคเบิล 1 แกน 2 เส้น หรือ 2 แกน (ใช้กับวงจร 1 เฟส)
//   คอลัมน์ 2: เคเบิล 3, 4 หรือ 5 แกน (ใช้กับวงจร 3 เฟส)
const T5_26_VCT: { 2: Row; 3: Row } = {
  2: { 1: 13, 1.5: 16, 2.5: 25, 4: 30, 6: 39, 10: 51, 16: 73, 25: 97, 35: 140, 50: 175 },
  3: { 1: 11, 1.5: 14, 2.5: 21, 4: 26, 6: 34, 10: 47, 16: 63, 25: 83, 35: 102 },
};

// Table 5-23 (buried, group 5 & 6, base 30°C). group 5 splits by cc; group 6 single.
const T5_23_g5: { 2: Row; 3: Row } = {
  2: { 1: 17, 1.5: 21, 2.5: 28, 4: 36, 6: 46, 10: 62, 16: 81, 25: 106, 35: 129, 50: 153 },
  3: { 1: 15, 1.5: 19, 2.5: 25, 4: 33, 6: 41, 10: 55, 16: 72, 25: 94, 35: 114, 50: 136 },
};
const T5_23_g6: Row = { 1: 21, 1.5: 26, 2.5: 35, 4: 45, 6: 57, 10: 76, 16: 99, 25: 128, 35: 154, 50: 181 };

// ลักษณะแกนของสายเพื่อเลือกคอลัมน์ตาราง 5-20 และตารางแรงดันตก:
// THW (IEC 01) = แกนเดี่ยว · NYY/VCT/VAF ที่ใช้งานทั่วไป = หลายแกน
// (เดิมแอปจัด VCT เป็นแกนเดี่ยว → ได้ค่าสูงเกินจริง ~7-11% — แก้แล้ว)
export function coreOf(cable: CableType): "single" | "multi" {
  return cable === "THW" ? "single" : "multi";
}

export function lookupAmpacity(
  cable: CableType,
  group: InstallGroup,
  phase: Phase,
  sizeSqmm: number
): { amps: number | null; verified: boolean } {
  const table = tableForGroup(group);
  const cc: 2 | 3 = phase === "1P" ? 2 : 3;
  let v: number | undefined;

  if (table === "5-20") {
    v = T5_20[grpOf(group)][coreOf(cable)][cc][sizeSqmm];
  } else if (table === "5-21") {
    if (cable === "VAF") v = cc === 2 ? T5_21_VAF[sizeSqmm] : undefined; // VAF is 1φ 2-wire
  } else if (table === "5-22") {
    // ตาราง 5-22 ใช้ได้กับ IEC 01 (THW) และ NYY เท่านั้น — VCT ต้องใช้ตาราง 5-26
    if (cable === "VCT") v = T5_26_VCT[cc][sizeSqmm];
    else v = T5_22_VERTICAL[sizeSqmm];
  } else {
    v = group === 6 ? T5_23_g6[sizeSqmm] : T5_23_g5[cc][sizeSqmm];
  }
  return { amps: v ?? null, verified: v != null };
}

function grpOf(group: InstallGroup): 1 | 2 {
  return group === 1 ? 1 : 2;
}

// ── Load-type presets (pf).  [user-editable] ─────────────────────────────────
// isMotor = โหลดชนิดมอเตอร์ → ใช้กฎ 125% (วสท. ข้อ 6.1.1)
export const DEFAULT_LOAD_TYPES = [
  { id: "led", name: "หลอด LED / แสงสว่าง", pf: 1.0, isCustom: false, isMotor: false },
  { id: "heater", name: "ฮีตเตอร์ / เครื่องทำความร้อน", pf: 1.0, isCustom: false, isMotor: false },
  { id: "socket", name: "เต้ารับทั่วไป", pf: 1.0, isCustom: false, isMotor: false },
  { id: "pump", name: "ปั๊มน้ำ / มอเตอร์", pf: 0.8, isCustom: false, isMotor: true },
  { id: "ac", name: "แอร์ / คอมเพรสเซอร์", pf: 0.85, isCustom: false, isMotor: true },
  { id: "fan", name: "พัดลม / โบลเวอร์", pf: 0.8, isCustom: false, isMotor: true },
  { id: "fridge", name: "ตู้เย็น / ตู้แช่", pf: 0.8, isCustom: false, isMotor: true },
];

// ── Voltage drop (mV/A/m) — บทที่ 9, Tables 9.1 (PVC single) & 9.2 (PVC multi) ─
// [VERIFIED] reproduces the standard's worked examples (ex 9.1: 25mm² multi 1φ = 1.75).
// Conservative column chosen (max across install groups) for a safety margin.
// %VD = mV/A/m × I × L(m) / 1000 / Vref × 100 ;  Vref = 230 (1φ) / 400 (3φ).
export const VOLTAGE_DROP_DATA_AVAILABLE = true;

const VD_MVAM: Record<"single" | "multi", Record<Phase, Row>> = {
  single: {
    "1P": { 1: 44, 1.5: 29, 2.5: 18, 4: 11, 6: 7.3, 10: 4.4, 16: 2.8, 25: 1.81, 35: 1.33, 50: 1.0 },
    "3P": { 1: 38, 1.5: 25, 2.5: 15, 4: 9.5, 6: 6.4, 10: 3.8, 16: 2.4, 25: 1.52, 35: 1.15, 50: 0.86 },
  },
  multi: {
    "1P": { 1: 44, 1.5: 29, 2.5: 18, 4: 11, 6: 7.3, 10: 4.4, 16: 2.8, 25: 1.75, 35: 1.25, 50: 0.93 },
    "3P": { 1: 38, 1.5: 25, 2.5: 15, 4: 9.5, 6: 6.4, 10: 3.8, 16: 2.4, 25: 1.5, 35: 1.1, 50: 0.8 },
  },
};

export function voltageDropMvAm(cable: CableType, phase: Phase, sizeSqmm: number): number | null {
  return VD_MVAM[coreOf(cable)][phase][sizeSqmm] ?? null;
}

export const VOLTAGE_DROP_LIMIT_PERCENT = 3;
