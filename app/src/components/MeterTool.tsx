import { useState } from "react";
import type { Phase } from "../engine";
import { mainService } from "../engine";
import { Field, inputCls } from "./Field";
import CurrentField from "./CurrentField";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-base p-3">
      <div className="text-[11px] text-sub">{label}</div>
      <div className={`mt-1 text-lg font-medium ${accent ?? "text-ink"}`}>{value}</div>
    </div>
  );
}

export default function MeterTool({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("1P");
  const [loadA, setLoadA] = useState(0);
  const r = loadA > 0 ? mainService(phase, loadA) : null;

  return (
    <div className="space-y-4">
      <h2 className="text-[16px] font-medium text-ink">ขนาดมิเตอร์ + สายเมน</h2>
      <p className="-mt-2 text-[12px] text-sub">ใส่โหลดรวมของบ้าน/ฟาร์ม → แนะนำขนาดมิเตอร์ที่ควรขอ + เมนเบรกเกอร์ + สายเมน</p>

      <Field label="ระบบไฟ" help="บ้านทั่วไปมักเป็น 1 เฟส · ฟาร์ม/โหลดใหญ่มักเป็น 3 เฟส">
        <select className={inputCls} value={phase} onChange={(e) => setPhase(e.target.value as Phase)}>
          <option value="1P">1 เฟส (230V)</option>
          <option value="3P">3 เฟส (400V)</option>
        </select>
      </Field>

      <CurrentField
        phase={phase}
        label="โหลดรวม"
        help="รวมกระแสของทุกอุปกรณ์ในบ้าน/ฟาร์ม ใส่เป็นแอมป์หรือวัตต์ก็ได้ (ถ้าไม่แน่ใจ ใช้โหมดออกแบบรวมโหลดก่อน)"
        onAmps={setLoadA}
      />

      {r && (
        <>
          <div className="rounded-2xl border border-cyan/30 bg-cyan/5 p-4">
            <div className="text-sm text-sub">โหลดรวม {r.loadCurrentA} A · {phase === "1P" ? "1 เฟส" : "3 เฟส"}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-sm text-sub">มิเตอร์ที่ควรขอ</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-cyan">{r.meter ?? "-"}</span>
              <span className="text-ink">A</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <Stat label="เมนเบรกเกอร์" value={`${r.breakerA ?? "-"} A`} accent="text-cyan" />
              <Stat label="สายเมน (THW ในท่อ)" value={r.wireSqmm ? `${r.wireSqmm} ตร.มม.` : "เกินขอบเขต"} accent="text-pass" />
            </div>
          </div>

          {r.note && (
            <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-ink/90">{r.note}</div>
          )}

          <div className="rounded-xl border border-warn/30 bg-warn/5 p-3 text-[12px] leading-relaxed text-ink/80">
            ⚠️ ขนาดมิเตอร์อ้างอิงมาตรฐานการไฟฟ้า (กฟน. — กฟภ. ใกล้เคียงกัน) โปรดยืนยันกับการไฟฟ้าท้องถิ่น · สายเมน/เบรกเกอร์คำนวณตาม วสท. เป็นการประเมินเบื้องต้น งานจริงควรให้วิศวกรไฟฟ้าที่มีใบอนุญาตทวนก่อนใช้งาน
          </div>
        </>
      )}

      <button onClick={onBack} className="w-full py-2 text-sm text-sub underline">← กลับหน้าแรก</button>
    </div>
  );
}
