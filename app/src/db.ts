import Dexie, { Table } from "dexie";
import type { CableType, CheckInput, JobInput, LoadType, Phase } from "./engine";
import { DEFAULT_LOAD_TYPES } from "./engine";

export type JobKind = "design" | "check";

// A saved "check circuit" job = the check inputs plus name/tags.
export interface CheckJob extends CheckInput {
  name: string;
  tags?: string[];
}

export interface StoredJob {
  id: string;
  createdAt: number;
  updatedAt: number;
  kind?: JobKind;        // undefined = "design" (backward compatible with old records)
  input?: JobInput;      // present when design
  check?: CheckJob;      // present when check
}

// ── Accessors that work for both kinds (and legacy records) ──────────────────
export const jobKind = (j: StoredJob): JobKind => j.kind ?? "design";
export const jobName = (j: StoredJob): string =>
  jobKind(j) === "check" ? j.check?.name ?? "" : j.input?.name ?? "";
export const jobCable = (j: StoredJob): CableType =>
  (jobKind(j) === "check" ? j.check?.cableType : j.input?.cableType) ?? "THW";
export const jobPhase = (j: StoredJob): Phase =>
  (jobKind(j) === "check" ? j.check?.phase : j.input?.phase) ?? "1P";
export const jobTags = (j: StoredJob): string[] =>
  (jobKind(j) === "check" ? j.check?.tags : j.input?.tags) ?? [];

class WireDB extends Dexie {
  jobs!: Table<StoredJob, string>;
  loadTypes!: Table<LoadType, string>;

  constructor() {
    super("nspyre-wire");
    this.version(1).stores({
      jobs: "id, updatedAt",
      loadTypes: "id",
    });
  }
}

export const db = new WireDB();

export const uid = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  Date.now().toString(36) + Math.random().toString(36).slice(2);

export async function saveJob(job: StoredJob): Promise<void> {
  await db.jobs.put({ ...job, updatedAt: Date.now() });
}

export async function deleteJob(id: string): Promise<void> {
  await db.jobs.delete(id);
}

export async function getJob(id: string): Promise<StoredJob | undefined> {
  return db.jobs.get(id);
}

// Custom load types the user adds; merged with presets.
export async function allLoadTypes(): Promise<LoadType[]> {
  const custom = await db.loadTypes.toArray();
  return [...DEFAULT_LOAD_TYPES, ...custom];
}

export async function addLoadType(lt: LoadType): Promise<void> {
  await db.loadTypes.put({ ...lt, isCustom: true });
}

// ── Backup export / import (offline, single JSON file) ───────────────────────
export interface Backup {
  app: "9spyre-wire";
  version: 1;
  exportedAt: number;
  jobs: StoredJob[];
  loadTypes: LoadType[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: "9spyre-wire",
    version: 1,
    exportedAt: Date.now(),
    jobs: await db.jobs.toArray(),
    loadTypes: await db.loadTypes.toArray(),
  };
}

export async function importBackup(data: Backup): Promise<void> {
  if (data?.app !== "9spyre-wire") throw new Error("ไฟล์สำรองไม่ถูกต้อง");
  await db.transaction("rw", db.jobs, db.loadTypes, async () => {
    if (Array.isArray(data.jobs)) await db.jobs.bulkPut(data.jobs);
    if (Array.isArray(data.loadTypes)) await db.loadTypes.bulkPut(data.loadTypes);
  });
}
