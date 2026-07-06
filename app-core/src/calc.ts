// ─────────────────────────────────────────────────────────────────────────────
// Calculation engine (pure functions). No UI, no I/O.
// Procedure per วสท. "ขั้นตอนการกำหนดขนาดสายไฟฟ้า" (หนังสือหน้า 54):
//   IL → (กฎมอเตอร์ 125%) → In → เลือกตารางตามกลุ่มติดตั้ง → Ca, Cg →
//   It = In/(Ca·Cg) → เลือกขนาดเล็กสุดที่ผ่านทั้งพิกัดกระแสและแรงดันตก ≤ 3%
// Breaker protects cable:  In ≤ Iz(derated).
// ─────────────────────────────────────────────────────────────────────────────

import { CalcResult, JobInput, LoadItem, Phase } from "./types";
import {
  BREAKER_RATINGS_A,
  CABLE_SIZES_SQMM,
  CABLE_SPECS,
  MAX_AMBIENT_C,
  MOTOR_FACTOR,
  MOTOR_TYPE_IDS,
  VOLTAGE_DROP_DATA_AVAILABLE,
  VOLTAGE_DROP_LIMIT_PERCENT,
  ambientFactor,
  equipmentGroundSize,
  groupingFactorEx,
  lookupAmpacity,
  voltageDropMvAm,
} from "./data/wireData";

const SQRT3 = Math.sqrt(3);

/** โหลดรายการนี้เป็นมอเตอร์หรือไม่ (fallback จาก preset id สำหรับงานที่บันทึกไว้เดิม) */
export function isMotorLoad(load: LoadItem): boolean {
  return load.isMotor ?? MOTOR_TYPE_IDS.has(load.loadTypeId);
}

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

/**
 * กระแสออกแบบ (design current) สำหรับกำหนดเบรกเกอร์และขนาดสาย:
 * โหลดมอเตอร์คูณ 1.25 ตาม วสท. ข้อ 6.1.1 (สายมอเตอร์ต้องรับ ≥ 1.25×FLC)
 * โหลดอื่นคิด 100%. การคูณ 1.25 กับมอเตอร์ทุกตัวให้ผล ≥ ข้อกำหนด
 * (มาตรฐาน: 1.25×ตัวใหญ่สุด + ตัวอื่น 100%) จึงอยู่ฝั่งปลอดภัยเสมอ
 */
export function designCurrentA(input: JobInput): number {
  return input.loads.reduce((sum, l) => {
    const i = loadCurrentA(l, input.phase, input.voltage);
    return sum + (isMotorLoad(l) ? MOTOR_FACTOR * i : i);
  }, 0);
}

/** Smallest standard breaker rating ≥ design current. null if beyond frame range. */
export function selectBreakerA(loadA: number): number | null {
  for (const r of BREAKER_RATINGS_A) if (r >= loadA) return r;
  return null;
}

