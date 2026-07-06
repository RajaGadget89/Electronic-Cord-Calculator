import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, designCurrentA, loadCurrentA, selectBreakerA, totalLoadCurrentA } from "./calc";
import { ambientFactor, groupingFactor, lookupAmpacity } from "./data/wireData";
import { JobInput, LoadItem } from "./types";

function job(partial: Partial<JobInput>): JobInput {
  return {
    name: "test",
    phase: "1P",
    voltage: 230,
    cableType: "THW",
    installGroup: 2,
    lengthM: 10,
    ambientTempC: 40,
    groupingCircuits: 1,
    maxCableSizeSqmm: 50,
    loads: [],
    ...partial,
  };
}
const L = (o: Partial<LoadItem>): LoadItem => ({
  loadTypeId: "x", label: "x", unit: "W", value: 100, quantity: 1, pf: 1, ...o,
});

// ── Derating factor lookups (Table 5-43 / 5-8) ───────────────────────────────
test("ambient factor: 40C in-air = 1.0, 45C = 0.91", () => {
  assert.equal(ambientFactor(40, 2), 1.0);
  assert.equal(ambientFactor(45, 2), 0.91);
  assert.equal(ambientFactor(35, 2), 1.08);
});
test("ambient factor: buried group uses 30C base table", () => {
  assert.equal(ambientFactor(30, 6), 1.0);
  assert.equal(ambientFactor(40, 6), 0.87);
});
test("ambient > 60C is rejected (PVC not permitted per Table 5-43)", () => {
  const r = calculate(job({ ambientTempC: 61, loads: [L({ unit: "A", value: 10 })] }));
  assert.equal(r.status, "FAIL");
  assert.ok(r.errors.some((e) => e.includes("60")));
});
test("grouping factor: Table 5-8 col 1 (in raceway, groups 1-2)", () => {
  assert.equal(groupingFactor(1, 2), 1.0);
  assert.equal(groupingFactor(2, 2), 0.8);
  assert.equal(groupingFactor(3, 2), 0.7);
});
test("grouping factor: Table 5-8 col 2 (clipped to wall, group 3)", () => {
  assert.equal(groupingFactor(2, 3), 0.85);
  assert.equal(groupingFactor(3, 3), 0.79);
  assert.equal(groupingFactor(6, 3), 0.72);
});
test("grouping factor: Table 5-45 (direct buried, group 6, touching)", () => {
  assert.equal(groupingFactor(2, 6), 0.75);
  assert.equal(groupingFactor(3, 6), 0.65);
  assert.equal(groupingFactor(6, 6), 0.5);
});
test("grouping factor: Table 5-46 (buried conduit, group 5, touching)", () => {
  assert.equal(groupingFactor(2, 5), 0.85);
  assert.equal(groupingFactor(6, 5), 0.6);
});
test("non-integer circuit groups → validation error", () => {
  const r = calculate(job({ groupingCircuits: 2.5, loads: [L({ unit: "A", value: 10 })] }));
  assert.ok(r.errors.some((e) => e.includes("จำนวนเต็ม")));
});

// ── Current conversion ───────────────────────────────────────────────────────
test("watt→amp 1φ: 2400W/230V/pf1 ≈ 10.43A", () => {
  const i = loadCurrentA(L({ unit: "W", value: 200, quantity: 12, pf: 1 }), "1P", 230);
  assert.ok(Math.abs(i - 10.43) < 0.02);
});
test("watt→amp 3φ: 10kW/400V/pf0.8 ≈ 18.04A", () => {
  const i = loadCurrentA(L({ unit: "W", value: 10000, quantity: 1, pf: 0.8 }), "3P", 400);
  assert.ok(Math.abs(i - 18.04) < 0.05);
});
test("amp input passes through × quantity", () => {
  assert.equal(loadCurrentA(L({ unit: "A", value: 5, quantity: 3 }), "1P", 230), 15);
});

