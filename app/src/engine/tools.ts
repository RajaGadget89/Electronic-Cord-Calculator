// ─────────────────────────────────────────────────────────────────────────────
// Field tools — motor sizing, conduit fill, max cable length, circuit check.
// Data source (VERIFIED): EIT Standard 2564 (ลือชัย ทองนิล):
//   Appendix G (G1–G4) motor tables · Appendix C (C1/C2) conduit fill.
// ─────────────────────────────────────────────────────────────────────────────

import { CableType, InstallGroup, Phase } from "./types";
import {
  ambientFactor,
  groupingFactor,
  lookupAmpacity,
  voltageDropMvAm,
  VOLTAGE_DROP_LIMIT_PERCENT,
  CABLE_SIZES_SQMM,
} from "./data/wireData";

const SQRT3 = Math.sqrt(3);

// ── Motor sizing (Appendix G) ────────────────────────────────────────────────
// Book pre-computes the full motor circuit per HP. cbAltA = larger breaker if it
// trips on starting current. Values ≤ app scope (wire ≤ 50 sq.mm).
export interface MotorRow {
  hp: string;
  kw: number;
  flcA: number;      // full-load current (In)
  breakerA: number;  // recommended CB (choose next size up if trips on start)
  breakerAltA?: number;
  wireSqmm: number;  // circuit conductor (already ≥ 1.25×FLC)
  groundSqmm: number;
  conduitTHWmm: number; // IEC 01
  conduitNYYmm: number;
}

// Table G1 + G2 — 1φ 230V induction motor
export const MOTOR_1P: MotorRow[] = [
  { hp: "1/2", kw: 0.37, flcA: 5.1, breakerA: 16, wireSqmm: 1.5, groundSqmm: 1.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "3/4", kw: 0.55, flcA: 7.2, breakerA: 16, wireSqmm: 1.5, groundSqmm: 1.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "1", kw: 0.75, flcA: 8.4, breakerA: 16, wireSqmm: 1.5, groundSqmm: 1.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "1.5", kw: 1.1, flcA: 10.5, breakerA: 20, breakerAltA: 25, wireSqmm: 1.5, groundSqmm: 1.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "2", kw: 1.5, flcA: 12.5, breakerA: 25, breakerAltA: 32, wireSqmm: 2.5, groundSqmm: 2.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "3", kw: 2.2, flcA: 17.8, breakerA: 40, wireSqmm: 4, groundSqmm: 4, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "5", kw: 4, flcA: 29.3, breakerA: 63, wireSqmm: 10, groundSqmm: 4, conduitTHWmm: 20, conduitNYYmm: 40 },
  { hp: "7.5", kw: 5.5, flcA: 41.8, breakerA: 80, breakerAltA: 100, wireSqmm: 16, groundSqmm: 6, conduitTHWmm: 25, conduitNYYmm: 40 },
  { hp: "10", kw: 7.5, flcA: 52.3, breakerA: 100, breakerAltA: 125, wireSqmm: 16, groundSqmm: 6, conduitTHWmm: 25, conduitNYYmm: 40 },
];

