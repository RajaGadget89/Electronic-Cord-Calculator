import type { CalcResult, JobInput, InstallGroup } from "./engine";

const CREATOR = "Pisut Khungkamano";

const GROUP_LABEL: Record<InstallGroup, string> = {
  1: "ร้อยท่อในฝ้า/ผนังกันไฟ (กลุ่ม 1)",
  2: "ร้อยท่อเกาะผนัง/ฝังคอนกรีต (กลุ่ม 2)",
  3: "เดินเกาะผนัง (กลุ่ม 3)",
  4: "บนลูกถ้วยในอากาศ (กลุ่ม 4)",
  5: "ร้อยท่อฝังดิน (กลุ่ม 5)",
  6: "ฝังดินโดยตรง (กลุ่ม 6)",
  7: "บนรางเคเบิล (กลุ่ม 7)",
};
const STATUS_LABEL: Record<string, string> = {
  PASS: "ผ่านทุกเงื่อนไข",
  WARN: "ผ่าน (มีข้อควรทราบ)",
  FAIL: "ไม่ผ่าน",
};

export function statusColor(s: string): string {
  return s === "PASS" ? "#34D399" : s === "WARN" ? "#FBBF24" : "#F87171";
}

function fmt(n: number | null, unit = ""): string {
  return n == null ? "-" : `${n}${unit}`;
}

