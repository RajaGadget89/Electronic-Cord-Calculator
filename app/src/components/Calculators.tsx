import { useState } from "react";
import type { Phase } from "../engine";
import { hpToKw, kwToHp, wattToAmp, ampToWatt } from "../engine";
import { Field, inputCls, inputBase } from "./Field";

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const fmt = (n: number, d = 2) => (Number.isFinite(n) ? String(Math.round(n * 10 ** d) / 10 ** d) : "-");

export default function Calculators({ onBack }: { onBack: () => void }) {
  // power convert
  const [hp, setHp] = useState("");
  const [kw, setKw] = useState("");
  const onHp = (v: string) => { setHp(v); const n = num(v); setKw(Number.isFinite(n) ? String(hpToKw(n)) : ""); };
  const onKw = (v: string) => { setKw(v); const n = num(v); setHp(Number.isFinite(n) ? String(kwToHp(n)) : ""); };

  // W ↔ A
  const [phase, setPhase] = useState<Phase>("1P");
  const [pf, setPf] = useState("1");
  const [wa, setWa] = useState<"W" | "A">("W");
  const [waVal, setWaVal] = useState("");
  const V = phase === "1P" ? 230 : 400;
  const waOut = (() => {
    const n = num(waVal);
    if (!Number.isFinite(n) || n <= 0) return null;
    const p = num(pf) > 0 ? num(pf) : 1;
    return wa === "W" ? wattToAmp(n, phase, V, p) : ampToWatt(n, phase, V, p);
  })();

  // bill
  const [watt, setWatt] = useState("");
  const [hrs, setHrs] = useState("");
  const [days, setDays] = useState("30");
  const [rate, setRate] = useState("4.5");
  const kwh = (num(watt) / 1000) * num(hrs) * num(days);
  const cost = kwh * num(rate);

  return (
    <div className="space-y-5">
      <h2 className="text-[16px] font-medium text-ink">เครื่องคิดเลขประจำวัน</h2>

      {/* Power convert */}
      <div className="rounded-2xl border border-line bg-panel/40 p-4">
        <h3 className="text-[15px] font-medium text-cyan">แปลง แรงม้า ↔ กิโลวัตต์</h3>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Field label="แรงม้า (HP)"><input type="number" inputMode="decimal" className={inputCls} value={hp} onChange={(e) => onHp(e.target.value)} placeholder="เช่น 2" /></Field>
          <Field label="กิโลวัตต์ (kW)"><input type="number" inputMode="decimal" className={inputCls} value={kw} onChange={(e) => onKw(e.target.value)} placeholder="เช่น 1.5" /></Field>
        </div>
        <p className="mt-1 text-[11px] text-sub">1 HP ≈ 0.746 kW</p>
      </div>

      {/* W ↔ A */}
      <div className="rounded-2xl border border-line bg-panel/40 p-4">
        <h3 className="text-[15px] font-medium text-cyan">แปลง วัตต์ ↔ แอมป์</h3>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Field label="ระบบไฟ"><select className={inputCls} value={phase} onChange={(e) => setPhase(e.target.value as Phase)}><option value="1P">1 เฟส (230V)</option><option value="3P">3 เฟส (400V)</option></select></Field>
          <Field label="ค่า pf" help="หลอด/ฮีตเตอร์ = 1 · มอเตอร์/แอร์ ≈ 0.8"><input type="number" step="0.01" className={inputCls} value={pf} onChange={(e) => setPf(e.target.value)} /></Field>
        </div>
        <div className="mt-2 flex gap-2">
          <input type="number" inputMode="decimal" className={`${inputBase} min-w-0 flex-1`} value={waVal} onChange={(e) => setWaVal(e.target.value)} placeholder={wa === "W" ? "เช่น 2000" : "เช่น 9"} />
          <select className={`${inputBase} w-[84px] shrink-0`} value={wa} onChange={(e) => setWa(e.target.value as "W" | "A")}><option value="W">วัตต์</option><option value="A">แอมป์</option></select>
        </div>
        <div className="mt-3 rounded-xl bg-base p-3 text-center">
          {waOut != null ? (
            <div><span className="text-2xl font-semibold text-cyan">{fmt(waOut, wa === "W" ? 2 : 0)}</span><span className="text-ink"> {wa === "W" ? "แอมป์" : "วัตต์"}</span></div>
          ) : (<div className="text-sm text-sub">ใส่ค่าเพื่อแปลง</div>)}
        </div>
      </div>

      {/* Bill */}
      <div className="rounded-2xl border border-line bg-panel/40 p-4">
        <h3 className="text-[15px] font-medium text-cyan">ประมาณค่าไฟ</h3>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Field label="กำลังไฟ (วัตต์)"><input type="number" inputMode="decimal" className={inputCls} value={watt} onChange={(e) => setWatt(e.target.value)} placeholder="เช่น 1000" /></Field>
          <Field label="ชั่วโมง/วัน"><input type="number" inputMode="decimal" className={inputCls} value={hrs} onChange={(e) => setHrs(e.target.value)} placeholder="เช่น 8" /></Field>
          <Field label="จำนวนวัน"><input type="number" inputMode="numeric" className={inputCls} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
          <Field label="อัตรา (บาท/หน่วย)" help="ค่าไฟต่อหน่วย (kWh) ประมาณ 4–5 บาท ปรับตามบิลจริง"><input type="number" step="0.01" className={inputCls} value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-base p-3 text-center"><div className="text-[11px] text-sub">หน่วยไฟ</div><div className="text-lg font-medium text-ink">{fmt(kwh, 1)} kWh</div></div>
          <div className="rounded-xl bg-base p-3 text-center"><div className="text-[11px] text-sub">ค่าไฟ (ประมาณ)</div><div className="text-lg font-medium text-cyan">{fmt(cost, 0)} บาท</div></div>
        </div>
        <p className="mt-1 text-[11px] text-sub">ประมาณการเบื้องต้น ไม่รวมค่า Ft/ภาษี/ค่าบริการ</p>
      </div>

      <button onClick={onBack} className="w-full py-2 text-sm text-sub underline">← กลับหน้าแรก</button>
    </div>
  );
}
