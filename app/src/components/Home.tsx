import { useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteJob, exportBackup, importBackup, type StoredJob } from "../db";
import { downloadText } from "../report";

export default function Home({
  onNew,
  onOpen,
}: {
  onNew: () => void;
  onOpen: (job: StoredJob) => void;
}) {
  const jobs = useLiveQuery(
    () => db.jobs.orderBy("updatedAt").reverse().toArray(),
    [],
    [] as StoredJob[]
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    const data = await exportBackup();
    downloadText(`9spyre-backup-${Date.now()}.json`, JSON.stringify(data, null, 2), "application/json");
  };
  const doImport = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      await importBackup(data);
      alert("นำเข้าข้อมูลสำเร็จ");
    } catch (e) {
      alert("นำเข้าไม่สำเร็จ: " + (e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onNew}
        className="w-full rounded-xl bg-cyan py-3 text-sm font-semibold text-[#062330] active:scale-95"
      >
        + สร้างงานใหม่
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">งานที่บันทึก</h2>
        <div className="flex gap-2 text-xs">
          <button onClick={doExport} className="rounded-lg border border-line px-2.5 py-1 text-sub active:scale-95">
            สำรอง
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-line px-2.5 py-1 text-sub active:scale-95">
            กู้คืน
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
        </div>
      </div>

      {(!jobs || jobs.length === 0) && (
        <div className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-sub">
          ยังไม่มีงานที่บันทึก
        </div>
      )}

      <div className="space-y-2">
        {jobs?.map((j) => (
          <div key={j.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3.5 py-3">
            <button onClick={() => onOpen(j)} className="min-w-0 flex-1 text-left">
              <div className="truncate font-medium text-ink">{j.input.name || "(ไม่มีชื่อ)"}</div>
              <div className="text-[11px] text-sub">
                {j.input.cableType} · {j.input.phase === "1P" ? "1φ" : "3φ"} ·{" "}
                {new Date(j.updatedAt).toLocaleDateString("th-TH")}
              </div>
            </button>
            <button
              onClick={() => confirm("ลบงานนี้?") && deleteJob(j.id)}
              className="px-2 text-sub hover:text-fail"
              aria-label="ลบ"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
