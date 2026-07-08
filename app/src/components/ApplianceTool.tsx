import { useState } from "react";
import type { CableType, InstallGroup, JobInput, Phase, ValueUnit } from "../engine";
import { DEFAULT_INSTALL_GROUP, CABLE_SPECS, wattToAmp, ampToWatt } from "../engine";
import { Field, inputBase, inputCls } from "./Field";
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
  const [name, setName] = useState(app.label);
  const [nameTouched, setNameTouched] = useState(false);
  const [value, setValue] = useState(String(app.watts));
  const [unit, setUnit] = useState<ValueUnit>("W");
  const [phase, setPhase] = useState<Phase>(app.phase);
  const [cableType, setCableType] = useState<CableType>("THW");
  const [installGroup, setInstallGroup] = useState<InstallGroup>(2);
  const [lengthM, setLength] = useState(5);

  const voltage = phase === "1P" ? 230 : 400;

  const chooseApp = (id: string) => {
    const a = APPLIANCES.find((x) => x.id === id)!;
    setAppId(id);
    setPhase(a.phase);
    setUnit("W");
    setValue(String(a.watts));
    if (!nameTouched) setName(a.label);
  };
  const setCable = (c: CableType) => { setCableType(c); setInstallGroup(DEFAULT_INSTALL_GROUP[c]); };

  // สลับหน่วยวัตต์↔แอมป์ พร้อมแปลงค่าให้เท่ากันทางไฟฟ้า
  const toggleUnit = (u: ValueUnit) => {
    if (u === unit) return;
    const n = Number(value);
    if (n > 0) {
      const v = phase === "1P" ? 230 : 400;
      setValue(String(u === "A" ? wattToAmp(n, phase, v, app.pf) : ampToWatt(n, phase, v, app.pf)));
    }
    setUnit(u);
  };

  const v = Number(value);
  const ready = name.trim().length > 0 && v > 0 && lengthM > 0;

  const calc = () => {
    if (!ready) return;
    const job: JobInput = {
      name: name.trim(),
      phase,
      voltage,
      cableType,
      installGroup,
      lengthM,
      ambientTempC: 40,
      groupingCircuits: 1,
      loads: [
        { loadTypeId: app.loadTypeId, label: app.label, unit, value: v, quantity: 1, pf: app.pf, isMotor: app.isMotor },
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

      <Field label="ชื่องาน" help="ตั้งชื่อเพื่อดูย้อนหลังได้ว่าติดตั้งให้ลูกค้าคนไหน เช่น 'ไมโครเวฟ บ้านคุณสมชาย' — ระบบเติมชื่ออุปกรณ์ให้ก่อน แก้ได้">
        <input className={inputCls} value={name} placeholder="เช่น แอร์ห้องนอน บ้านคุณเอ"
          onChange={(e) => { setName(e.target.value); setNameTouched(true); }} />
      </Field>

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
        <Field label={unit === "W" ? "กำลังไฟ (วัตต์)" : "กระแส (แอมป์)"} help="ดูจากป้าย/สเปกเครื่องจริง ระบุเป็นวัตต์ (W) หรือแอมป์ (A) ก็ได้ — สลับหน่วยได้ที่ปุ่มขวา ระบบแปลงค่าให้อัตโนมัติ">
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" className={`${inputBase} min-w-0 flex-1`} value={value} onChange={(e) => setValue(e.target.value)} />
            <select className={`${inputBase} w-[74px]`} value={unit} onChange={(e) => toggleUnit(e.target.value as ValueUnit)}>
              <option value="W">วัตต์</option>
              <option value="A">แอมป์</option>
            </select>
          </div>
        </Field>
        <Field label="ระบบไฟ">
          <select className={inputCls} value={phase} onChange={(e) => setPhase(e.target.value as Phase)}>
            <option value="1P">1 เฟส (230V)</option>
            <option value="3P">3 เฟส (400V)</option>
          </select>
        </Field>
      </div>
      {app.custom && (
        <p className="-mt-2 text-[12px] text-warn">อุปกรณ์นี้มีหลายขนาด — โปรดกรอกกำลังไฟให้ตรงกับป้ายเครื่องจริง (ค่าที่เติมให้เป็นค่าประมาณ)</p>
      )}

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
