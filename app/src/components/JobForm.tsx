import { useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { CableType, InstallGroup, JobInput, LoadItem, Phase } from "../engine";
import { CABLE_SPECS, DEFAULT_INSTALL_GROUP } from "../engine";
import { addLoadType, allLoadTypes, uid } from "../db";

const CABLES: CableType[] = ["THW", "VAF", "VCT", "NYY"];

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
// VCT เป็นสายอ่อน ไม่ได้เดินบนลูกถ้วย — กลุ่ม 4 ของ VCT หมายถึงเดินในอากาศ (ตาราง 5-26)
const groupLabelFor = (cable: CableType, g: InstallGroup): string =>
  cable === "VCT" && g === 4 ? "เดินในอากาศ (ต่อเครื่องใช้ไฟฟ้า)" : GROUP_LABEL[g];

const base =
  "w-full rounded-lg border bg-base px-3 py-2.5 text-[15px] text-ink outline-none";
const ok = "border-line focus:border-cyan";
const bad = "border-fail focus:border-fail";
const cls = (err?: boolean | string) => `${base} ${err ? bad : ok}`;

function InfoDot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="คำอธิบาย"
      className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-sub text-[11px] font-medium leading-none text-sub active:scale-90"
    >
      i
    </button>
  );
}

function HelpBox({ text }: { text: string }) {
  return (
    <div className="mb-1.5 rounded-lg border border-cyan/30 bg-cyan/5 px-3 py-2 text-[12px] leading-relaxed text-ink/90">
      {text}
    </div>
  );
}

function Field({
  label,
  required,
  error,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <label className="text-[13px] text-sub">
          {label}
          {required && <span className="text-fail"> *</span>}
        </label>
        {help && <InfoDot onClick={() => setOpen((o) => !o)} />}
      </div>
      {help && open && <HelpBox text={help} />}
      {children}
      {error && <p className="mt-1 text-[12px] text-fail">{error}</p>}
    </div>
  );
}

// ── Validation (realtime, no submit needed) ──────────────────────────────────
interface Errors {
  name?: string;
  lengthM?: string;
  ambientTempC?: string;
  groupingCircuits?: string;
  loads?: string;
  loadItems: Array<{ value?: string; quantity?: string; pf?: string }>;
}

function validate(job: JobInput): Errors {
  const e: Errors = { loadItems: [] };
  if (!job.name.trim()) e.name = "กรุณากรอกชื่องาน";
  if (!(job.lengthM > 0)) e.lengthM = "ต้องมากกว่า 0";
  if (!(job.ambientTempC > -50)) e.ambientTempC = "ค่าไม่ถูกต้อง";
  else if (job.ambientTempC > 60) e.ambientTempC = "เกิน 60°C สาย PVC ใช้ไม่ได้";
  if (!(job.groupingCircuits >= 1)) e.groupingCircuits = "อย่างน้อย 1";
  else if (!Number.isInteger(job.groupingCircuits)) e.groupingCircuits = "จำนวนเต็มเท่านั้น";
  if (job.loads.length === 0) e.loads = "ต้องมีโหลดอย่างน้อย 1 รายการ";
  e.loadItems = job.loads.map((l) => ({
    value: l.value > 0 ? undefined : "ต้อง > 0",
    quantity: l.quantity >= 1 ? undefined : "≥ 1",
    pf: l.pf > 0 && l.pf <= 1 ? undefined : "0–1",
  }));
  return e;
}

