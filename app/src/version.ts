// Single source of truth for the app version + change history.
// Update APP_VERSION and prepend a CHANGELOG entry on every release.
// The same data feeds the on-screen version label and the user manual.

export const APP_VERSION = "1.7.0";

export interface ChangeEntry {
  version: string;
  date: string; // ISO yyyy-mm-dd
  changes: string[];
}

export const CHANGELOG: ChangeEntry[] = [
  {
    version: "1.7.0",
    date: "2026-07-06",
    changes: [
      "เพิ่มคู่มือการใช้งาน (PDF) เปิดได้จากหน้าแรก",
      "เพิ่มไอคอนช่วยเหลือ ⓘ อธิบายช่อง กลุ่มวงจร / อุณหภูมิ / pf / แท็ก",
      "แสดงหมายเลขเวอร์ชันในหน้าแรก + เริ่มระบบบันทึกประวัติเวอร์ชัน",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-07-06",
    changes: ["เพิ่มการคำนวณขนาดสายดินบริภัณฑ์ตามพิกัดเบรกเกอร์ (วสท. ตารางที่ 6-11)"],
  },
  {
    version: "1.5.0",
    date: "2026-07-06",
    changes: ["หน้าแรก: เพิ่มแท็ก/หมวดหมู่ + ฟิลเตอร์, เลือกจำนวนต่อหน้า (10/25/50), ทำซ้ำงาน"],
  },
  {
    version: "1.4.0",
    date: "2026-07-06",
    changes: ["หน้าแรก: เพิ่มค้นหา, จัดเรียง (แก้ไข/สร้าง/ชื่อ), แบ่งหน้า และเลขลำดับงาน"],
  },
  {
    version: "1.3.0",
    date: "2026-07-06",
    changes: ["เพิ่มปุ่มคัดลอกข้อความรายงาน และส่งออก PDF กดปุ่มเดียว (ฝังฟอนต์ไทย Sarabun)"],
  },
  {
    version: "1.2.0",
    date: "2026-07-06",
    changes: ["แก้ไฟล์ Markdown ที่ส่งออกให้แสดงภาษาไทยถูกต้องบนมือถือ (UTF-8 BOM)"],
  },
  {
    version: "1.1.0",
    date: "2026-07-06",
    changes: [
      "แก้การแสดงผลบนมือถือให้เต็มจอ อ่านง่ายขึ้น",
      "ตรวจสอบข้อมูลแบบเรียลไทม์ (ขึ้นเตือนสีแดงทันที) + ปิดปุ่มคำนวณจนกรอกครบ",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-07-06",
    changes: [
      "เวอร์ชันแรก: คำนวณขนาดสาย/เบรกเกอร์/แรงดันตกตามมาตรฐาน วสท.",
      "รองรับสาย THW, VAF, VCT, NYY · 1 เฟส/3 เฟส · บันทึกงานออฟไลน์ · ออกรายงาน",
    ],
  },
];
