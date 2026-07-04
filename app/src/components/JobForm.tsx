import { useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { CableType, InstallGroup, JobInput, LoadItem, Phase } from "../engine";
import { CABLE_SPECS, DEFAULT_INSTALL_GROUP } from "../engine";
import { addLoadType, allLoadTypes, uid } from "../db";

const CABLES: CableType[] = ["THW", "VAF", "VCT", "NYY"];

// Install groups we have verified data for, per cable type.
const GROUPS_FOR: Record<CableType, InstallGroup[]> = {
  THW: [2, 1, 4],
  VAF: [3],
  VCT: [4, 2],
  NYY: [6, 5, 2],
};
const GROUP_LABEL: Record<InstallGroup, string> = {
  1: "ร้อยท่อในฝ้า/ผนังกันไฟ",
  2: "ร้อยท่อเกาะผนัง/ฝังคอนกรีต",
  3: "เดินเกาะผนัง",
  4: "บนลูกถ้วยในอากาศ",
  5: "ร้อยท่อฝังดิน",
  6: "ฝังดินโดยตรง",
  7: "บนรางเคเบิล",
};

const inputCls =
  "w-full rounded-lg border border-line bg-base px-3 py-2 text-ink outline-none focus:border-cyan";
const labelCls = "mb-1 block text-xs text-sub";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export default function JobForm({
  initial,
  onCalculate,
  onCancel,
}: {
  initial: JobInput;
  onCalculate: (job: JobInput) => void;
  onCancel?: () => void;
}) {
  const [job, setJob] = useState<JobInput>(initial);
  const loadTypes = useLiveQuery(() => allLoadTypes(), [], []);
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypePf, setNewTypePf] = useState("0.85");

  const set = (patch: Partial<JobInput>) => setJob((j) => ({ ...j, ...patch }));

  const setPhase = (phase: Phase) =>
    set({ phase, voltage: phase === "1P" ? 230 : 400 });

  const setCable = (cableType: CableType) =>
    set({ cableType, installGroup: DEFAULT_INSTALL_GROUP[cableType] });

  const setLoad = (i: number, patch: Partial<LoadItem>) =>
    set({ loads: job.loads.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });

  const addLoad = () => {
    const t = (loadTypes ?? [])[0];
    set({
      loads: [
        ...job.loads,
        {
          loadTypeId: t?.id ?? "socket",
          label: t?.name ?? "โหลด",
          unit: "W",
          value: 0,
          quantity: 1,
          pf: t?.pf ?? 1,
        },
      ],
    });
  };
  const removeLoad = (i: number) =>
    set({ loads: job.loads.filter((_, idx) => idx !== i) });

  const chooseType = (i: number, id: string) => {
    const t = (loadTypes ?? []).find((x) => x.id === id);
    if (t) setLoad(i, { loadTypeId: t.id, label: t.name, pf: t.pf });
  };

  const saveNewType = async () => {
    const pf = parseFloat(newTypePf);
    if (!newTypeName.trim() || !(pf > 0 && pf <= 1)) return;
    await addLoadType({ id: uid(), name: newTypeName.trim(), pf, isCustom: true });
    setNewTypeName("");
    setShowAddType(false);
  };

  return (
    <div className="space-y-4">
      <Field label="ชื่องาน">
        <input
          className={inputCls}
          value={job.name}
          placeholder="เช่น ปั๊มน้ำ โรงเรือน A"
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ระบบไฟ">
          <select className={inputCls} value={job.phase} onChange={(e) => setPhase(e.target.value as Phase)}>
            <option value="1P">1 เฟส (230V)</option>
            <option value="3P">3 เฟส (400V)</option>
          </select>
        </Field>
        <Field label="ชนิดสาย">
          <select className={inputCls} value={job.cableType} onChange={(e) => setCable(e.target.value as CableType)}>
            {CABLES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <p className="-mt-2 text-[11px] text-sub">{CABLE_SPECS[job.cableType].note}</p>

      <Field label="วิธีติดตั้ง">
        <select
          className={inputCls}
          value={job.installGroup}
          onChange={(e) => set({ installGroup: Number(e.target.value) as InstallGroup })}
        >
          {GROUPS_FOR[job.cableType].map((g) => (
            <option key={g} value={g}>{GROUP_LABEL[g]}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="ความยาว (ม.)">
          <input type="number" className={inputCls} value={job.lengthM || ""} onChange={(e) => set({ lengthM: Number(e.target.value) })} />
        </Field>
        <Field label="อุณหภูมิ (°C)">
          <input type="number" className={inputCls} value={job.ambientTempC} onChange={(e) => set({ ambientTempC: Number(e.target.value) })} />
        </Field>
        <Field label="กลุ่มวงจร">
          <input type="number" className={inputCls} value={job.groupingCircuits} min={1} onChange={(e) => set({ groupingCircuits: Number(e.target.value) })} />
        </Field>
      </div>

      {/* Loads */}
      <div className="rounded-xl border border-line bg-panel/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-ink">โหลดในวงจร</span>
          <button onClick={addLoad} className="rounded-lg border border-cyan px-2.5 py-1 text-xs text-cyan active:scale-95">
            + เพิ่มโหลด
          </button>
        </div>

        {job.loads.length === 0 && (
          <p className="py-2 text-center text-xs text-sub">ยังไม่มีโหลด — กด “เพิ่มโหลด”</p>
        )}

        <div className="space-y-3">
          {job.loads.map((l, i) => (
            <div key={i} className="rounded-lg bg-base p-2.5">
              <div className="mb-2 flex gap-2">
                <select
                  className={`${inputCls} flex-1`}
                  value={l.loadTypeId}
                  onChange={(e) => chooseType(i, e.target.value)}
                >
                  {(loadTypes ?? []).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button onClick={() => removeLoad(i)} className="px-2 text-fail" aria-label="ลบ">✕</button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <select className={inputCls} value={l.unit} onChange={(e) => setLoad(i, { unit: e.target.value as "W" | "A" })}>
                  <option value="W">วัตต์</option>
                  <option value="A">แอมป์</option>
                </select>
                <input type="number" className={inputCls} placeholder="ค่า" value={l.value || ""} onChange={(e) => setLoad(i, { value: Number(e.target.value) })} />
                <input type="number" className={inputCls} placeholder="จำนวน" value={l.quantity} min={1} onChange={(e) => setLoad(i, { quantity: Number(e.target.value) })} />
                <input type="number" step="0.01" className={inputCls} placeholder="pf" value={l.pf} onChange={(e) => setLoad(i, { pf: Number(e.target.value) })} />
              </div>
              <div className="mt-1 grid grid-cols-4 gap-2 text-center text-[10px] text-sub">
                <span>หน่วย</span><span>ค่า</span><span>จำนวน</span><span>pf</span>
              </div>
            </div>
          ))}
        </div>

        {showAddType ? (
          <div className="mt-3 rounded-lg border border-line bg-base p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder="ชื่อชนิดโหลด" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} />
              <input type="number" step="0.01" className={inputCls} placeholder="pf" value={newTypePf} onChange={(e) => setNewTypePf(e.target.value)} />
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={saveNewType} className="flex-1 rounded-lg bg-cyan py-1.5 text-xs font-semibold text-[#062330]">บันทึกชนิด</button>
              <button onClick={() => setShowAddType(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs text-sub">ยกเลิก</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddType(true)} className="mt-3 w-full rounded-lg border border-dashed border-line py-1.5 text-xs text-sub">
            + เพิ่มชนิดโหลดเอง (กำหนด pf)
          </button>
        )}
      </div>

      <div className="flex gap-2.5">
        {onCancel && (
          <button onClick={onCancel} className="rounded-xl border border-line px-4 py-3 text-sm text-sub active:scale-95">
            ยกเลิก
          </button>
        )}
        <button
          onClick={() => onCalculate(job)}
          className="flex-1 rounded-xl bg-cyan py-3 text-sm font-semibold text-[#062330] active:scale-95"
        >
          ⚡ คำนวณ
        </button>
      </div>
    </div>
  );
}