// Table G3 + G4 — 3φ 400V induction motor (DOL). Up to 60 HP (wire ≤ 50 sq.mm).
export const MOTOR_3P: MotorRow[] = [
  { hp: "1/2", kw: 0.37, flcA: 1.2, breakerA: 16, wireSqmm: 1.5, groundSqmm: 1.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "3/4", kw: 0.55, flcA: 1.7, breakerA: 16, wireSqmm: 1.5, groundSqmm: 1.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "1", kw: 0.75, flcA: 2.2, breakerA: 16, wireSqmm: 1.5, groundSqmm: 1.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "1.5", kw: 1.1, flcA: 3.1, breakerA: 16, wireSqmm: 1.5, groundSqmm: 1.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "2", kw: 1.5, flcA: 4.1, breakerA: 16, wireSqmm: 1.5, groundSqmm: 1.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "3", kw: 2.2, flcA: 5.8, breakerA: 16, wireSqmm: 1.5, groundSqmm: 1.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "5", kw: 3.7, flcA: 9.2, breakerA: 20, wireSqmm: 1.5, groundSqmm: 1.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "7.5", kw: 5.5, flcA: 13.0, breakerA: 32, wireSqmm: 2.5, groundSqmm: 2.5, conduitTHWmm: 15, conduitNYYmm: 32 },
  { hp: "10", kw: 7.5, flcA: 17.0, breakerA: 32, wireSqmm: 4, groundSqmm: 4, conduitTHWmm: 20, conduitNYYmm: 40 },
  { hp: "15", kw: 11, flcA: 25.0, breakerA: 50, wireSqmm: 10, groundSqmm: 4, conduitTHWmm: 25, conduitNYYmm: 40 },
  { hp: "20", kw: 15, flcA: 33.0, breakerA: 80, wireSqmm: 10, groundSqmm: 4, conduitTHWmm: 25, conduitNYYmm: 40 },
  { hp: "25", kw: 18.5, flcA: 41.0, breakerA: 80, breakerAltA: 100, wireSqmm: 16, groundSqmm: 6, conduitTHWmm: 25, conduitNYYmm: 50 },
  { hp: "30", kw: 22, flcA: 49.0, breakerA: 100, wireSqmm: 25, groundSqmm: 6, conduitTHWmm: 32, conduitNYYmm: 50 },
  { hp: "40", kw: 30, flcA: 63.0, breakerA: 125, wireSqmm: 35, groundSqmm: 10, conduitTHWmm: 40, conduitNYYmm: 50 },
  { hp: "50", kw: 37, flcA: 79.0, breakerA: 160, wireSqmm: 50, groundSqmm: 10, conduitTHWmm: 40, conduitNYYmm: 65 },
  { hp: "60", kw: 45, flcA: 93.0, breakerA: 175, wireSqmm: 50, groundSqmm: 16, conduitTHWmm: 40, conduitNYYmm: 65 },
];

export function motorTable(phase: Phase): MotorRow[] {
  return phase === "1P" ? MOTOR_1P : MOTOR_3P;
}
export function motorLookup(phase: Phase, hp: string): MotorRow | undefined {
  return motorTable(phase).find((m) => m.hp === hp);
}

// ── Conduit fill (Appendix C) ────────────────────────────────────────────────
// Max number of same-size conductors per conduit trade size. 0 = does not fit.
export const CONDUIT_SIZES_MM = [15, 20, 25, 32, 40, 50, 65, 80, 90, 100, 125, 150];
export const CONDUIT_SIZE_INCH: Record<number, string> = {
  15: "1/2", 20: "3/4", 25: "1", 32: "1¼", 40: "1½", 50: "2",
  65: "2½", 80: "3", 90: "3½", 100: "4", 125: "5", 150: "6",
};

// C1 — THW (60227 IEC 01, single core)
const CONDUIT_THW: Record<number, number[]> = {
  1.5: [8, 14, 22, 37, 0, 0, 0, 0, 0, 0, 0, 0],
  2.5: [5, 10, 15, 25, 0, 0, 0, 0, 0, 0, 0, 0],
  4: [4, 7, 11, 19, 30, 0, 0, 0, 0, 0, 0, 0],
  6: [3, 5, 9, 15, 23, 37, 0, 0, 0, 0, 0, 0],
  10: [1, 3, 5, 9, 14, 22, 0, 0, 0, 0, 0, 0],
  16: [1, 2, 4, 6, 10, 16, 27, 42, 0, 0, 0, 0],
  25: [1, 2, 2, 4, 6, 10, 17, 27, 34, 0, 0, 0],
  35: [1, 1, 2, 3, 5, 8, 14, 21, 27, 33, 0, 0],
  50: [0, 1, 1, 1, 3, 6, 10, 15, 19, 24, 38, 0],
};
// C2 — NYY (single core)
const CONDUIT_NYY: Record<number, number[]> = {
  1: [1, 1, 3, 5, 8, 12, 21, 0, 0, 0, 0, 0],
  1.5: [1, 1, 2, 4, 7, 11, 19, 30, 0, 0, 0, 0],
  2.5: [1, 1, 2, 4, 7, 10, 17, 26, 0, 0, 0, 0],
  4: [1, 1, 1, 3, 6, 9, 15, 23, 29, 0, 0, 0],
  6: [0, 1, 1, 3, 5, 8, 13, 21, 26, 0, 0, 0],
  10: [0, 1, 1, 2, 4, 6, 11, 17, 22, 27, 0, 0],
  16: [0, 1, 1, 1, 3, 5, 10, 15, 19, 23, 0, 0],
  25: [0, 1, 1, 1, 3, 4, 8, 12, 15, 19, 29, 0],
  35: [0, 0, 1, 1, 1, 3, 6, 10, 12, 15, 24, 0],
  50: [0, 0, 1, 1, 1, 3, 5, 8, 11, 13, 21, 31],
};

