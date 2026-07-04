// ─────────────────────────────────────────────────────────────────────────────
// Calculation engine (pure functions). No UI, no I/O.
// Procedure per วสท. "ขั้นตอนการหาขนาดของสายไฟฟ้า" (8 steps):
//   IL → In → install group/table → Ca, Cg → It = In/(Ca·Cg) → pick size.
// Breaker protects cable:  In ≤ Iz(derated).
// ─────────────────────────────────────────────────────────────────────────────

import { CalcResult, JobInput, LoadItem, Phase } from "./types";
import {
  BREAKER_RATINGS_A,
  CABLE_SIZES_SQMM,
  CABLE_SPECS,
  VOLTAGE_DROP_DATA_AVAILABLE,
  VOLTAGE_DROP_LIMIT_PERCENT,
  ambientFactor,
  equipmentGroundSize,
  groupingFactor,
  lookupAmpacity,
  voltageDropMvAm,
} from "./data/wireData";

const SQRT3 = Math.sqrt(3);

/** Current (A) drawn by one load line item, including quantity. */
export function loadCurrentA(load: LoadItem, phase: Phase, voltage: number): number {
  const pf = load.pf > 0 ? load.pf : 1;
  let perUnitA: number;
  if (load.unit === "A") {
    perUnitA = load.value;
  } else {
    perUnitA = phase === "1P"
      ? load.value / (voltage * pf)
      : load.value / (SQRT3 * voltage * pf);
  }
  return perUnitA * Math.max(0, load.quantity);
}

/** Sum of all load currents (diversity factor = 1.0, per product spec). */
export function totalLoadCurrentA(input: JobInput): number {
  return input.loads.reduce(
    (sum, l) => sum + loadCurrentA(l, input.phase, input.voltage),
    0
  );
}

/** Smallest standard breaker rating ≥ load current. null if beyond frame range. */
export function selectBreakerA(loadA: number): number | null {
  for (const r of BREAKER_RATINGS_A) if (r >= loadA) return r;
  return null;
}

