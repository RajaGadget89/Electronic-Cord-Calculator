import { useState } from "react";
import type { CableType, InstallGroup, JobInput, Phase } from "../engine";
import { DEFAULT_INSTALL_GROUP, CABLE_SPECS } from "../engine";
import { Field, inputCls } from "./Field";
import { APPLIANCES, APPLIANCE_CATEGORIES, type Appliance } from "../content/appliances";

const CABLES: CableType[] = ["THW", "VAF", "VCT", "NYY"];
const GROUPS_FOR: Record<CableType, InstallGroup[]> = { THW: [2, 1, 4], VAF: [3], VCT: [4, 2], NYY: [6, 5, 2] };
const GROUP_LABEL: Record<InstallGroup, string> = {
  1: "ร้อยท่อในฝ้า", 2: "ร้อยท่อเกาะผนัง", 3: "เดินเกาะผนัง", 4: "บนลูกถ้วยในอากาศ", 5: "ร้อยท่อฝังดิน", 6: "ฝังดินโดยตรง", 7: "บนรางเคเบิล",
};

export default function ApplianceTool({
  onCalculate,
  onBack,
}: {
  onCalculate: (job: JobInput) => void;
  onBack: () => void;
}) {
  const [appId, setAppId] = useState(APPLIANCES[0].id);
  const app = APPLIANCES.find((a) => a.id === appId) as Appliance;
  const [watts, setWatts] = useState(String(app.watts));
  const [phase, setPhase] = useState<Phase>(app.phase);
  const [cableType, setCableType] = useState<CableType>("THW");
  const [installGroup, setInstallGroup] = useState<InstallGroup>(2);
  const [lengthM, setLength] = useState(5);

  const chooseApp = (id: string) => {
    const a = APPLIANCES.find((x) => x.id === id)!;
    setAppId(id);
    setWatts(String(a.watts));
    setPhase(a.phase);
  };
  const setCable = (c: CableType) => { setCableType(c); setInstallGroup(DEFAULT_INSTALL_GROUP[c]); };

  const w = Number(watts);
  const ready = w > 0 && lengthM > 0;

  const calc = () => {
    if (!ready) return;
    const job: JobInput = {
      name: app.label,
      phase,
      voltage: phase === "1P" ? 230 : 400,
      cableType,
      installGroup,
      lengthM,
      ambientTempC: 40,
      groupingCircuits: 1,
      loads: [
        { loadTypeId: "appliance", label: app.label, unit: "W", value: w, quantity: 1, pf: app.pf, isMotor: app.isMotor },
      ],
      maxCableSizeSqmm: 50,
      tags: ["เครื่องใช้ไฟฟ้า", app.category],
    };
    onCalculate(job);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-[16px] font-medium text-ink">โหมดเครื่องใช้ไฟฟ้า</h2>
      <p className="-mt-2 text-[12px] text-sub">เลือกอุปกรณ์ (แอร์/น้ำอุ่น/ปั๊ม ฯลฯ) → แนะนำสาย เบรกเกอร์ และสายดิน ที่ถูกต้องปลอดภัย</p>

      <Field label="เครื่องใช้ไฟฟ้า" help="เลือกอุปกรณ์ที่จะติดตั้ง — ระบบเติมค่ากำลังไฟให้ (ปรับได้ตามป้ายเครื่องจริง)">
        <select className={inputCls} value={appId} onChange={(e) => chooseApp(e.target.value)}>
          {APPLIANCE_CATEGORIES.map((cat) => (
            <optgroup key={cat} label={cat}>
              {APPLIANCES.filter((a) => a.category === cat).map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="กำลังไฟ (วัตต์)" help="ค่าประมาณจากพรีเซ็ต — ควรปรับให้ตรงป้าย/สเปกเครื่องจริง (ดู W หรือกระแสที่ระบุ)">
          <input type="number" inputMode="decimal" className={inputCls} value={watts} onChange={(e) => setWatts(e.target.value)} />
        </Field>
        <Field label="ระบบไฟ">
          <select className={inputCls} value={phase} onChange={(e) => setPhase(e.target.value as Phase)}>
            <option value="1P">1 เฟส (230V)</option>
            <option value="3P">3 เฟส (400V)</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ชนิดสาย" help="งานเดินสายในบ้านทั่วไปมักใช้ THW ร้อยท่อ">
          <select className={inputCls} value={cableType} onChange={(e) => setCable(e.target.value as CableType)}>
            {CABLES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="ความยาวสาย (ม.)" help="ระยะจากเบรกเกอร์/ตู้ถึงจุดติดตั้ง">
          <input type="number" inputMode="decimal" className={inputCls} value={lengthM || ""} onChange={(e) => setLength(Number(e.target.value))} />
        </Field>
      </div>
      <p className="-mt-2 text-[12px] text-sub">{CABLE_SPECS[cableType].note}</p>

      <Field label="วิธีติดตั้ง">
        <select className={inputCls} value={installGroup} onChange={(e) => setInstallGroup(Number(e.target.value) as InstallGroup)}>
          {GROUPS_FOR[cableType].map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
        </select>
      </Field>

      {app.isMotor && (
        <p className="text-[12px] text-sub">⚙️ อุปกรณ์นี้มีคอมเพรสเซอร์/มอเตอร์ — ระบบจะเผื่อกระแสสตาร์ท 125% ให้อัตโนมัติ</p>
      )}

      <button onClick={calc} disabled={!ready}
        className={`w-full rounded-xl py-3 text-[15px] font-semibold active:scale-95 ${ready ? "bg-cyan text-[#062330]" : "cursor-not-allowed bg-panel text-sub"}`}>
        ⚡ คำนวณ
      </button>

      <button onClick={onBack} className="w-full py-2 text-sm text-sub underline">← กลับหน้าแรก</button>
    </div>
  );
}