function isValid(e: Errors): boolean {
  const top = e.name || e.lengthM || e.ambientTempC || e.groupingCircuits || e.loads;
  const items = e.loadItems.some((i) => i.value || i.quantity || i.pf);
  return !top && !items;
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
  const [loadHelp, setLoadHelp] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypePf, setNewTypePf] = useState("0.85");
  const [newTypeMotor, setNewTypeMotor] = useState(false);

  const err = validate(job);
  const valid = isValid(err);

  const set = (patch: Partial<JobInput>) => setJob((j) => ({ ...j, ...patch }));
  const setPhase = (phase: Phase) => set({ phase, voltage: phase === "1P" ? 230 : 400 });
  const setCable = (cableType: CableType) =>
    set({
      cableType,
      installGroup: DEFAULT_INSTALL_GROUP[cableType],
      // VAF เป็นสายแบน 1 เฟสเท่านั้น — เลือก VAF ขณะอยู่ 3 เฟส ให้สลับกลับ 1 เฟส
      ...(cableType === "VAF" ? { phase: "1P" as Phase, voltage: 230 } : {}),
    });
  const setLoad = (i: number, patch: Partial<LoadItem>) =>
    set({ loads: job.loads.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });

  const addLoad = () => {
    const t = (loadTypes ?? [])[0];
    set({
      loads: [
        ...job.loads,
        { loadTypeId: t?.id ?? "socket", label: t?.name ?? "โหลด", unit: "W", value: 0, quantity: 1, pf: t?.pf ?? 1, isMotor: t?.isMotor ?? false },
      ],
    });
  };
  const removeLoad = (i: number) => set({ loads: job.loads.filter((_, idx) => idx !== i) });
  const chooseType = (i: number, id: string) => {
    const t = (loadTypes ?? []).find((x) => x.id === id);
    if (t) setLoad(i, { loadTypeId: t.id, label: t.name, pf: t.pf, isMotor: t.isMotor ?? false });
  };
  const saveNewType = async () => {
    const pf = parseFloat(newTypePf);
    if (!newTypeName.trim() || !(pf > 0 && pf <= 1)) return;
    await addLoadType({ id: uid(), name: newTypeName.trim(), pf, isCustom: true, isMotor: newTypeMotor });
    setNewTypeName("");
    setNewTypeMotor(false);
    setShowAddType(false);
  };

  return (
    <div className="space-y-4">
      <Field label="ชื่องาน" required error={err.name}>
        <input
          className={cls(err.name)}
          value={job.name}
          placeholder="เช่น ปั๊มน้ำ โรงเรือน A"
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ระบบไฟ">
          <select className={cls()} value={job.phase} onChange={(e) => setPhase(e.target.value as Phase)}>
            <option value="1P">1 เฟส (230V)</option>
            <option value="3P" disabled={job.cableType === "VAF"}>
              3 เฟส (400V){job.cableType === "VAF" ? " — VAF ใช้ไม่ได้" : ""}
            </option>
          </select>
        </Field>
        <Field label="ชนิดสาย">
          <select className={cls()} value={job.cableType} onChange={(e) => setCable(e.target.value as CableType)}>
            {CABLES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <p className="-mt-2 text-[12px] text-sub">{CABLE_SPECS[job.cableType].note}</p>

      <Field label="วิธีติดตั้ง">
        <select
          className={cls()}
          value={job.installGroup}
          onChange={(e) => set({ installGroup: Number(e.target.value) as InstallGroup })}
        >
          {GROUPS_FOR[job.cableType].map((g) => (
            <option key={g} value={g}>{groupLabelFor(job.cableType, g)}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="ความยาว (ม.)" required error={err.lengthM}>
          <input type="number" inputMode="decimal" className={cls(err.lengthM)} value={job.lengthM || ""} placeholder="0" onChange={(e) => set({ lengthM: Number(e.target.value) })} />
        </Field>
        <Field
          label="อุณหภูมิ (°C)"
          error={err.ambientTempC}
          help="อุณหภูมิแวดล้อมบริเวณที่เดินสาย ยิ่งร้อน สายยิ่งรับกระแสได้น้อยลง (ต้องใช้สายใหญ่ขึ้น) ค่าเริ่มต้น 40°C ตามมาตรฐานไทย — ในฝ้าเพดานที่ร้อนจัดอาจใส่ 45–50°C · สูงสุด 60°C (เกินนั้นสาย PVC ใช้ไม่ได้ตามมาตรฐาน)"
        >
          <input type="number" inputMode="decimal" className={cls(err.ambientTempC)} value={job.ambientTempC} onChange={(e) => set({ ambientTempC: Number(e.target.value) })} />
        </Field>
        <Field
          label="กลุ่มวงจร"
          error={err.groupingCircuits}
          help="จำนวนวงจรที่เดินสายรวมในท่อ/ช่องเดียวกัน ยิ่งหลายวงจรในท่อเดียว สายยิ่งระบายความร้อนยาก ต้องใช้สายใหญ่ขึ้น — ถ้าวงจรนี้เดินท่อของตัวเอง ใส่ 1 (ค่าปกติ)"
        >
          <input type="number" inputMode="numeric" className={cls(err.groupingCircuits)} value={job.groupingCircuits} min={1} onChange={(e) => set({ groupingCircuits: Number(e.target.value) })} />
        </Field>
      </div>

      <Field
        label="แท็ก / หมวดหมู่ (คั่นด้วย , )"
        help="ป้ายหมวดหมู่ของงาน เช่น ชื่อสถานที่หรือประเภทงาน (ใส่หลายอันคั่นด้วย ,) — ช่วยให้ค้นหาและกรองงานย้อนหลังได้ง่ายขึ้นในหน้าแรก"
      >
        <input
          className={cls()}
          value={(job.tags ?? []).join(", ")}
          placeholder="เช่น โรงเรือน A, ปั๊มน้ำ"
          onChange={(e) => set({ tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </Field>

      {/* Loads */}
      <div className={`rounded-xl border p-3 ${err.loads ? "border-fail/50" : "border-line"} bg-panel/50`}>
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
            โหลดในวงจร <span className="text-fail">*</span>
            <InfoDot onClick={() => setLoadHelp((o) => !o)} />
          </span>
          <button onClick={addLoad} className="rounded-lg border border-cyan px-3 py-1.5 text-[13px] text-cyan active:scale-95">
            + เพิ่มโหลด
          </button>
        </div>

        {loadHelp && (
          <HelpBox text="แต่ละแถวคือโหลด 1 ชนิด: เลือกชนิดโหลด → หน่วย (วัตต์/แอมป์) → ค่า → จำนวน → pf. ค่า pf (ตัวประกอบกำลัง) บอกว่าโหลดใช้ไฟจริงเทียบกับที่จ่ายแค่ไหน: หลอด/ฮีตเตอร์ = 1.0, มอเตอร์/ปั๊ม/แอร์ ≈ 0.8–0.85 ระบบใส่ให้อัตโนมัติตามชนิดโหลด แต่แก้เองได้ (ใช้ตอนแปลงวัตต์เป็นแอมป์)" />
        )}

        {err.loads && <p className="mb-2 text-[12px] text-fail">{err.loads}</p>}

        <div className="space-y-3">
          {job.loads.map((l, i) => {
            const le = err.loadItems[i] ?? {};
            return (
              <div key={i} className="rounded-lg bg-base p-2.5">
                <div className="mb-2 flex gap-2">
                  <select className={`${cls()} flex-1`} value={l.loadTypeId} onChange={(e) => chooseType(i, e.target.value)}>
                    {/* งานที่บันทึกจากโหมดเครื่องใช้ไฟฟ้า/ชนิดที่ถูกลบ อาจมี loadTypeId ที่ไม่อยู่ในรายการ — แสดง label เดิมไว้ ไม่ให้เด้งไปตัวแรก */}
                    {!(loadTypes ?? []).some((t) => t.id === l.loadTypeId) && (
                      <option value={l.loadTypeId}>{l.label || "โหลด"}</option>
                    )}
                    {(loadTypes ?? []).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button onClick={() => removeLoad(i)} className="px-2 text-lg text-fail" aria-label="ลบ">✕</button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <select className={cls()} value={l.unit} onChange={(e) => setLoad(i, { unit: e.target.value as "W" | "A" })}>
                    <option value="W">วัตต์</option>
                    <option value="A">แอมป์</option>
                  </select>
                  <input type="number" inputMode="decimal" className={cls(le.value)} placeholder="ค่า" value={l.value || ""} onChange={(e) => setLoad(i, { value: Number(e.target.value) })} />
                  <input type="number" inputMode="numeric" className={cls(le.quantity)} placeholder="จำนวน" value={l.quantity} min={1} onChange={(e) => setLoad(i, { quantity: Number(e.target.value) })} />
                  <input type="number" inputMode="decimal" step="0.01" className={cls(le.pf)} placeholder="pf" value={l.pf} onChange={(e) => setLoad(i, { pf: Number(e.target.value) })} />
                </div>
                <div className="mt-1 grid grid-cols-4 gap-2 text-center text-[10px] text-sub">
                  <span>หน่วย</span>
                  <span className={le.value ? "text-fail" : ""}>ค่า{le.value ? ` (${le.value})` : ""}</span>
                  <span className={le.quantity ? "text-fail" : ""}>จำนวน</span>
                  <span className={le.pf ? "text-fail" : ""}>pf</span>
                </div>
              </div>
            );
          })}
        </div>

        {showAddType ? (
          <div className="mt-3 rounded-lg border border-line bg-base p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <input className={cls()} placeholder="ชื่อชนิดโหลด" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} />
              <input type="number" step="0.01" className={cls()} placeholder="pf" value={newTypePf} onChange={(e) => setNewTypePf(e.target.value)} />
            </div>
            <label className="mt-2 flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={newTypeMotor} onChange={(e) => setNewTypeMotor(e.target.checked)} />
              โหลดมอเตอร์ (คำนวณด้วยกฎ 125% ตามมาตรฐาน)
            </label>
            <div className="mt-2 flex gap-2">
              <button onClick={saveNewType} className="flex-1 rounded-lg bg-cyan py-2 text-[13px] font-semibold text-[#062330]">บันทึกชนิด</button>
              <button onClick={() => setShowAddType(false)} className="rounded-lg border border-line px-3 py-2 text-[13px] text-sub">ยกเลิก</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddType(true)} className="mt-3 w-full rounded-lg border border-dashed border-line py-2 text-[13px] text-sub">
            + เพิ่มชนิดโหลดเอง (กำหนด pf)
          </button>
        )}
      </div>

      <div className="flex gap-2.5">
        {onCancel && (
          <button onClick={onCancel} className="rounded-xl border border-line px-4 py-3 text-[15px] text-sub active:scale-95">
            ยกเลิก
          </button>
        )}
        <button
          onClick={() => valid && onCalculate(job)}
          disabled={!valid}
          className={`flex-1 rounded-xl py-3 text-[15px] font-semibold active:scale-95 ${
            valid ? "bg-cyan text-[#062330]" : "cursor-not-allowed bg-panel text-sub"
          }`}
        >
          ⚡ คำนวณ
        </button>
      </div>
      {!valid && (
        <p className="text-center text-[12px] text-warn">กรอกข้อมูลที่มี * ให้ครบก่อน จึงจะกดคำนวณได้</p>
      )}
    </div>
  );
}
