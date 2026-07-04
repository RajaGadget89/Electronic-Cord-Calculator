import { useState } from "react";
import type { CalcResult, JobInput } from "../engine";
import { buildMarkdown, downloadText, printReport, shareReport } from "../report";

const STATUS: Record<string, { label: string; cls: string; ring: string }> = {
  PASS: { label: "ผ่านทุกเงื่อนไข", cls: "text-pass", ring: "border-pass/40 bg-pass/10" },
  WARN: { label: "ผ่าน (มีข้อควรทราบ)", cls: "text-warn", ring: "border-warn/40 bg-warn/10" },
  FAIL: { label: "ไม่ผ่าน", cls: "text-fail", ring: "border-fail/40 bg-fail/10" },
};

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-base p-3">
      <div className="text-[11px] text-sub">{label}</div>
      <div className={`mt-1 text-lg font-medium ${accent ?? "text-ink"}`}>{value}</div>
    </div>
  );
}

export default function ResultCard({
  job,
  result,
  onEdit,
  onSave,
  saved,
}: {
  job: JobInput;
  result: CalcResult;
  onEdit: () => void;
  onSave: () => void;
  saved: boolean;
}) {
  const s = STATUS[result.status] ?? STATUS.FAIL;
  const has = result.cableSizeSqmm != null;
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdown(job, result));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      downloadText(`${job.name || "report"}.md`, buildMarkdown(job, result));
    }
  };
  const makePdf = async () => {
    setPdfBusy(true);
    try {
      const { exportPdf } = await import("../reportPdf"); // lazy-load jsPDF on demand
      await exportPdf(job, result);
    } catch (e) {
      alert("สร้าง PDF ไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${s.ring}`}>
        <div className={`inline-flex items-center gap-2 rounded-full border border-current/30 px-3 py-1 text-sm font-medium ${s.cls}`}>
          ● {s.label}
        </div>

        {has ? (
          <>
            <div className="mt-4 text-sm text-sub">แนะนำสายไฟ</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold text-cyan">{result.cableSizeSqmm}</span>
              <span className="text-ink">ตร.มม. · {job.cableType}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Stat label="กระแสโหลด" value={`${result.totalCurrentA} A`} />
              <Stat label="พิกัดสาย (derate)" value={`${result.deratedAmpacityA ?? "-"} A`} />
              <Stat
                label="แรงดันตก"
                value={`${result.voltageDropPercent ?? "-"} %`}
                accent={(result.voltageDropPercent ?? 0) <= 3 ? "text-pass" : "text-warn"}
              />
              <Stat label="เบรกเกอร์" value={`${result.breakerA ?? "-"} A`} accent="text-cyan" />
              <Stat label="สายดินบริภัณฑ์" value={`${result.groundSizeSqmm ?? "-"} ตร.มม.`} accent="text-pass" />
            </div>
          </>
        ) : (
          <div className="mt-3 text-sm text-ink">
            {result.errors.length
              ? "กรุณาตรวจสอบข้อมูลนำเข้า"
              : "ไม่สามารถแนะนำสายได้ในเงื่อนไขนี้ (ดูข้อความด้านล่าง)"}
          </div>
        )}
      </div>

      {(result.warnings.length > 0 || result.errors.length > 0) && (
        <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-ink/90">
            {result.errors.map((e, i) => (
              <li key={`e${i}`} className="text-fail">{e}</li>
            ))}
            {result.warnings.map((w, i) => (
              <li key={`w${i}`}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="no-print grid grid-cols-2 gap-2.5">
        <button
          onClick={copyText}
          className="rounded-xl border border-line bg-panel py-2.5 text-sm font-medium text-ink active:scale-95"
        >
          {copied ? "✓ คัดลอกแล้ว" : "⧉ คัดลอกข้อความ"}
        </button>
        <button
          onClick={makePdf}
          disabled={pdfBusy}
          className="rounded-xl bg-[#38BDF8] py-2.5 text-sm font-semibold text-[#062330] active:scale-95 disabled:opacity-60"
        >
          {pdfBusy ? "กำลังสร้าง…" : "⬇ PDF"}
        </button>
        <button
          onClick={() => downloadText(`${job.name || "report"}.md`, buildMarkdown(job, result))}
          className="rounded-xl border border-line bg-panel py-2.5 text-sm font-medium text-ink active:scale-95"
        >
          ⬇ Markdown
        </button>
        <button
          onClick={() => printReport(job, result)}
          className="rounded-xl border border-line bg-panel py-2.5 text-sm font-medium text-ink active:scale-95"
        >
          🖨 พิมพ์
        </button>
        <button
          onClick={() => shareReport(job, result)}
          className="rounded-xl border border-cyan bg-panel py-2.5 text-sm font-medium text-cyan active:scale-95"
        >
          ↗ แชร์
        </button>
        <button
          onClick={onSave}
          className="rounded-xl bg-cyan py-2.5 text-sm font-semibold text-[#062330] active:scale-95"
        >
          {saved ? "✓ บันทึกแล้ว" : "💾 บันทึกงาน"}
        </button>
      </div>

      <button onClick={onEdit} className="no-print w-full py-2 text-sm text-sub underline">
        ← แก้ไขข้อมูล / คำนวณใหม่
      </button>
    </div>
  );
}