export function buildMarkdown(job: JobInput, r: CalcResult): string {
  const date = new Date().toLocaleString("th-TH");
  const loads = job.loads
    .map(
      (l, i) =>
        `| ${i + 1} | ${l.label} | ${l.value} ${l.unit} | ${l.quantity} | ${l.pf} |`
    )
    .join("\n");
  return `# รายงานการคำนวณสายไฟและเบรกเกอร์

**ชื่องาน:** ${job.name}
**วันที่:** ${date}
**มาตรฐานอ้างอิง:** การติดตั้งทางไฟฟ้าสำหรับประเทศไทย (วสท.)

## ข้อมูลนำเข้า
- ระบบไฟ: ${job.phase === "1P" ? "1 เฟส" : "3 เฟส"} ${job.voltage} V
- ชนิดสาย: ${job.cableType}
- วิธีติดตั้ง: ${GROUP_LABEL[job.installGroup]}
- ความยาวสาย: ${job.lengthM} เมตร
- อุณหภูมิโดยรอบ: ${job.ambientTempC} °C
- จำนวนกลุ่มวงจร: ${job.groupingCircuits}

| # | ชนิดโหลด | ขนาด | จำนวน | pf |
|---|---|---|---|---|
${loads}

## ผลการคำนวณ
- **สถานะ:** ${STATUS_LABEL[r.status] ?? r.status}
- กระแสโหลดรวม: **${fmt(r.totalCurrentA, " A")}**${r.designCurrentA > r.totalCurrentA ? `\n- กระแสออกแบบ (กฎมอเตอร์ 125%): **${fmt(r.designCurrentA, " A")}**` : ""}
- ขนาดสายแนะนำ: **${fmt(r.cableSizeSqmm, " ตร.มม.")} (${job.cableType})**
- ขนาดสายดินบริภัณฑ์: **${fmt(r.groundSizeSqmm, " ตร.มม.")}** (ตามพิกัดเบรกเกอร์)
- พิกัดกระแสสาย (หลัง derate): ${fmt(r.deratedAmpacityA, " A")} (ฐานตาราง ${fmt(r.baseAmpacityA, " A")})
- แรงดันตก: ${fmt(r.voltageDropPercent, " %")} (เกณฑ์ ≤ 3%)
- เบรกเกอร์แนะนำ: **${fmt(r.breakerA, " A")}**
- ตัวคูณอุณหภูมิ Ca = ${r.ca} · ตัวคูณกลุ่มวงจร Cg = ${r.cg}
${r.warnings.length ? `\n### ข้อควรทราบ\n${r.warnings.map((w) => `- ${w}`).join("\n")}` : ""}
${r.errors.length ? `\n### ข้อผิดพลาด\n${r.errors.map((e) => `- ${e}`).join("\n")}` : ""}

---
> ⚠️ **หมายเหตุสำคัญ:** ผลนี้เป็นการประเมินเบื้องต้นตามมาตรฐาน วสท. ไม่ใช่เอกสารรับรองทางวิศวกรรม — **งานติดตั้งจริงควรให้วิศวกรไฟฟ้าที่มีใบอนุญาตทวนอีกชั้นก่อนใช้งาน**

สร้างโดย ${CREATOR}
`;
}

export function downloadText(filename: string, content: string, mime = "text/markdown"): void {
  // Prepend a UTF-8 BOM for text files so mobile readers don't mis-detect the
  // encoding (Thai UTF-8 shown as "à¸..."). Skip BOM for JSON (breaks JSON.parse).
  const payload = mime.startsWith("text/") ? "﻿" + content : content;
  const blob = new Blob([payload], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareReport(job: JobInput, r: CalcResult): Promise<void> {
  const text = buildMarkdown(job, r);
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title: `รายงาน: ${job.name}`, text });
      return;
    } catch {
      /* user cancelled */
    }
  }
  downloadText(`${job.name || "report"}.md`, text);
}

// Open a print-ready window (Thai font via Google Fonts) → user "Save as PDF".
export function printReport(job: JobInput, r: CalcResult): void {
  const html = buildPrintHtml(job, r);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}

function buildPrintHtml(job: JobInput, r: CalcResult): string {
  const date = new Date().toLocaleString("th-TH");
  const color = statusColor(r.status);
  const rows = job.loads
    .map(
      (l, i) =>
        `<tr><td>${i + 1}</td><td>${l.label}</td><td>${l.value} ${l.unit}</td><td>${l.quantity}</td><td>${l.pf}</td></tr>`
    )
    .join("");
  const stat = STATUS_LABEL[r.status] ?? r.status;
  const warn = r.warnings.length
    ? `<div class="warn"><b>ข้อควรทราบ</b><ul>${r.warnings.map((w) => `<li>${w}</li>`).join("")}</ul></div>`
    : "";
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<title>รายงาน ${job.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  *{font-family:'Sarabun',sans-serif}
  body{color:#12233a;margin:28px;font-size:14px;line-height:1.55}
  h1{color:#0b3d91;font-size:20px;border-bottom:3px solid #22D3EE;padding-bottom:6px}
  h2{color:#0b3d91;font-size:15px;margin:18px 0 6px;border-left:5px solid #22D3EE;padding-left:8px}
  .badge{display:inline-block;padding:4px 14px;border-radius:20px;color:#062330;font-weight:700;background:${color}}
  table{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}
  th{background:#0F2A43;color:#fff;padding:6px 8px;text-align:left}
  td{border:1px solid #d5deea;padding:5px 8px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
  .kv{background:#f4f7fc;border-radius:8px;padding:8px 10px}
  .kv b{color:#0b3d91;font-size:16px}
  .warn{background:#fff8e8;border-left:4px solid #FBBF24;padding:8px 12px;margin-top:12px;border-radius:0 6px 6px 0}
  .foot{margin-top:22px;border-top:1px solid #d5deea;padding-top:8px;color:#5f7d99;font-size:12px}
</style></head><body>
<h1>รายงานการคำนวณสายไฟและเบรกเกอร์</h1>
<p><b>ชื่องาน:</b> ${job.name} &nbsp;•&nbsp; <b>วันที่:</b> ${date}<br>
<b>มาตรฐาน:</b> การติดตั้งทางไฟฟ้าสำหรับประเทศไทย (วสท.)</p>
<p class="badge">${stat}</p>
<h2>ผลการคำนวณ</h2>
<div class="grid">
  <div class="kv">ขนาดสายแนะนำ<br><b>${r.cableSizeSqmm ?? "-"} ตร.มม. (${job.cableType})</b></div>
  <div class="kv">เบรกเกอร์แนะนำ<br><b>${r.breakerA ?? "-"} A</b></div>
  <div class="kv">สายดินบริภัณฑ์<br><b>${r.groundSizeSqmm ?? "-"} ตร.มม.</b></div>
  <div class="kv">กระแสโหลดรวม${r.designCurrentA > r.totalCurrentA ? " / ออกแบบ (125%)" : ""}<br><b>${r.totalCurrentA}${r.designCurrentA > r.totalCurrentA ? ` / ${r.designCurrentA}` : ""} A</b></div>
  <div class="kv">แรงดันตก<br><b>${r.voltageDropPercent ?? "-"} %</b> (≤3%)</div>
  <div class="kv">พิกัดสายหลัง derate<br><b>${r.deratedAmpacityA ?? "-"} A</b></div>
  <div class="kv">Ca / Cg<br><b>${r.ca} / ${r.cg}</b></div>
</div>
<h2>ข้อมูลนำเข้า</h2>
<p>ระบบไฟ ${job.phase === "1P" ? "1 เฟส" : "3 เฟส"} ${job.voltage}V • ${job.cableType} • ${GROUP_LABEL[job.installGroup]} • ยาว ${job.lengthM} ม. • ${job.ambientTempC}°C • ${job.groupingCircuits} กลุ่มวงจร</p>
<table><tr><th>#</th><th>ชนิดโหลด</th><th>ขนาด</th><th>จำนวน</th><th>pf</th></tr>${rows}</table>
${warn}
<div class="foot">⚠️ ผลนี้เป็นการประเมินเบื้องต้นตามมาตรฐาน วสท. ไม่ใช่เอกสารรับรองทางวิศวกรรม — งานติดตั้งจริงควรให้วิศวกรไฟฟ้าที่มีใบอนุญาตทวนอีกชั้นก่อนใช้งาน<br>สร้างโดย ${CREATOR}</div>
</body></html>`;
}