function validate(input: JobInput): string[] {
  const errors: string[] = [];
  if (!input.name || !input.name.trim()) errors.push("กรุณากรอกชื่องาน");
  if (!(input.voltage > 0)) errors.push("แรงดันไฟฟ้าต้องมากกว่า 0");
  if (!(input.lengthM > 0)) errors.push("ความยาวสายต้องมากกว่า 0 เมตร");
  if (!(input.ambientTempC > -50)) errors.push("อุณหภูมิโดยรอบไม่สมเหตุสมผล");
  // ตาราง 5-43/5-44: เกิน 60°C ไม่มีตัวคูณสำหรับสาย PVC 70°C = มาตรฐานห้ามใช้
  if (input.ambientTempC > MAX_AMBIENT_C)
    errors.push(
      `อุณหภูมิโดยรอบเกิน ${MAX_AMBIENT_C}°C — สายฉนวน PVC 70°C ใช้งานไม่ได้ตามมาตรฐาน (ตาราง 5-43/5-44) ` +
        "ต้องใช้สายชนิดทนอุณหภูมิสูงและให้วิศวกรออกแบบ"
    );
  if (!(input.groupingCircuits >= 1)) errors.push("จำนวนกลุ่มวงจรต้องอย่างน้อย 1");
  else if (!Number.isInteger(input.groupingCircuits))
    errors.push("จำนวนกลุ่มวงจรต้องเป็นจำนวนเต็ม");
  // VAF เป็นสายแบน 2 แกน (+ดิน) สำหรับวงจร 1 เฟสเท่านั้น (ตาราง 5-21)
  if (input.cableType === "VAF" && input.phase === "3P")
    errors.push("สาย VAF เป็นสายแบนสำหรับวงจร 1 เฟสเท่านั้น ใช้กับระบบ 3 เฟสไม่ได้ — เลือกสายชนิดอื่น เช่น NYY");
  if (!input.loads.length) errors.push("ต้องมีโหลดอย่างน้อย 1 รายการ");
  input.loads.forEach((l, i) => {
    if (!(l.value > 0 && Number.isFinite(l.value)))
      errors.push(`โหลดรายการที่ ${i + 1}: ค่าต้องมากกว่า 0`);
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
  const { cg, withinTable: cgWithinTable } = groupingFactorEx(
    input.groupingCircuits,
    input.installGroup
  );

  const base: CalcResult = {
    status: "FAIL",
    totalCurrentA: 0,
    designCurrentA: 0,
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
  const designA = designCurrentA(input);
  base.totalCurrentA = round(totalA, 2);
  base.designCurrentA = round(designA, 2);

  if (designA > totalA)
    warnings.push(
      `มีโหลดมอเตอร์ในวงจร — ใช้กฎ 125% ตามมาตรฐาน (วสท. ข้อ 6.1.1): ` +
        `กระแสออกแบบ ${round(designA, 1)} A จากโหลดจริง ${round(totalA, 1)} A ` +
        "(มอเตอร์สตาร์ทหนัก/สตาร์ทบ่อย ควรพิจารณาอุปกรณ์ช่วยสตาร์ทเพิ่มเติม)"
    );

  if (!cgWithinTable)
    warnings.push(
      "จำนวนกลุ่มวงจรเกินขอบเขตตารางปรับค่าของมาตรฐาน — ใช้ตัวคูณต่ำสุดของตารางแทน " +
        "ผลลัพธ์เป็นการประมาณ ควรปรึกษาวิศวกรผู้ชำนาญการ"
    );

  const breakerA = selectBreakerA(designA);
  base.breakerA = breakerA;
  if (breakerA == null) {
    base.status = "FAIL";
    warnings.push(
      "โหลดสูงเกินพิกัดเบรกเกอร์มาตรฐานในแอป ควรปรึกษาช่างผู้ชำนาญการ " +
        "และพิจารณาอุปกรณ์เพิ่มเติม เช่น Magnetic Contactor, Overload Relay, Phase Protection"
    );
    return base;
  }

  // Equipment grounding conductor sized by breaker rating (วสท. ตารางที่ 4-2).
  base.groundSizeSqmm = equipmentGroundSize(breakerA);

  // Required cable table-ampacity: It = In / (Ca·Cg).
  const requiredIt = breakerA / (ca * cg);

  // Voltage drop % ที่กระแสโหลดจริง (ตามวิธีในหนังสือ ตัวอย่าง 9.1 ใช้กระแสโหลด)
  const vdPercentFor = (size: number): number | null => {
    const mv = voltageDropMvAm(input.cableType, input.phase, size);
    if (mv == null) return null;
    return ((mv * totalA * input.lengthM) / 1000 / input.voltage) * 100;
  };

  const spec = CABLE_SPECS[input.cableType];
  let chosen: { size: number; baseA: number; verified: boolean; vdPct: number | null } | null = null;
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
    chosen = { size, baseA: amps, verified, vdPct: vd == null ? null : round(vd, 2) };
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
  // Grounding conductor need not be larger than the phase conductor (หนังสือหน้า 113).
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

  const vdKnown = chosen.vdPct != null && VOLTAGE_DROP_DATA_AVAILABLE;
  base.status = chosen.verified && vdKnown && cgWithinTable ? "PASS" : "WARN";
  return base;
}
