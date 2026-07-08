import type { Phase } from "../engine";

// พรีเซ็ตเครื่องใช้ไฟฟ้าสำหรับช่างมือใหม่
// - อุปกรณ์ที่ "ขนาดมาตรฐานชัดเจน" (แอร์ตาม BTU, ปั๊มตาม HP) → แยกเป็นตัวเลือกตามขนาด
// - อุปกรณ์ที่ "มีหลายขนาด" (ไมโครเวฟ/เตา/กาต้ม ฯลฯ) → ใช้ชื่อกลาง ๆ แล้วให้กรอกกำลังไฟเอง
//   watts เป็นเพียงค่าเริ่มต้นโดยประมาณ ผู้ใช้ควรปรับให้ตรงป้ายเครื่องจริง
// loadTypeId แมปกับชนิดโหลดจริง (DEFAULT_LOAD_TYPES) เพื่อความเข้ากันได้เวลาเปิดงานย้อนหลัง
export interface Appliance {
  id: string;
  category: string;
  label: string;
  phase: Phase;
  watts: number;
  pf: number;
  isMotor: boolean;
  loadTypeId: string;
  custom?: boolean; // true = ขนาดหลากหลาย ควรกรอกกำลังไฟตามป้ายเครื่อง
}

export const APPLIANCES: Appliance[] = [
  // แอร์ — เลือกตาม BTU (คอมเพรสเซอร์ = มอเตอร์ · watts ≈ BTU/10 โดยประมาณ)
  { id: "ac9000", category: "แอร์", label: "แอร์ 9,000 BTU", phase: "1P", watts: 900, pf: 0.9, isMotor: true, loadTypeId: "ac" },
  { id: "ac12000", category: "แอร์", label: "แอร์ 12,000 BTU", phase: "1P", watts: 1200, pf: 0.9, isMotor: true, loadTypeId: "ac" },
  { id: "ac18000", category: "แอร์", label: "แอร์ 18,000 BTU", phase: "1P", watts: 1800, pf: 0.9, isMotor: true, loadTypeId: "ac" },
  { id: "ac24000", category: "แอร์", label: "แอร์ 24,000 BTU", phase: "1P", watts: 2400, pf: 0.9, isMotor: true, loadTypeId: "ac" },
  { id: "ac36000", category: "แอร์", label: "แอร์ 36,000 BTU", phase: "1P", watts: 3600, pf: 0.9, isMotor: true, loadTypeId: "ac" },
  // ปั๊มน้ำ — เลือกตามแรงม้า (มอเตอร์)
  { id: "pump_half", category: "ปั๊มน้ำ", label: "ปั๊มน้ำ 1/2 HP", phase: "1P", watts: 370, pf: 0.8, isMotor: true, loadTypeId: "pump" },
  { id: "pump1", category: "ปั๊มน้ำ", label: "ปั๊มน้ำ 1 HP", phase: "1P", watts: 750, pf: 0.8, isMotor: true, loadTypeId: "pump" },
  { id: "pump2", category: "ปั๊มน้ำ", label: "ปั๊มน้ำ 2 HP", phase: "1P", watts: 1500, pf: 0.8, isMotor: true, loadTypeId: "pump" },
  // เครื่องทำน้ำอุ่น / น้ำร้อน — มีหลายขนาด กรอกกำลังไฟตามป้ายเครื่อง
  { id: "waterheater", category: "เครื่องทำน้ำอุ่น", label: "เครื่องทำน้ำอุ่น", phase: "1P", watts: 4500, pf: 1, isMotor: false, loadTypeId: "heater", custom: true },
  { id: "waterheatpump", category: "เครื่องทำน้ำอุ่น", label: "ฮีตปั๊มทำน้ำร้อน", phase: "1P", watts: 1200, pf: 0.9, isMotor: true, loadTypeId: "ac", custom: true },
  // ในครัว/บ้าน — มีหลายขนาด กรอกกำลังไฟเอง
  { id: "microwave", category: "ในครัว/บ้าน", label: "ไมโครเวฟ", phase: "1P", watts: 1200, pf: 1, isMotor: false, loadTypeId: "heater", custom: true },
  { id: "stove", category: "ในครัว/บ้าน", label: "เตาไฟฟ้า / เตาอบ", phase: "1P", watts: 2000, pf: 1, isMotor: false, loadTypeId: "heater", custom: true },
  { id: "kettle", category: "ในครัว/บ้าน", label: "กาต้มน้ำ / หม้อหุงข้าว", phase: "1P", watts: 1500, pf: 1, isMotor: false, loadTypeId: "heater", custom: true },
  { id: "fridge", category: "ในครัว/บ้าน", label: "ตู้เย็น / ตู้แช่", phase: "1P", watts: 200, pf: 0.8, isMotor: true, loadTypeId: "fridge", custom: true },
  { id: "washer", category: "ในครัว/บ้าน", label: "เครื่องซักผ้า", phase: "1P", watts: 500, pf: 0.8, isMotor: true, loadTypeId: "pump", custom: true },
  // อื่น ๆ — กำหนดเองทั้งหมด
  { id: "other", category: "อื่น ๆ", label: "อุปกรณ์อื่น ๆ (กำหนดเอง)", phase: "1P", watts: 1000, pf: 1, isMotor: false, loadTypeId: "socket", custom: true },
];

export const APPLIANCE_CATEGORIES = Array.from(new Set(APPLIANCES.map((a) => a.category)));
