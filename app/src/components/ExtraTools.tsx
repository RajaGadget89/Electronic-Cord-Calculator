import { useState } from "react";
import type { CableType, Phase } from "../engine";
import { CABLE_SIZES_SQMM, conduitRecommend, maxCableLength } from "../engine";

const inputCls = "w-full rounded-lg border border-line bg-base px-3 py-2.5 text-[15px] text-ink outline-none focus:border-cyan";
const CONDUIT_CABLES: ("THW" | "NYY")[] = ["THW", "NYY"];
const VD_CABLES: CableType[] = ["THW", "VAF", "VCT", "NYY"];

export default function ExtraTools({ onBack }: { onBack: () => void }) {
  // conduit
  const [cCable, setCCable] = useState<"THW" | "NYY">("THW");
  const [cSize, setCSize] = useState(2.5);
  const [cCount, setCCount] = useState(3);
  const conduit = conduitRecommend(cCable, cSize, cCount);

  // max length
  const [lCable, setLCable] = useState<CableType>("THW");
  const [lPhase, setLPhase] = useState<Phase>("1P");
  const [lSize, setLSize] = useState(2.5);
  const [lCurrent, setLCurrent] = useState(0);
  const ml = lCurrent > 0 ? maxCableLength(lCable, lPhase, lPhase === "1P" ? 230 : 400, lSize, lCurrent) : null;

  return (
    <div className="space-y-5">
      <h2 className="text-[16px] font-medium text-ink">เครื่องมือช่าง</h2>

      {/* Conduit fill */}
      <div className="rounded-2xl border border-line bg-panel/40 p-4">
        <h3 className="text-[15px] font-medium text-cyan">ขนาดท่อร้อยสาย</h3>
        <p className="mb-3 mt-0.5 text-[12px] text-sub">สายขนาดเดียวกันกี่เส้น → ท่อขนาดเท่าไร (ภาคผนวก C วสท.)</p>
        <div className="grid grid-cols-3 gap-2.5">
          <div><label className="mb-1 block text-[12px] text-sub">ชนิดสาย</label>
            <select className={inputCls} value={cCable} onChange={(e) => setCCable(e.target.value as "THW" | "NYY")}>
              {CONDUIT_CABLES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label className="mb-1 block text-[12px] text-sub">ขนาด (ตร.มม.)</label>
            <select className={inputCls} value={cSize} onChange={(e) => setCSize(Number(e.target.value))}>
              {CABLE_SIZES_SQMM.map((n) => <option key={n} value={n}>{n}</option>)}
            </select></div>
          <div><label className="mb-1 block text-[12px] text-sub">จำนวนเส้น</label>
            <input type="number" inputMode="numeric" className={inputCls} value={cCount || ""} min={1} onChange={(e) => setCCount(Number(e.target.value))} /></div>
        </div>
        <div className="mt-3 rounded-xl bg-base p-3 text-center">
          {conduit.conduitMm ? (
            <div><span className="text-2xl font-semibold text-cyan">{conduit.conduitMm}</span>
              <span className="text-ink"> มม. ({conduit.conduitInch}″)</span></div>
          ) : (
            <div className="text-sm text-warn">{conduit.note ?? "—"}</div>
          )}
        </div>
      </div>

      {/* Max length */}
      <div className="rounded-2xl border border-line bg-panel/40 p-4">
        <h3 className="text-[15px] font-medium text-cyan">ระยะสายสูงสุด (แรงดันตก ≤ 3%)</h3>
        <p className="mb-3 mt-0.5 text-[12px] text-sub">สายขนาดนี้ โหลดเท่านี้ ลากได้ไกลสุดกี่เมตร</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div><label className="mb-1 block text-[12px] text-sub">ชนิดสาย</label>
            <select className={inputCls} value={lCable} onChange={(e) => setLCable(e.target.value as CableType)}>
              {VD_CABLES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label className="mb-1 block text-[12px] text-sub">ระบบไฟ</label>
            <select className={inputCls} value={lPhase} onChange={(e) => setLPhase(e.target.value as Phase)}>
              <option value="1P">1 เฟส</option><option value="3P">3 เฟส</option>
            </select></div>
          <div><label className="mb-1 block text-[12px] text-sub">ขนาด (ตร.มม.)</label>
            <select className={inputCls} value={lSize} onChange={(e) => setLSize(Number(e.target.value))}>
              {CABLE_SIZES_SQMM.map((n) => <option key={n} value={n}>{n}</option>)}
            </select></div>
          <div><label className="mb-1 block text-[12px] text-sub">กระแสโหลด (A)</label>
            <input type="number" inputMode="decimal" className={inputCls} value={lCurrent || ""} onChange={(e) => setLCurrent(Number(e.target.value))} /></div>
        </div>
        <div className="mt-3 rounded-xl bg-base p-3 text-center">
          {ml?.maxLengthM != null ? (
            <div><span className="text-2xl font-semibold text-cyan">{ml.maxLengthM}</span>
              <span className="text-ink"> เมตร</span></div>
          ) : (
            <div className="text-sm text-sub">{lCurrent > 0 ? (ml?.note ?? "—") : "ใส่กระแสโหลดเพื่อคำนวณ"}</div>
          )}
        </div>
      </div>

      <button onClick={onBack} className="w-full py-2 text-sm text-sub underline">← กลับหน้าแรก</button>
    </div>
  );
}
