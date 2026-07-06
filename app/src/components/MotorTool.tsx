import { useState } from "react";
import type { Phase } from "../engine";
import { motorLookup, motorTable } from "../engine";

const inputCls = "w-full rounded-lg border border-line bg-base px-3 py-2.5 text-[15px] text-ink outline-none focus:border-cyan";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-base p-3">
      <div className="text-[11px] text-sub">{label}</div>
      <div className={`mt-1 text-lg font-medium ${accent ?? "text-ink"}`}>{value}</div>
    </div>
  );
}

export default function MotorTool({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("1P");
  const [hp, setHp] = useState<string>("1");
  const rows = motorTable(phase);
  const m = motorLookup(phase, hp) ?? rows[0];

  const setPhaseReset = (p: Phase) => {
    setPhase(p);
    if (!motorTable(p).some((r) => r.hp === hp)) setHp(motorTable(p)[0].hp);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-[16px] font-medium text-ink">โหมดปั๊ม / มอเตอร์</h2>
      <p className="-mt-2 text-[12px] text-sub">เลือกแรงม้า → แนะนำสาย เบรกเกอร์ สายดิน และท่อ (ตามภาคผนวก G ของ วสท.)</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[13px] text-sub">ระบบไฟ</label>
          <select className={inputCls} value={phase} onChange={(e) => setPhaseReset(e.target.value as Phase)}>
            <option value="1P">1 เฟส (230V)</option>
            <option value="3P">3 เฟส (400V)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[13px] text-sub">ขนาดมอเตอร์</label>
          <select className={inputCls} value={hp} onChange={(e) => setHp(e.target.value)}>
            {rows.map((r) => (
              <option key={r.hp} value={r.hp}>{r.hp} HP ({r.kw} kW)</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-cyan/30 bg-cyan/5 p-4">
        <div className="text-sm text-sub">มอเตอร์ {m.hp} HP · {m.kw} kW · {phase === "1P" ? "1 เฟส" : "3 เฟส"}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-cyan">{m.wireSqmm}</span>
          <span className="text-ink">ตร.มม. (สายวงจร)</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Stat label="กระแสมอเตอร์ (FLC)" value={`${m.flcA} A`} />
          <Stat label="เบรกเกอร์" value={`${m.breakerA}${m.breakerAltA ? ` / ${m.breakerAltA}` : ""} A`} accent="text-cyan" />
          <Stat label="สายดิน" value={`${m.groundSqmm} ตร.มม.`} accent="text-pass" />
          <Stat label="ท่อร้อยสาย" value={`${m.conduitTHWmm} มม. (THW)`} />
        </div>
      </div>

      <div className="rounded-xl border border-warn/30 bg-warn/5 p-3 text-[12px] leading-relaxed text-ink/80">
        ⚠️ ค่าจากตารางมอเตอร์มาตรฐาน วสท. — FLC จริงอาจต่างตามรุ่น/ยี่ห้อ ถ้าเบรกเกอร์ทริปตอนสตาร์ท เลือกขนาดถัดขึ้นไป และควรมีโอเวอร์โหลดรีเลย์ตั้งที่ ≈ FLC เสมอ · งานจริงควรให้วิศวกรไฟฟ้าที่มีใบอนุญาตทวนก่อนใช้งาน
      </div>

      <button onClick={onBack} className="w-full py-2 text-sm text-sub underline">← กลับหน้าแรก</button>
    </div>
  );
}
