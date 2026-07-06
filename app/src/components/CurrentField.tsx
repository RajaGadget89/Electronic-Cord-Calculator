import { useEffect, useState } from "react";
import type { Phase } from "../engine";
import { Field, inputCls } from "./Field";

const SQRT3 = Math.sqrt(3);

/** Current input that accepts Amps or Watts (converts W→A using pf). */
export default function CurrentField({
  phase,
  label = "กระแสโหลด",
  help,
  onAmps,
}: {
  phase: Phase;
  label?: string;
  help?: string;
  onAmps: (a: number) => void;
}) {
  const [unit, setUnit] = useState<"A" | "W">("A");
  const [raw, setRaw] = useState("");
  const [pf, setPf] = useState("1");
  const voltage = phase === "1P" ? 230 : 400;

  useEffect(() => {
    const v = parseFloat(raw);
    if (!(v > 0)) return onAmps(0);
    if (unit === "A") return onAmps(v);
    const p = parseFloat(pf) > 0 ? parseFloat(pf) : 1;
    const a = phase === "1P" ? v / (voltage * p) : v / (SQRT3 * voltage * p);
    onAmps(a);
  }, [raw, unit, pf, phase, voltage, onAmps]);

  const helpText =
    help ??
    "ใส่เป็นแอมป์ (A) หรือวัตต์ (W) ก็ได้ — ถ้าเลือก W ระบบจะแปลงเป็นแอมป์ให้โดยใช้ค่า pf (หลอด/ฮีตเตอร์ = 1, มอเตอร์/แอร์ ≈ 0.8)";

  return (
    <Field label={`${label} (${unit})`} help={helpText}>
      <div className="flex gap-2">
        <select className={`${inputCls} w-[92px]`} value={unit} onChange={(e) => setUnit(e.target.value as "A" | "W")}>
          <option value="A">แอมป์</option>
          <option value="W">วัตต์</option>
        </select>
        <input
          type="number"
          inputMode="decimal"
          className={`${inputCls} flex-1`}
          placeholder={unit === "A" ? "เช่น 12" : "เช่น 2000"}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
      </div>
      {unit === "W" && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[12px] text-sub">ค่า pf</span>
          <input
            type="number"
            step="0.01"
            className={`${inputCls} w-[100px]`}
            value={pf}
            onChange={(e) => setPf(e.target.value)}
          />
          <span className="text-[11px] text-sub">({phase === "1P" ? "230V" : "400V 3φ"})</span>
        </div>
      )}
    </Field>
  );
}
