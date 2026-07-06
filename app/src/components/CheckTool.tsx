import { useState } from "react";
import type { CableType, InstallGroup, Phase } from "../engine";
import { CABLE_SIZES_SQMM, CABLE_SPECS, DEFAULT_INSTALL_GROUP, checkCircuit } from "../engine";
import { Field, inputCls } from "./Field";
import CurrentField from "./CurrentField";
import { getJob, saveJob, uid, type CheckJob } from "../db";
import { buildCheckMarkdown, downloadText, printCheckReport, shareCheckReport } from "../report";

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

export default function CheckTool({
  initial,
  onBack,
}: {
  initial?: { id: string; check: CheckJob } | null;
  onBack: () => void;
}) {
  const c0 = initial?.check;
  const [name, setName] = useState(c0?.name ?? "");
  const [tags, setTags] = useState<string[]>(c0?.tags ?? []);
  const [phase, setPhase] = useState<Phase>(c0?.phase ?? "1P");
  const [cableType, setCableType] = useState<CableType>(c0?.cableType ?? "THW");
  const [installGroup, setInstallGroup] = useState<InstallGroup>(c0?.installGroup ?? 2);
  const [ambientTempC, setAmbient] = useState(c0?.ambientTempC ?? 40);
  const [groupingCircuits, setGrouping] = useState(c0?.groupingCircuits ?? 1);
  const [lengthM, setLength] = useState(c0?.lengthM ?? 10);
  const [loadCurrentA, setLoad] = useState(c0?.loadCurrentA ?? 0);
  const [cableSizeSqmm, setSize] = useState(c0?.cableSizeSqmm ?? 2.5);
  const [breakerA, setBreaker] = useState(c0?.breakerA ?? 16);
  const [currentId, setCurrentId] = useState<string | null>(initial?.id ?? null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const setCable = (c: CableType) => { setCableType(c); setInstallGroup(DEFAULT_INSTALL_GROUP[c]); };
  const ready = loadCurrentA > 0 && lengthM > 0;
  const voltage = phase === "1P" ? 230 : 400;
  const round = (n: number) => Math.round(n * 100) / 100;

  const checkJob: CheckJob = {
    name, tags, phase, voltage, cableType, installGroup,
    ambientTempC, groupingCircuits, lengthM, loadCurrentA: round(loadCurrentA), cableSizeSqmm, breakerA,
  };
  const res = ready ? checkCircuit(checkJob) : null;
  const s = res ? STATUS[res.status] : null;

  const markDirty = () => setSaved(false);

  const doSave = async () => {
    if (!name.trim()) return;
    const id = currentId ?? uid();
    const now = Date.now();
    let createdAt = now;
    if (currentId) { const ex = await getJob(currentId); if (ex) createdAt = ex.createdAt; }
    await saveJob({ id, kind: "check", createdAt, updatedAt: now, check: checkJob });
    setCurrentId(id);
    setSaved(true);
  };
  const copyText = async () => {
    try { await navigator.clipboard.writeText(buildCheckMarkdown(checkJob)); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { downloadText(`${name || "check"}.md`, buildCheckMarkdown(checkJob)); }
  };
  const makePdf = async () => {
    setPdfBusy(true);
    try { const { exportCheckPdf } = await import("../reportPdf"); await exportCheckPdf(checkJob); }
    catch (e) { alert("สร้าง PDF ไม่สำเร็จ: " + (e as Error).message); }
    finally { setPdfBusy(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-[16px] font-medium text-ink">โหมดตรวจสอบวงจร</h2>
      <p className="-mt-2 text-[12px] text-sub">มีสาย + เบรกเกอร์อยู่แล้ว โหลดเท่านี้ ปลอดภัยไหม (บันทึกเก็บประวัติได้)</p>

      <Field label="ชื่องาน" required help="ตั้งชื่อเพื่อบันทึกและดูย้อนหลัง เช่น 'ตรวจปั๊ม โรงเรือน A'">
        <input className={inputCls} value={name} placeholder="เช่น ตรวจวงจรปั๊ม โรงเรือน A" onChange={(e) => { setName(e.target.value); markDirty(); }} />
      </Field>
      <Field label="แท็ก / หมวดหมู่ (คั่นด้วย , )" help="ช่วยค้นหา/กรองงานย้อนหลังในหน้าแรก">
        <input className={inputCls} value={tags.join(", ")} placeholder="เช่น ตรวจซ่อม, โรงเรือน A"
          onChange={(e) => { setTags(e.target.value.split(",").map((t) => t.trim()).filter(Boolean)); markDirty(); }} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ระบบไฟ">
          <select className={inputCls} value={phase} onChange={(e) => { setPhase(e.target.value as Phase); markDirty(); }}>
            <option value="1P">1 เฟส (230V)</option><option value="3P">3 เฟส (400V)</option>
          </select>
        </Field>
        <Field label="ชนิดสาย" help="ชนิดสายที่เดินอยู่จริง — มีผลต่อพิกัดกระแส">
          <select className={inputCls} value={cableType} onChange={(e) => { setCable(e.target.value as CableType); markDirty(); }}>
            {CABLES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <p className="-mt-2 text-[12px] text-sub">{CABLE_SPECS[cableType].note}</p>

      <Field label="วิธีติดตั้ง" help="วิธีเดินสายจริง มีผลต่อพิกัดกระแสที่สายรับได้">
        <select className={inputCls} value={installGroup} onChange={(e) => { setInstallGroup(Number(e.target.value) as InstallGroup); markDirty(); }}>
          {GROUPS_FOR[cableType].map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ขนาดสายที่มี (ตร.มม.)" help="ขนาดสายที่ติดตั้งไปแล้วหน้างาน">
          <select className={inputCls} value={cableSizeSqmm} onChange={(e) => { setSize(Number(e.target.value)); markDirty(); }}>
            {CABLE_SIZES_SQMM.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="เบรกเกอร์ที่มี (A)" help="พิกัดเบรกเกอร์ที่ติดตั้งไปแล้ว (ดูที่ตัวเบรกเกอร์)">
          <select className={inputCls} value={breakerA} onChange={(e) => { setBreaker(Number(e.target.value)); markDirty(); }}>
            {BREAKERS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      </div>

      <CurrentField phase={phase} onAmps={(a) => { setLoad(a); markDirty(); }} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="ความยาวสาย (ม.)" help="ระยะสายทางเดียว จากเบรกเกอร์ถึงโหลด">
          <input type="number" inputMode="decimal" className={inputCls} value={lengthM || ""} onChange={(e) => { setLength(Number(e.target.value)); markDirty(); }} />
        </Field>
        <Field label="อุณหภูมิ (°C)" help="อุณหภูมิรอบสาย ค่าเริ่มต้น 40°C">
          <input type="number" inputMode="decimal" className={inputCls} value={ambientTempC} onChange={(e) => { setAmbient(Number(e.target.value)); markDirty(); }} />
        </Field>
      </div>
      <Field label="กลุ่มวงจร" help="จำนวนวงจรที่เดินรวมในท่อเดียวกัน (วงจรนี้เดินท่อเดี่ยว = 1)">
        <input type="number" inputMode="numeric" className={inputCls} value={groupingCircuits} min={1} onChange={(e) => { setGrouping(Number(e.target.value)); markDirty(); }} />
      </Field>

      {res && s && (
        <>
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

          <div className="flex gap-2 rounded-xl border border-warn/30 bg-warn/5 p-3 text-[12px] leading-relaxed text-ink/80">
            <span>⚠️</span>
            <span>ผลนี้เป็นการประเมินเบื้องต้นตามมาตรฐาน วสท. <strong className="text-ink">ไม่ใช่เอกสารรับรองทางวิศวกรรม</strong> — งานติดตั้งจริงควรให้วิศวกรไฟฟ้าที่มีใบอนุญาตทวนอีกชั้นก่อนใช้งาน</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={copyText} className="rounded-xl border border-line bg-panel py-2.5 text-sm font-medium text-ink active:scale-95">{copied ? "✓ คัดลอกแล้ว" : "⧉ คัดลอกข้อความ"}</button>
            <button onClick={makePdf} disabled={pdfBusy} className="rounded-xl bg-[#38BDF8] py-2.5 text-sm font-semibold text-[#062330] active:scale-95 disabled:opacity-60">{pdfBusy ? "กำลังสร้าง…" : "⬇ PDF"}</button>
            <button onClick={() => downloadText(`${name || "check"}.md`, buildCheckMarkdown(checkJob))} className="rounded-xl border border-line bg-panel py-2.5 text-sm font-medium text-ink active:scale-95">⬇ Markdown</button>
            <button onClick={() => printCheckReport(checkJob)} className="rounded-xl border border-line bg-panel py-2.5 text-sm font-medium text-ink active:scale-95">🖨 พิมพ์</button>
            <button onClick={() => shareCheckReport(checkJob)} className="rounded-xl border border-cyan bg-panel py-2.5 text-sm font-medium text-cyan active:scale-95">↗ แชร์</button>
            <button onClick={doSave} disabled={!name.trim()} className={`rounded-xl py-2.5 text-sm font-semibold active:scale-95 ${name.trim() ? "bg-cyan text-[#062330]" : "cursor-not-allowed bg-panel text-sub"}`}>{saved ? "✓ บันทึกแล้ว" : "💾 บันทึกงาน"}</button>
          </div>
          {!name.trim() && <p className="text-center text-[12px] text-warn">กรอกชื่องานเพื่อบันทึก</p>}
        </>
      )}

      <button onClick={onBack} className="w-full py-2 text-sm text-sub underline">← กลับหน้าแรก</button>
    </div>
  );
}
