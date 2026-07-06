import type { Phase } from "../engine";

// พรีเซ็ตเครื่องใช้ไฟฟ้า — ค่ากำลังไฟเป็น "ค่าประมาณทั่วไป" ผู้ใช้ควรปรับให้ตรงป้ายเครื่องจริง
export interface Appliance {
  id: string;
  category: string;
  label: string;
  phase: Phase;
  watts: number;
  pf: number;
  isMotor: boolean;
}

export const APPLIANCES: Appliance[] = [
  // แอร์ (คอมเพรสเซอร์ = มอเตอร์ · watts ≈ BTU/10 โดยประมาณ)
  { id: "ac9000", category: "แอร์", label: "แอร์ 9,000 BTU", phase: "1P", watts: 900, pf: 0.9, isMotor: true },
  { id: "ac12000", category: "แอร์", label: "แอร์ 12,000 BTU", phase: "1P", watts: 1200, pf: 0.9, isMotor: true },
  { id: "ac18000", category: "แอร์", label: "แอร์ 18,000 BTU", phase: "1P", watts: 1800, pf: 0.9, isMotor: true },
  { id: "ac24000", category: "แอร์", label: "แอร์ 24,000 BTU", phase: "1P", watts: 2400, pf: 0.9, isMotor: true },
  { id: "ac36000", category: "แอร์", label: "แอร์ 36,000 BTU", phase: "1P", watts: 3600, pf: 0.9, isMotor: true },
  // เครื่องทำน้ำอุ่น (ความร้อน = pf 1)
  { id: "wh3500", category: "เครื่องทำน้ำอุ่น", label: "เครื่องทำน้ำอุ่น 3,500W", phase: "1P", watts: 3500, pf: 1, isMotor: false },
  { id: "wh4500", category: "เครื่องทำน้ำอุ่น", label: "เครื่องทำน้ำอุ่น 4,500W", phase: "1P", watts: 4500, pf: 1, isMotor: false },
  { id: "wh6000", category: "เครื่องทำน้ำอุ่น", label: "เครื่องทำน้ำอุ่น 6,000W", phase: "1P", watts: 6000, pf: 1, isMotor: false },
  // ปั๊ม (มอเตอร์)
  { id: "pump_half", category: "ปั๊มน้ำ", label: "ปั๊มน้ำ 1/2 HP", phase: "1P", watts: 370, pf: 0.8, isMotor: true },
  { id: "pump1", category: "ปั๊มน้ำ", label: "ปั๊มน้ำ 1 HP", phase: "1P", watts: 750, pf: 0.8, isMotor: true },
  { id: "pump2", category: "ปั๊มน้ำ", label: "ปั๊มน้ำ 2 HP", phase: "1P", watts: 1500, pf: 0.8, isMotor: true },
  // ครัว/ในบ้าน (ความร้อน = pf 1)
  { id: "stove2000", category: "ในครัว/บ้าน", label: "เตาไฟฟ้า/เตาอบ 2,000W", phase: "1P", watts: 2000, pf: 1, isMotor: false },
  { id: "kettle", category: "ในครัว/บ้าน", label: "กาต้มน้ำ/หม้อหุงข้าว 1,500W", phase: "1P", watts: 1500, pf: 1, isMotor: false },
  { id: "microwave", category: "ในครัว/บ้าน", label: "ไมโครเวฟ 1,200W", phase: "1P", watts: 1200, pf: 1, isMotor: false },
  { id: "fridge", category: "ในครัว/บ้าน", label: "ตู้เย็น/ตู้แช่", phase: "1P", watts: 200, pf: 0.8, isMotor: true },
];

export const APPLIANCE_CATEGORIES = Array.from(new Set(APPLIANCES.map((a) => a.category)));
