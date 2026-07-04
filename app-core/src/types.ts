// Core domain types for the wire/breaker calculation engine.
// Standard reference: มาตรฐานการติดตั้งทางไฟฟ้าสำหรับประเทศไทย (วสท./EIT)

export type Phase = "1P" | "3P";
export type CableType = "THW" | "VAF" | "VCT" | "NYY";

// Installation method groups per วสท. Table 5-47 (7 groups).
export type InstallGroup = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Which ampacity table applies, derived from the install group.
export type AmpacityTable = "5-20" | "5-21" | "5-22" | "5-23";

export type ValueUnit = "W" | "A";

export interface LoadType {
  id: string;
  name: string;      // e.g. "ปั๊มน้ำ/มอเตอร์"
  pf: number;        // power factor, 0 < pf <= 1
  isCustom: boolean;
}

export interface LoadItem {
  loadTypeId: string;
  label: string;
  unit: ValueUnit;   // entered as Watts or Amps
  value: number;     // magnitude in the chosen unit (per single load)
  quantity: number;  // how many identical loads
  pf: number;        // effective pf (from LoadType, user-overridable)
}

export interface JobInput {
  name: string;
  phase: Phase;
  voltage: number;          // 230 (1P) or 400 (3P)
  cableType: CableType;
  installGroup: InstallGroup;
  lengthM: number;          // one-way run length (metres)
  ambientTempC: number;     // default 40
  groupingCircuits: number; // number of circuit-groups in the raceway, default 1
  loads: LoadItem[];
  maxCableSizeSqmm?: number; // scope cap, default 50
}

export type ResultStatus = "PASS" | "WARN" | "FAIL";

export interface CalcResult {
  status: ResultStatus;
  totalCurrentA: number;
  breakerA: number | null;
  cableSizeSqmm: number | null;
  groundSizeSqmm: number | null;  // equipment grounding conductor (by breaker)
  baseAmpacityA: number | null;   // table value before derating
  deratedAmpacityA: number | null; // after Ca x Cg
  voltageDropPercent: number | null;
  ca: number;                     // ambient factor
  cg: number;                     // grouping factor
  warnings: string[];
  errors: string[];
  // provenance / trust
  ampacityVerified: boolean;      // false if the chosen cell is not yet officially transcribed
  voltageDropAvailable: boolean;  // false if R/X data not yet transcribed
}
