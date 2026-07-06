import { jsPDF } from "jspdf";
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
const STATUS_RGB: Record<string, [number, number, number]> = {
  PASS: [52, 211, 153],
  WARN: [217, 149, 12],
  FAIL: [220, 60, 60],
};

function ab2base64(buf: ArrayBuffer): string {
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

let fontCache: { regular: string; bold: string } | null = null;

async function loadFonts(): Promise<{ regular: string; bold: string }> {
  if (fontCache) return fontCache;
  const [reg, bold] = await Promise.all([
    fetch("./fonts/Sarabun-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("./fonts/Sarabun-Bold.ttf").then((r) => r.arrayBuffer()),
  ]);
  fontCache = { regular: ab2base64(reg), bold: ab2base64(bold) };
  return fontCache;
}

export async function exportPdf(job: JobInput, r: CalcResult): Promise<void> {
  const fonts = await loadFonts();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Sarabun-Regular.ttf", fonts.regular);
  doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
  doc.addFileToVFS("Sarabun-Bold.ttf", fonts.bold);
  doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
  doc.setFont("Sarabun", "normal");

  const M = 16; // margin
  const W = 210;
  const contentW = W - M * 2;
  let y = 20;

  const setColor = (hex: [number, number, number]) => doc.setTextColor(hex[0], hex[1], hex[2]);
  const dark: [number, number, number] = [18, 35, 58];
  const blue: [number, number, number] = [11, 61, 145];
  const gray: [number, number, number] = [95, 125, 153];

  // Title
  doc.setFont("Sarabun", "bold");
  doc.setFontSize(18);
  setColor(blue);
  doc.text("รายงานการคำนวณสายไฟและเบรกเกอร์", M, y);
  y += 3;
  doc.setDrawColor(34, 211, 238);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 7;

  // Meta
  doc.setFont("Sarabun", "normal");
  doc.setFontSize(11);
  setColor(dark);
  const date = new Date().toLocaleString("th-TH");
  doc.text(`ชื่องาน: ${job.name}`, M, y);
  y += 5.5;
  doc.text(`วันที่: ${date}`, M, y);
  y += 5.5;
  doc.text("มาตรฐาน: การติดตั้งทางไฟฟ้าสำหรับประเทศไทย (วสท.)", M, y);
  y += 8;

  // Status badge
  const badge = STATUS_RGB[r.status] ?? STATUS_RGB.FAIL;
  doc.setFillColor(badge[0], badge[1], badge[2]);
  doc.roundedRect(M, y - 5, 60, 8, 2, 2, "F");
  doc.setTextColor(6, 35, 48);
  doc.setFont("Sarabun", "bold");
  doc.text(`สถานะ: ${STATUS_LABEL[r.status] ?? r.status}`, M + 4, y);
  y += 10;

  // Results section
  doc.setFont("Sarabun", "bold");
  doc.setFontSize(13);
  setColor(blue);
  doc.text("ผลการคำนวณ", M, y);
  y += 6;
  doc.setFont("Sarabun", "normal");
  doc.setFontSize(11);
  setColor(dark);
  const line = (label: string, val: string) => {
    doc.text(label, M, y);
    doc.setFont("Sarabun", "bold");
    doc.text(val, M + 55, y);
    doc.setFont("Sarabun", "normal");
    y += 6;
  };
  line("ขนาดสายแนะนำ", `${r.cableSizeSqmm ?? "-"} ตร.มม. (${job.cableType})`);
  line("สายดินบริภัณฑ์", `${r.groundSizeSqmm ?? "-"} ตร.มม. (ตามเบรกเกอร์)`);
  line("เบรกเกอร์แนะนำ", `${r.breakerA ?? "-"} A`);
  line("กระแสโหลดรวม", `${r.totalCurrentA} A`);
  if (r.designCurrentA > r.totalCurrentA)
    line("กระแสออกแบบ (มอเตอร์ 125%)", `${r.designCurrentA} A`);
  line("พิกัดสาย (หลัง derate)", `${r.deratedAmpacityA ?? "-"} A`);
  line("แรงดันตก", `${r.voltageDropPercent ?? "-"} % (เกณฑ์ ≤ 3%)`);
  line("ตัวคูณ Ca / Cg", `${r.ca} / ${r.cg}`);
  y += 3;

  // Inputs
  doc.setFont("Sarabun", "bold");
  doc.setFontSize(13);
  setColor(blue);
  doc.text("ข้อมูลนำเข้า", M, y);
  y += 6;
  doc.setFont("Sarabun", "normal");
  doc.setFontSize(11);
  setColor(dark);
  const sys = `ระบบไฟ ${job.phase === "1P" ? "1 เฟส" : "3 เฟส"} ${job.voltage}V · ${job.cableType} · ${GROUP_LABEL[job.installGroup]}`;
  const cond = `ความยาว ${job.lengthM} ม. · อุณหภูมิ ${job.ambientTempC}°C · ${job.groupingCircuits} กลุ่มวงจร`;
  doc.splitTextToSize(sys, contentW).forEach((t: string) => { doc.text(t, M, y); y += 5.5; });
  doc.splitTextToSize(cond, contentW).forEach((t: string) => { doc.text(t, M, y); y += 5.5; });
  y += 2;
  job.loads.forEach((l, i) => {
    doc.text(`• ${i + 1}. ${l.label}: ${l.value} ${l.unit} × ${l.quantity} (pf ${l.pf})`, M + 2, y);
    y += 5.5;
  });

  // Warnings
  if (r.warnings.length) {
    y += 3;
    doc.setFont("Sarabun", "bold");
    setColor(blue);
    doc.text("ข้อควรทราบ", M, y);
    y += 6;
    doc.setFont("Sarabun", "normal");
    setColor([120, 90, 20]);
    r.warnings.forEach((w) => {
      doc.splitTextToSize(`• ${w}`, contentW).forEach((t: string) => {
        doc.text(t, M + 2, y);
        y += 5.5;
      });
    });
  }

  // Footer
  const fy = 285;
  doc.setDrawColor(213, 222, 234);
  doc.setLineWidth(0.3);
  doc.line(M, fy - 4, W - M, fy - 4);
  doc.setFont("Sarabun", "normal");
  doc.setFontSize(9);
  setColor(gray);
  doc.text("เครื่องมือช่วยประเมินเบื้องต้น ไม่ใช่เอกสารรับรองทางวิศวกรรม", M, fy);
  doc.text(`สร้างโดย ${CREATOR}`, M, fy + 4);

  const safe = (job.name || "report").replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim() || "report";
  doc.save(`${safe}.pdf`);
}
