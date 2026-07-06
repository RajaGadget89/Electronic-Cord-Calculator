import { test } from "node:test";
import assert from "node:assert/strict";
import {
  motorLookup,
  conduitRecommend,
  maxCableLength,
  checkCircuit,
} from "./tools";

// ── Motor tables (Appendix G) ────────────────────────────────────────────────
test("motor 1φ 5HP → FLC 29.3, CB 63, wire 10, ground 4 (G1/G2)", () => {
  const m = motorLookup("1P", "5")!;
  assert.equal(m.flcA, 29.3);
  assert.equal(m.breakerA, 63);
  assert.equal(m.wireSqmm, 10);
  assert.equal(m.groundSqmm, 4);
});
test("motor 3φ 10HP → FLC 17, CB 32, wire 4 (G3/G4)", () => {
  const m = motorLookup("3P", "10")!;
  assert.equal(m.flcA, 17.0);
  assert.equal(m.breakerA, 32);
  assert.equal(m.wireSqmm, 4);
});

// ── Conduit fill (Appendix C) ────────────────────────────────────────────────
test("conduit THW 2.5mm² × 5 → 15mm (½\")", () => {
  const c = conduitRecommend("THW", 2.5, 5);
  assert.equal(c.conduitMm, 15);
});
test("conduit THW 2.5mm² × 6 → 20mm (¾\")", () => {
  assert.equal(conduitRecommend("THW", 2.5, 6).conduitMm, 20);
});
test("conduit NYY 4mm² × 4 → 40mm (NYY มีเปลือกนอก ต้องท่อใหญ่กว่า THW)", () => {
  assert.equal(conduitRecommend("NYY", 4, 4).conduitMm, 40);
});

// ── Max cable length for 3% VD ───────────────────────────────────────────────
test("max length THW 1φ 2.5mm² @ 10A ≈ 38 m", () => {
  const r = maxCableLength("THW", "1P", 230, 2.5, 10);
  assert.equal(r.maxLengthM, 38);
});

// ── Check existing circuit ───────────────────────────────────────────────────
test("check: THW 2.5mm² + breaker 20A + 15A load → PASS", () => {
  const r = checkCircuit({
    phase: "1P", voltage: 230, cableType: "THW", installGroup: 2,
    ambientTempC: 40, groupingCircuits: 1, lengthM: 10,
    loadCurrentA: 15, cableSizeSqmm: 2.5, breakerA: 20,
  });
  assert.equal(r.status, "PASS");
});
test("check: THW 1.5mm² + breaker 20A → FAIL (cable not protected)", () => {
  const r = checkCircuit({
    phase: "1P", voltage: 230, cableType: "THW", installGroup: 2,
    ambientTempC: 40, groupingCircuits: 1, lengthM: 10,
    loadCurrentA: 12, cableSizeSqmm: 1.5, breakerA: 20,
  });
  assert.equal(r.status, "FAIL");
  assert.ok(r.items.some((i) => !i.ok && i.label.includes("ปกป้องสาย")));
});
