import Dexie, { Table } from "dexie";
import type { JobInput, LoadType } from "./engine";
import { DEFAULT_LOAD_TYPES } from "./engine";

export interface StoredJob {
  id: string;
  createdAt: number;
  updatedAt: number;
  input: JobInput;
}

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