function validate(input: JobInput): string[] {
  const errors: string[] = [];
  if (!input.name || !input.name.trim()) errors.push("กรุณากรอกชื่องาน");
  if (!(input.voltage > 0)) errors.push("แรงดันไฟฟ้าต้องมากกว่า 0");
  if (!(input.lengthM > 0)) errors.push("ความยาวสายต้องมากกว่า 0 เมตร");
  if (!(input.ambientTempC > -50 && input.ambientTempC < 200))
    errors.push("อุณหภูมิโดยรอบไม่สมเหตุสมผล");
  if (!(input.groupingCircuits >= 1)) errors.push("จำนวนกลุ่มวงจรต้องอย่างน้อย 1");
  if (!input.loads.length) errors.push("ต้องมีโหลดอย่างน้อย 1 รายการ");
  input.loads.forEach((l, i) => {
    if (!(l.value > 0)) errors.push(`โหลดรายการที่ ${i + 1}: ค่าต้องมากกว่า 0`);
    if (!(l.quantity >= 1)) errors.push(`โหลดรายการที่ ${i + 1}: จำนวนต้องอย่างน้อย 1`);
    if (!(l.pf > 0 && l.pf <= 1)) errors.push(`โหลดรายการที่ ${i + 1}: ค่า pf ต้องอยู่ระหว่าง 0-1`);
  });
  return errors;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function calculate(input: JobInput): CalcResult {
  const cap = input.maxCableSizeSqmm ?? 50;
  const warnings: string[] = [];
  const errors = validate(input);

  const ca = ambientFactor(input.ambientTempC, input.installGroup);
  const cg = groupingFactor(input.groupingCircuits);

  const base: CalcResult = {
    status: "FAIL",
    totalCurrentA: 0,
    breakerA: null,
    cableSizeSqmm: null,
    groundSizeSqmm: null,
    baseAmpacityA: null,
    deratedAmpacityA: null,
    voltageDropPercent: null,
    ca,
    cg,
    warnings,
    errors,
    ampacityVerified: false,
    voltageDropAvailable: VOLTAGE_DROP_DATA_AVAILABLE,
  };

  if (errors.length) return base;

  const totalA = totalLoadCurrentA(input);
  base.totalCurrentA = round(totalA, 2);

  const breakerA = selectBreakerA(totalA);
  base.breakerA = breakerA;
  if (breakerA == null) {
    base.status = "FAIL";
    warnings.push(
      "โหลดสูงเกินพิกัดเบรกเกอร์มาตรฐานในแอป ควรปรึกษาช่างผู้ชำนาญการ " +
        "และพิจารณาอุปกรณ์เพิ่มเติม เช่น Magnetic Contactor, Overload Relay, Phase Protection"
    );
    return base;
  }

  // Equipment grounding conductor sized by breaker rating (วสท. 6-11).
  base.groundSizeSqmm = equipmentGroundSize(breakerA);

  // Required cable table-ampacity: It = In / (Ca·Cg).
  const requiredIt = breakerA / (ca * cg);

  // Voltage drop % for a given size at the total load current.
  const vdPercentFor = (size: number): number | null => {
    const mv = voltageDropMvAm(input.cableType, input.phase, size);
    if (mv == null) return null;
    return ((mv * totalA * input.lengthM) / 1000 / input.voltage) * 100;
  };

  const spec = CABLE_SPECS[input.cableType];
  let chosen: { size: number; baseA: number; verified: boolean; vdPct: number } | null = null;
  let sawPending = false;
  let vdLimited = false;

  // Pick the smallest size that satisfies BOTH ampacity and voltage-drop ≤ limit.
  for (const size of CABLE_SIZES_SQMM) {
    if (size > cap) break;
    if (size < spec.minSqmm || size > spec.maxSqmm) continue;
    const { amps, verified } = lookupAmpacity(input.cableType, input.installGroup, input.phase, size);
    if (amps == null) { sawPending = true; continue; }
    if (amps < requiredIt) continue; // ampacity insufficient → try larger
    const vd = vdPercentFor(size);
    if (vd != null && vd > VOLTAGE_DROP_LIMIT_PERCENT) { vdLimited = true; continue; } // upsize for VD
    chosen = { size, baseA: amps, verified, vdPct: round(vd ?? 0, 2) };
    break;
  }

  if (!chosen) {
    base.status = "FAIL";
    if (vdLimited) {
      warnings.push(
        `แรงดันตกเกิน ${VOLTAGE_DROP_LIMIT_PERCENT}% ในทุกขนาดสายที่รองรับ (ระยะสายไกลเกินไป) — ` +
          "แนะนำ: ลดระยะสาย / แยกวงจร / ใช้สายใหญ่กว่าขอบเขตแอป (ปรึกษาช่างผู้ชำนาญการ)"
      );
    } else if (sawPending) {
      warnings.push(
        "ยังไม่สามารถสรุปได้: ค่าพิกัดกระแสของสายชนิด/วิธีติดตั้งนี้บางขนาดยังไม่ยืนยัน (รอการตรวจสอบ)"
      );
      base.ampacityVerified = false;
    } else {
      warnings.push(
        `ไม่มีสายขนาด ≤ ${cap} ตร.มม. ที่รับกระแสได้ (ต้องการ ${round(requiredIt, 1)} A) — ` +
          "โหลดสูงเกินขอบเขตแอป ควรปรึกษาช่างผู้ชำนาญการ และพิจารณา Magnetic Contactor / Overload Relay / Phase Protection"
      );
    }
    return base;
  }

  base.cableSizeSqmm = chosen.size;
  // Grounding conductor need not be larger than the phase conductor.
  if (base.groundSizeSqmm != null) base.groundSizeSqmm = Math.min(base.groundSizeSqmm, chosen.size);
  base.baseAmpacityA = chosen.baseA;
  base.deratedAmpacityA = round(chosen.baseA * ca * cg, 2);
  base.ampacityVerified = chosen.verified;
  base.voltageDropPercent = chosen.vdPct;

  if (chosen.size >= cap) {
    warnings.push(
      `ใช้สายขนาดใหญ่สุดที่แอปรองรับ (${cap} ตร.มม.) — หากงานจริงต้องใหญ่กว่านี้ ควรปรึกษาช่างผู้ชำนาญการ`
    );
  }

  base.status = chosen.verified && VOLTAGE_DROP_DATA_AVAILABLE ? "PASS" : "WARN";
  return base;
}
