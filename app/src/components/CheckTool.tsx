import { useState } from "react";
import type { CableType, InstallGroup, Phase } from "../engine";
import { CABLE_SIZES_SQMM, CABLE_SPECS, DEFAULT_INSTALL_GROUP, checkCircuit } from "../engine";
import { Field, inputCls } from "./Field";
import CurrentField from "./CurrentField";

const CABLES: CableType[] = ["THW", "VAF", "VCT", "NYY"];
const BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
const GROUPS_FOR: Record<CableType, InstallGroup[]> = { THW: [2, 1, 4], VAF: [3], VCT: [4, 2], NYY: [6, 5, 2] };
const GROUP_LABEL: Record<InstallGroup, string> = {
  1: "ร้อยท่อในฝ้า", 2: "ร้อยท่อเกาะผนัง", 3: "เดินเกาะผนัง", 4: "บนลูกถ้วยในอากาศ", 5: "ร้อยท่อฝังดิน", 6: "ฝังดินโดยตรง", 7: "บนรางเคเบิล",
};
const STATUS: Record<string, { label: string; cls: string; ring: string }> = {
  PASS: { label: "ปลอดภัย (ผ่าน)", cls: "text-pass", ring: "border-pass/40 bg-pass/10" },
  WARN: { label: "ควรระวัง", cls: "text-warn", ring: "border-warn/40 bg-warn/10" },
  FAIL: { label: "ไม่ปลอดภัย", cls: "text-fail", ring: "border-fail/40 bg-fail/10" },
};

export default function CheckTool({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("1P");
  const [cableType, setCableType] = useState<CableType>("THW");
  const [installGroup, setInstallGroup] = useState<InstallGroup>(2);
  const [ambientTempC, setAmbient] = useState(40);
  const [groupingCircuits, setGrouping] = useState(1);
  const [lengthM, setLength] = useState(10);
  const [loadCurrentA, setLoad] = useState(0);
  const [cableSizeSqmm, setSize] = useState(2.5);
  const [breakerA, setBreaker] = useState(16);
  const [res, setRes] = useState<ReturnType<typeof checkCircuit> | null>(null);

  const setCable = (c: CableType) => { setCableType(c); setInstallGroup(DEFAULT_INSTALL_GROUP[c]); };
  const run = () =>
    setRes(checkCircuit({
      phase, voltage: phase === "1P" ? 230 : 400, cableType, installGroup,
      ambientTempC, groupingCircuits, lengthM, loadCurrentA, cableSizeSqmm, breakerA,
    }));
  const s = res ? STATUS[res.status] : null;
  const ready = loadCurrentA > 0 && lengthM > 0;

  return (
    <div className="space-y-4">
      <h2 className="text-[16px] font-medium text-ink">โหมดตรวจสอบวงจร</h2>
      <p className="-mt-2 text-[12px] text-sub">มีสาย + เบรกเกอร์อยู่แล้ว โหลดเท่านี้ ปลอดภัยไหม (สำหรับตรวจ/แก้ของเดิม)</p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ระบบไฟ">
          <select className={inputCls} value={phase} onChange={(e) => setPhase(e.target.value as Phase)}>
            <option value="1P">1 เฟส (230V)</option><option value="3P">3 เฟส (400V)</option>
          </select>
        </Field>
        <Field label="ชนิดสาย" help="ชนิดสายที่เดินอยู่จริง — มีผลต่อพิกัดกระแสและตารางที่ใช้">
          <select className={inputCls} value={cableType} onChange={(e) => setCable(e.target.value as CableType)}>
            {CABLES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <p className="-mt-2 text-[12px] text-sub">{CABLE_SPECS[cableType].note}</p>

      <Field label="วิธีติดตั้ง" help="วิธีเดินสายจริง (ในท่อ/เกาะผนัง/ฝังดิน ฯลฯ) มีผลต่อพิกัดกระแสที่สายรับได้">
        <select className={inputCls} value={installGroup} onChange={(e) => setInstallGroup(Number(e.target.value) as InstallGroup)}>
          {GROUPS_FOR[cableType].map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ขนาดสายที่มี (ตร.มม.)" help="ขนาดสายที่ติดตั้งไปแล้วหน้างาน">
          <select className={inputCls} value={cableSizeSqmm} onChange={(e) => setSize(Number(e.target.value))}>
            {CABLE_SIZES_SQMM.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="เบรกเกอร์ที่มี (A)" help="พิกัดเบรกเกอร์ที่ติดตั้งไปแล้ว (ดูที่ตัวเบรกเกอร์)">
          <select className={inputCls} value={breakerA} onChange={(e) => setBreaker(Number(e.target.value))}>
            {BREAKERS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      </div>

      <CurrentField phase={phase} onAmps={setLoad} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="ความยาวสาย (ม.)" help="ระยะสายทางเดียว จากเบรกเกอร์ถึงโหลด">
          <input type="number" inputMode="decimal" className={inputCls} value={lengthM || ""} onChange={(e) => setLength(Number(e.target.value))} />
        </Field>
        <Field label="อุณหภูมิ (°C)" help="อุณหภูมิรอบสาย ค่าเริ่มต้น 40°C (ในฝ้าร้อนจัดใส่ 45–50)">
          <input type="number" inputMode="decimal" className={inputCls} value={ambientTempC} onChange={(e) => setAmbient(Number(e.target.value))} />
        </Field>
      </div>
      <Field label="กลุ่มวงจร" help="จำนวนวงจรที่เดินรวมในท่อเดียวกัน (วงจรนี้เดินท่อเดี่ยว = 1)">
        <input type="number" inputMode="numeric" className={inputCls} value={groupingCircuits} min={1} onChange={(e) => setGrouping(Number(e.target.value))} />
      </Field>

      <button onClick={run} disabled={!ready}
        className={`w-full rounded-xl py-3 text-[15px] font-semibold active:scale-95 ${ready ? "bg-cyan text-[#062330]" : "cursor-not-allowed bg-panel text-sub"}`}>
        ตรวจสอบ
      </button>

      {res && s && (
        <div className={`rounded-2xl border p-4 ${s.ring}`}>
          <div className={`inline-flex items-center gap-2 rounded-full border border-current/30 px-3 py-1 text-sm font-medium ${s.cls}`}>● {s.label}</div>
          <ul className="mt-3 space-y-2">
            {res.items.map((it, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className={it.ok ? "text-pass" : "text-fail"}>{it.ok ? "✓" : "✗"}</span>
                <span className="text-ink/90">{it.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={onBack} className="w-full py-2 text-sm text-sub underline">← กลับหน้าแรก</button>
    </div>
  );
}