// ── Motor 125% rule (วสท. ข้อ 6.1.1) ─────────────────────────────────────────
test("motor load design current = 1.25 × FLC", () => {
  const j = job({ loads: [L({ unit: "A", value: 40, isMotor: true })] });
  assert.equal(totalLoadCurrentA(j), 40);
  assert.equal(designCurrentA(j), 50);
});
test("legacy saved job: motor inferred from preset id (pump)", () => {
  const j = job({ loads: [L({ unit: "A", value: 40, loadTypeId: "pump" })] });
  assert.equal(designCurrentA(j), 50);
});
test("motor FLC 40A → cable sized for ≥50A: 16mm² (60A), not 10mm²", () => {
  const r = calculate(job({
    cableType: "NYY", installGroup: 2,
    loads: [L({ unit: "A", value: 40, loadTypeId: "pump", pf: 0.8 })],
  }));
  assert.equal(r.breakerA, 50);
  assert.equal(r.cableSizeSqmm, 16); // NYY multi g2 1P: 10mm²=45A < 50 → 16mm²=60A
  assert.ok((r.baseAmpacityA ?? 0) >= 50);
  assert.ok(r.warnings.some((w) => w.includes("125%")));
});
test("non-motor load: no 125% factor", () => {
  const j = job({ loads: [L({ unit: "A", value: 40, loadTypeId: "heater" })] });
  assert.equal(designCurrentA(j), 40);
});

// ── Breaker selection ────────────────────────────────────────────────────────
test("breaker = smallest standard rating ≥ design current", () => {
  assert.equal(selectBreakerA(10.43), 16);
  assert.equal(selectBreakerA(16), 16);
  assert.equal(selectBreakerA(17), 20);
  assert.equal(selectBreakerA(200), null); // beyond frame → handled as professional referral
});

// ── Official worked example 2.1 (ลือชัย หน้า 57) ─────────────────────────────
// 1φ 230V, 12 lamps × 200VA, IEC01 in conduit, 40°C → 2.5mm² (21A), CB 16A.
test("worked example 2.1 → 2.5 sqmm, breaker 16A, base 21A", () => {
  const r = calculate(job({
    phase: "1P", voltage: 230, cableType: "THW", installGroup: 2, ambientTempC: 40,
    loads: [L({ unit: "W", value: 200, quantity: 12, pf: 1 })],
  }));
  assert.equal(r.breakerA, 16);
  assert.equal(r.cableSizeSqmm, 2.5);
  assert.equal(r.baseAmpacityA, 21);
  assert.equal(r.ampacityVerified, true);
  assert.ok(Math.abs(r.totalCurrentA - 10.43) < 0.02);
});

// ── Official worked example 2.2 (หน้า 58-59): NYY 2 แกน, 45°C, 2 วงจรรวมท่อ ──
test("worked example 2.2 → Ca 0.91, Cg 0.8; 32A→10mm² (45A); 40A→16mm² (60A)", () => {
  const mk = (amps: number) => calculate(job({
    cableType: "NYY", installGroup: 2, ambientTempC: 45, groupingCircuits: 2, lengthM: 1,
    loads: [L({ unit: "A", value: amps })],
  }));
  const r1 = mk(32), r2 = mk(40);
  assert.equal(r1.ca, 0.91);
  assert.equal(r1.cg, 0.8);
  assert.equal(r1.breakerA, 32);
  assert.equal(r1.cableSizeSqmm, 10);
  assert.equal(r1.baseAmpacityA, 45);
  assert.equal(r2.cableSizeSqmm, 16);
  assert.equal(r2.baseAmpacityA, 60);
});

// ── worked example (grouping): In 16A, 3 circuits Cg=0.7 → 4mm² (28A) ─────────
test("worked example (grouping) → It=22.8A picks 4 sqmm (28A)", () => {
  const r = calculate(job({
    phase: "1P", cableType: "THW", installGroup: 2, ambientTempC: 40,
    groupingCircuits: 3,
    loads: [L({ unit: "A", value: 12, quantity: 1 })],
  }));
  assert.equal(r.breakerA, 16);
  assert.equal(r.cg, 0.7);
  assert.equal(r.cableSizeSqmm, 4);
  assert.equal(r.baseAmpacityA, 28);
});

// ── Safety invariant: breaker never exceeds derated cable ampacity ───────────
test("cable is protected: derated ampacity ≥ breaker when sized", () => {
  const r = calculate(job({
    phase: "1P", cableType: "THW", installGroup: 2, ambientTempC: 45,
    loads: [L({ unit: "A", value: 12, quantity: 1 })],
  }));
  if (r.cableSizeSqmm != null) {
    assert.ok(r.deratedAmpacityA! >= r.breakerA!, "derated ampacity must protect breaker");
  }
});

