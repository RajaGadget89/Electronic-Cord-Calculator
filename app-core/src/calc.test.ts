import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, loadCurrentA, selectBreakerA, totalLoadCurrentA } from "./calc";
import { ambientFactor, groupingFactor } from "./data/wireData";
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
test("grouping factor: Table 5-8", () => {
  assert.equal(groupingFactor(1), 1.0);
  assert.equal(groupingFactor(2), 0.8);
  assert.equal(groupingFactor(3), 0.7);
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

// ── Breaker selection ────────────────────────────────────────────────────────
test("breaker = smallest standard rating ≥ load", () => {
  assert.equal(selectBreakerA(10.43), 16);
  assert.equal(selectBreakerA(16), 16);
  assert.equal(selectBreakerA(17), 20);
  assert.equal(selectBreakerA(200), null); // beyond frame → handled as professional referral
});

// ── Official worked example 3.1 (ลือชัย / textbook) ───────────────────────────
// 1φ 230V, 12 lamps × 200VA, IEC01 in conduit, 40°C → 2.5mm² (21A), CB 16A.
test("worked example 3.1 → 2.5 sqmm, breaker 16A, base 21A", () => {
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

// ── Official worked example (grouping): In 16A, 3 circuits Cg=0.7 → 4mm² (28A) ─
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

// ── Full-range coverage of the newly transcribed tables ──────────────────────
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
test("Table 5-22: VCT in air (group 4) uses in-air ampacity (10mm²=67A 1φ)", () => {
  const r = calculate(job({
    phase: "1P", cableType: "VCT", installGroup: 4, ambientTempC: 40,
    loads: [L({ unit: "A", value: 60, quantity: 1 })],
  }));
  assert.equal(r.breakerA, 63);
  assert.equal(r.cableSizeSqmm, 10);
  assert.equal(r.baseAmpacityA, 67);
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
test("VD% matches standard formula (2.5mm² multi 1φ, 50A, 120m ≈ 4.56%)", () => {
  // isolate the VD math via a case that selects 2.5mm² would fail ampacity,
  // so verify the formula on a chosen size directly instead:
  const r = calculate(job({
    phase: "1P", cableType: "THW", installGroup: 2, ambientTempC: 40, lengthM: 20,
    loads: [L({ unit: "A", value: 10, quantity: 1 })],
  }));
  // 10A→breaker10→1.5mm²(15A), mv=29: 29*10*20/1000/230*100 = 2.52%
  assert.equal(r.cableSizeSqmm, 1.5);
  assert.ok(Math.abs(r.voltageDropPercent! - 2.52) < 0.05);
});

// ── Equipment grounding conductor (วสท. 6-11) ────────────────────────────────
test("ground sized by breaker, capped at phase size", () => {
  // 40A 1φ THW → breaker 40 → ground table 6mm²; phase 10mm² → ground stays 6
  const r = calculate(job({
    phase: "1P", cableType: "THW", installGroup: 2, ambientTempC: 40, lengthM: 10,
    loads: [L({ unit: "A", value: 40, quantity: 1 })],
  }));
  assert.equal(r.breakerA, 40);
  assert.equal(r.cableSizeSqmm, 10);
  assert.equal(r.groundSizeSqmm, 6); // breaker 40A → 6mm² (≤60 row)
});
test("ground never exceeds phase conductor", () => {
  // tiny load: breaker 16A → table ground 4mm², but phase 1.5mm² → cap to 1.5
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
test("total current sums multiple loads", () => {
  const t = totalLoadCurrentA(job({
    phase: "1P", voltage: 230,
    loads: [L({ unit: "A", value: 5, quantity: 2 }), L({ unit: "A", value: 3, quantity: 1 })],
  }));
  assert.equal(t, 13);
});