export interface ConduitResult {
  conduitMm: number | null;
  conduitInch: string | null;
  note?: string;
}

/** Smallest conduit (mm) that holds `count` conductors of `sizeSqmm`. */
export function conduitRecommend(
  cable: "THW" | "NYY",
  sizeSqmm: number,
  count: number
): ConduitResult {
  const table = cable === "THW" ? CONDUIT_THW : CONDUIT_NYY;
  const row = table[sizeSqmm];
  if (!row || count < 1) return { conduitMm: null, conduitInch: null, note: "ไม่มีข้อมูลขนาดสายนี้" };
  for (let i = 0; i < CONDUIT_SIZES_MM.length; i++) {
    if (row[i] >= count) {
      const mm = CONDUIT_SIZES_MM[i];
      return { conduitMm: mm, conduitInch: CONDUIT_SIZE_INCH[mm] };
    }
  }
  return { conduitMm: null, conduitInch: null, note: "เกินขนาดท่อในตาราง — ควรแยกท่อหรือปรึกษาช่าง" };
}

// ── Max cable length for a voltage-drop limit ────────────────────────────────
export interface MaxLengthResult {
  maxLengthM: number | null;
  mvPerAm: number | null;
  note?: string;
}

/** Max one-way length (m) so that %VD ≤ limit for given cable/size/current. */
export function maxCableLength(
  cable: CableType,
  phase: Phase,
  voltage: number,
  sizeSqmm: number,
  currentA: number,
  vdLimitPercent: number = VOLTAGE_DROP_LIMIT_PERCENT
): MaxLengthResult {
  const mv = voltageDropMvAm(cable, phase, sizeSqmm);
  if (mv == null) return { maxLengthM: null, mvPerAm: null, note: "ไม่มีข้อมูลสายนี้" };
  if (!(currentA > 0)) return { maxLengthM: null, mvPerAm: mv, note: "กระแสต้องมากกว่า 0" };
  const vdVolts = (vdLimitPercent / 100) * voltage;
  const meters = (vdVolts / (mv * currentA)) * 1000;
  return { maxLengthM: Math.floor(meters), mvPerAm: mv };
}

// ── Check an existing circuit (inspection / troubleshooting) ──────────────────
export interface CheckInput {
  phase: Phase;
  voltage: number;
  cableType: CableType;
  installGroup: InstallGroup;
  ambientTempC: number;
  groupingCircuits: number;
  lengthM: number;
  loadCurrentA: number;     // measured or computed total load current
  cableSizeSqmm: number;    // the wire already installed
  breakerA: number;         // the breaker already installed
}
export interface CheckItem { label: string; ok: boolean; detail: string }
export interface CheckResult {
  status: "PASS" | "WARN" | "FAIL";
  items: CheckItem[];
  deratedAmpacityA: number | null;
  voltageDropPercent: number | null;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// ── Meter size + main service (การไฟฟ้า Table 1.1 + verified ampacity engine) ──
// Meter size → max load (A). [VERIFIED: EIT 2564 Table 1.1, MEA — PEA ใกล้เคียง]
interface MeterRow { meter: string; maxA: number }
const METERS_1P: MeterRow[] = [
  { meter: "5(15)", maxA: 10 }, { meter: "15(45)", maxA: 30 }, { meter: "30(100)", maxA: 75 },
];
const METERS_3P: MeterRow[] = [
  { meter: "15(45)", maxA: 30 }, { meter: "30(100)", maxA: 75 }, { meter: "50(150)", maxA: 100 },
  { meter: "200", maxA: 200 }, { meter: "400", maxA: 400 },
];
// Main-breaker frames (incl. sizes above per-circuit range, for whole-service sizing).
const MAIN_BREAKERS = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 400, 500, 630, 800];

export interface MainServiceResult {
  meter: string | null;      // recommended utility meter size
  breakerA: number | null;   // main breaker
  wireSqmm: number | null;   // main conductor (THW in conduit) — null if beyond app scope
  loadCurrentA: number;
  note?: string;
}