// ── Ampacity table coverage ──────────────────────────────────────────────────
test("Table 5-20: 40A 1φ THW in conduit → 10mm² (50A base)", () => {
  const r = calculate(job({
    phase: "1P", cableType: "THW", installGroup: 2, ambientTempC: 40,
    loads: [L({ unit: "A", value: 40, quantity: 1 })],
  }));
  assert.equal(r.breakerA, 40);
  assert.equal(r.cableSizeSqmm, 10);
  assert.equal(r.baseAmpacityA, 50);
  assert.equal(r.ampacityVerified, true);
});
test("Table 5-22: uses VERTICAL (lower) column for safety — 25mm² = 113A", () => {
  assert.equal(lookupAmpacity("THW", 4, "1P", 25).amps, 113);
  assert.equal(lookupAmpacity("THW", 4, "3P", 25).amps, 113);
  assert.equal(lookupAmpacity("NYY", 4, "1P", 10).amps, 56);
});
test("Table 5-26: VCT in air (group 4) — 10mm²: 51A (1φ/2-core), 47A (3φ/multi-core)", () => {
  assert.equal(lookupAmpacity("VCT", 4, "1P", 10).amps, 51);
  assert.equal(lookupAmpacity("VCT", 4, "3P", 10).amps, 47);
  const r = calculate(job({
    phase: "1P", cableType: "VCT", installGroup: 4, ambientTempC: 40,
    loads: [L({ unit: "A", value: 60, quantity: 1 })],
  }));
  assert.equal(r.breakerA, 63);
  assert.equal(r.cableSizeSqmm, 16); // 5-26: 16mm² = 73A ≥ 63
  assert.equal(r.baseAmpacityA, 73);
});
test("VCT in conduit (group 2) uses MULTI-core column of 5-20", () => {
  assert.equal(lookupAmpacity("VCT", 2, "1P", 10).amps, 45); // not 50 (single)
  assert.equal(lookupAmpacity("VCT", 2, "3P", 10).amps, 40);
});
test("Table 5-23: NYY direct-buried (group 6) uses 30°C base table + Ca", () => {
  const r = calculate(job({
    phase: "3P", voltage: 400, cableType: "NYY", installGroup: 6, ambientTempC: 30,
    loads: [L({ unit: "A", value: 40, quantity: 1 })],
  }));
  assert.equal(r.ca, 1.0); // 30°C is the base for buried
  assert.equal(r.cableSizeSqmm, 4); // g6 4mm² = 45A ≥ breaker 40
  assert.equal(r.baseAmpacityA, 45);
});
test("Table 5-21: VAF clipped wall (group 3) 1φ, 2.5mm²=23A", () => {
  const r = calculate(job({
    phase: "1P", cableType: "VAF", installGroup: 3, ambientTempC: 40,
    loads: [L({ unit: "A", value: 18, quantity: 1 })],
  }));
  assert.equal(r.breakerA, 20);
  assert.equal(r.cableSizeSqmm, 2.5);
  assert.equal(r.baseAmpacityA, 23);
});
test("VAF + 3-phase → explicit validation error (not a vague pending message)", () => {
  const r = calculate(job({
    phase: "3P", voltage: 400, cableType: "VAF", installGroup: 3,
    loads: [L({ unit: "A", value: 10 })],
  }));
  assert.equal(r.status, "FAIL");
  assert.ok(r.errors.some((e) => e.includes("VAF")));
  assert.ok(!r.warnings.some((w) => w.includes("รอการตรวจสอบ")));
});

// ── Scope guard: over-frame load refers to a professional ────────────────────
test("over-frame load → professional referral (magnetic/overload/phase)", () => {
  const r = calculate(job({
    phase: "3P", voltage: 400, cableType: "NYY", installGroup: 6,
    loads: [L({ unit: "A", value: 200, quantity: 1 })],
  }));
  assert.equal(r.status, "FAIL");
  assert.ok(r.warnings.some((w) => w.includes("Magnetic Contactor")));
});

// ── Voltage drop (บทที่ 9) ───────────────────────────────────────────────────
test("voltage drop computed and within limit → status PASS", () => {
  const r = calculate(job({
    phase: "1P", cableType: "THW", installGroup: 2, ambientTempC: 40, lengthM: 10,
    loads: [L({ unit: "W", value: 200, quantity: 12, pf: 1 })],
  }));
  assert.equal(r.status, "PASS");
  assert.ok(r.voltageDropPercent != null && r.voltageDropPercent < 3);
});
test("long run forces upsize for voltage drop (ampacity alone would pick 6mm²)", () => {
  const r = calculate(job({
    phase: "1P", cableType: "THW", installGroup: 2, ambientTempC: 40, lengthM: 60,
    loads: [L({ unit: "A", value: 30, quantity: 1 })],
  }));
  assert.equal(r.breakerA, 32);
  assert.equal(r.cableSizeSqmm, 16); // 6mm² ok on ampacity but fails 3% VD
  assert.ok(r.voltageDropPercent! <= 3);
});
test("VD% matches standard formula (1.5mm², 10A, 20m ≈ 2.52%)", () => {
  const r = calculate(job({
    phase: "1P", cableType: "THW", installGroup: 2, ambientTempC: 40, lengthM: 20,
    loads: [L({ unit: "A", value: 10, quantity: 1 })],
  }));
  // 10A→breaker10→1.5mm²(15A), mv=29: 29*10*20/1000/230*100 = 2.52%
  assert.equal(r.cableSizeSqmm, 1.5);
  assert.ok(Math.abs(r.voltageDropPercent! - 2.52) < 0.05);
});
// ── Official worked example 9.1 (หน้า 208): 50A, 120m → ต้อง 50mm², VD 2.42% ──
test("worked example 9.1: NYY 1φ 50A 120m → 50mm², VD ≈ 2.42%", () => {
  const r = calculate(job({
    cableType: "NYY", installGroup: 2, lengthM: 120,
    loads: [L({ unit: "A", value: 50 })],
  }));
  assert.equal(r.cableSizeSqmm, 50); // 25mm²→4.56%, 35mm²→3.26% เกิน 3%
  assert.ok(Math.abs(r.voltageDropPercent! - 2.42) < 0.03);
});

// ── Equipment grounding conductor (วสท. ตารางที่ 4-2 / หนังสือตาราง 4.2) ──────
test("ground sized by breaker per Table 4.2: 40A → 4mm²", () => {
  const r = calculate(job({
    phase: "1P", cableType: "THW", installGroup: 2, ambientTempC: 40, lengthM: 10,
    loads: [L({ unit: "A", value: 40, quantity: 1 })],
  }));
  assert.equal(r.breakerA, 40);
  assert.equal(r.cableSizeSqmm, 10);
  assert.equal(r.groundSizeSqmm, 4); // ตาราง 4.2: ≤40A → 4mm²
});
test("ground per Table 4.2 across breaker range", () => {
  const cases: Array<[number, number]> = [
    [10, 2.5], [16, 2.5], [20, 2.5], [25, 4], [32, 4], [40, 4],
    [50, 6], [63, 6], [80, 10], [100, 10], [125, 16],
  ];
  for (const [amps, ground] of cases) {
    const r = calculate(job({
      cableType: "NYY", installGroup: 2, lengthM: 1, maxCableSizeSqmm: 50,
      loads: [L({ unit: "A", value: amps })],
    }));
    if (r.cableSizeSqmm != null) {
      const expected = Math.min(ground, r.cableSizeSqmm);
      assert.equal(r.groundSizeSqmm, expected, `breaker ${r.breakerA}A`);
    }
  }
});
test("ground never exceeds phase conductor", () => {
  // tiny load: breaker 16A → table ground 2.5mm², phase 1.5mm² → cap to 1.5
  const r = calculate(job({
    phase: "1P", cableType: "THW", installGroup: 2, ambientTempC: 40, lengthM: 5,
    loads: [L({ unit: "A", value: 13, quantity: 1 })],
  }));
  assert.equal(r.breakerA, 16);
  assert.ok(r.groundSizeSqmm! <= r.cableSizeSqmm!);
});

// ── Input validation ─────────────────────────────────────────────────────────
test("empty loads → error", () => {
  const r = calculate(job({ loads: [] }));
  assert.ok(r.errors.some((e) => e.includes("โหลด")));
});
test("zero length → error", () => {
  const r = calculate(job({ lengthM: 0, loads: [L({ unit: "A", value: 5 })] }));
  assert.ok(r.errors.some((e) => e.includes("ความยาว")));
});
test("Infinity load value → error", () => {
  const r = calculate(job({ loads: [L({ unit: "W", value: Infinity })] }));
  assert.ok(r.errors.length > 0);
});
test("total current sums multiple loads", () => {
  const t = totalLoadCurrentA(job({
    phase: "1P", voltage: 230,
    loads: [L({ unit: "A", value: 5, quantity: 2 }), L({ unit: "A", value: 3, quantity: 1 })],
  }));
  assert.equal(t, 13);
});