/** Recommend meter + main breaker + main wire from a total service load current. */
export function mainService(phase: Phase, loadA: number): MainServiceResult {
  const meters = phase === "1P" ? METERS_1P : METERS_3P;
  const meter = meters.find((m) => m.maxA >= loadA)?.meter ?? null;

  const breakerA = MAIN_BREAKERS.find((b) => b >= loadA) ?? null;

  let wireSqmm: number | null = null;
  let note: string | undefined;
  if (breakerA != null) {
    for (const size of CABLE_SIZES_SQMM) {
      // main conductor: THW, in conduit (group 2), 40°C, single circuit
      const { amps } = lookupAmpacity("THW", 2, phase, size);
      if (amps != null && amps >= breakerA) { wireSqmm = size; break; }
    }
    if (wireSqmm == null) note = "สายเมนเกิน 50 ตร.มม. (เกินขอบเขตแอป) — ควรปรึกษาช่าง/การไฟฟ้า";
  }
  if (meter == null) note = "โหลดสูงเกินขนาดมิเตอร์มาตรฐาน — ปรึกษาการไฟฟ้า";

  return { meter, breakerA, wireSqmm, loadCurrentA: round(loadA, 1), note };
}

// ── Unit conversions (pure) ──────────────────────────────────────────────────
const HP_TO_KW = 0.746;
export const hpToKw = (hp: number) => round(hp * HP_TO_KW, 3);
export const kwToHp = (kw: number) => round(kw / HP_TO_KW, 3);
/** Power (W) → current (A). */
export function wattToAmp(watt: number, phase: Phase, voltage: number, pf: number): number {
  const p = pf > 0 ? pf : 1;
  return round(phase === "1P" ? watt / (voltage * p) : watt / (SQRT3 * voltage * p), 2);
}
/** Current (A) → power (W). */
export function ampToWatt(amp: number, phase: Phase, voltage: number, pf: number): number {
  const p = pf > 0 ? pf : 1;
  return round(phase === "1P" ? amp * voltage * p : amp * SQRT3 * voltage * p, 0);
}

export function checkCircuit(inp: CheckInput): CheckResult {
  const ca = ambientFactor(inp.ambientTempC, inp.installGroup);
  const cg = groupingFactor(inp.groupingCircuits);
  const { amps } = lookupAmpacity(inp.cableType, inp.installGroup, inp.phase, inp.cableSizeSqmm);
  const iz = amps == null ? null : round(amps * ca * cg, 1);

  const mv = voltageDropMvAm(inp.cableType, inp.phase, inp.cableSizeSqmm);
  const vd = mv == null ? null : round(((mv * inp.loadCurrentA * inp.lengthM) / 1000 / inp.voltage) * 100, 2);

  const items: CheckItem[] = [];

  // 1. breaker vs load
  const bOk = inp.breakerA >= inp.loadCurrentA;
  items.push({
    label: "เบรกเกอร์รับโหลดได้",
    ok: bOk,
    detail: bOk
      ? `เบรกเกอร์ ${inp.breakerA}A ≥ โหลด ${round(inp.loadCurrentA, 1)}A`
      : `เบรกเกอร์ ${inp.breakerA}A เล็กกว่าโหลด ${round(inp.loadCurrentA, 1)}A (จะทริปบ่อย)`,
  });

  // 2. cable protected by breaker (safety-critical)
  const cOk = iz != null && iz >= inp.breakerA;
  items.push({
    label: "สายทนกระแสได้ ≥ เบรกเกอร์ (ปกป้องสาย)",
    ok: cOk,
    detail:
      iz == null
        ? "ไม่มีข้อมูลพิกัดสายชนิด/ขนาดนี้"
        : cOk
          ? `พิกัดสาย ${iz}A ≥ เบรกเกอร์ ${inp.breakerA}A`
          : `⚠️ พิกัดสาย ${iz}A ต่ำกว่าเบรกเกอร์ ${inp.breakerA}A — สายอาจไหม้ก่อนเบรกเกอร์ตัด`,
  });

  // 3. voltage drop
  const vOk = vd != null && vd <= VOLTAGE_DROP_LIMIT_PERCENT;
  items.push({
    label: `แรงดันตก ≤ ${VOLTAGE_DROP_LIMIT_PERCENT}%`,
    ok: vOk,
    detail: vd == null ? "ไม่มีข้อมูลแรงดันตกของสายนี้" : `แรงดันตก ${vd}%`,
  });

  // status: cable-protection failure = FAIL; other failures = WARN/FAIL
  let status: CheckResult["status"] = "PASS";
  if (!cOk) status = "FAIL";
  else if (!bOk || !vOk) status = "WARN";

  return { status, items, deratedAmpacityA: iz, voltageDropPercent: vd };
}
