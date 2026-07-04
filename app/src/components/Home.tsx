import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteJob, exportBackup, importBackup, type StoredJob } from "../db";
import { downloadText } from "../report";

const PAGE_SIZE = 10;

type SortKey = "updated_desc" | "updated_asc" | "created_desc" | "created_asc" | "name_asc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "updated_desc", label: "แก้ไขล่าสุด" },
  { key: "updated_asc", label: "แก้ไขเก่าสุด" },
  { key: "created_desc", label: "สร้างล่าสุด" },
  { key: "created_asc", label: "สร้างเก่าสุด" },
  { key: "name_asc", label: "ชื่อ ก–ฮ" },
];

export default function Home({
  onNew,
  onOpen,
}: {
  onNew: () => void;
  onOpen: (job: StoredJob) => void;
}) {
  const all = useLiveQuery(() => db.jobs.toArray(), [], [] as StoredJob[]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("updated_desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = (all ?? []).filter(
      (j) =>
        !term ||
        j.input.name.toLowerCase().includes(term) ||
        j.input.cableType.toLowerCase().includes(term)
    );
    list = list.sort((a, b) => {
      switch (sort) {
        case "updated_asc": return a.updatedAt - b.updatedAt;
        case "created_desc": return b.createdAt - a.createdAt;
        case "created_asc": return a.createdAt - b.createdAt;
        case "name_asc": return a.input.name.localeCompare(b.input.name, "th");
        default: return b.updatedAt - a.updatedAt;
      }
    });
    return list;
  }, [all, q, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(curPage * PAGE_SIZE, curPage * PAGE_SIZE + PAGE_SIZE);

  const doExport = async () => {
    const data = await exportBackup();
    downloadText(`9spyre-backup-${Date.now()}.json`, JSON.stringify(data, null, 2), "application/json");
  };
  const doImport = async (f: File) => {
    try {
      await importBackup(JSON.parse(await f.text()));
      alert("นำเข้าข้อมูลสำเร็จ");
    } catch (e) {
      alert("นำเข้าไม่สำเร็จ: " + (e as Error).message);
    }
  };

  const inputCls = "w-full rounded-lg border border-line bg-base px-3 py-2.5 text-[15px] text-ink outline-none focus:border-cyan";

  return (
    <div className="space-y-4">
      <button
        onClick={onNew}
        className="w-full rounded-xl bg-cyan py-3 text-[15px] font-semibold text-[#062330] active:scale-95"
      >
        + สร้างงานใหม่
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium text-ink">งานที่บันทึก ({filtered.length})</h2>
        <div className="flex gap-2 text-xs">
          <button onClick={doExport} className="rounded-lg border border-line px-2.5 py-1 text-sub active:scale-95">สำรอง</button>
          <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-line px-2.5 py-1 text-sub active:scale-95">กู้คืน</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        </div>
      </div>

      {/* search + sort */}
      {(all?.length ?? 0) > 0 && (
        <div className="flex gap-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="🔍 ค้นหาชื่องาน / ชนิดสาย"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
          />
          <select
            className="rounded-lg border border-line bg-base px-2 py-2.5 text-[13px] text-ink outline-none focus:border-cyan"
            value={sort}
            onChange={(e) => { setSort(e.target.value as SortKey); setPage(0); }}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-sub">
          {q ? "ไม่พบงานที่ค้นหา" : "ยังไม่มีงานที่บันทึก"}
        </div>
      )}

      <div className="space-y-2">
        {pageItems.map((j, i) => {
          const n = curPage * PAGE_SIZE + i + 1;
          return (
            <div key={j.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-3">
              <span className="min-w-[22px] text-center text-[13px] font-medium text-sub">{n}</span>
              <button onClick={() => onOpen(j)} className="min-w-0 flex-1 text-left">
                <div className="truncate font-medium text-ink">{j.input.name || "(ไม่มีชื่อ)"}</div>
                <div className="text-[11px] text-sub">
                  {j.input.cableType} · {j.input.phase === "1P" ? "1φ" : "3φ"} · แก้ไข {new Date(j.updatedAt).toLocaleDateString("th-TH")}
                </div>
              </button>
              <button onClick={() => confirm("ลบงานนี้?") && deleteJob(j.id)} className="px-2 text-sub hover:text-fail" aria-label="ลบ">🗑</button>
            </div>
          );
        })}
      </div>

      {/* pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPage(Math.max(0, curPage - 1))}
            disabled={curPage === 0}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink active:scale-95 disabled:opacity-40"
          >
            ← ก่อนหน้า
          </button>
          <span className="text-[13px] text-sub">หน้า {curPage + 1} / {pageCount}</span>
          <button
            onClick={() => setPage(Math.min(pageCount - 1, curPage + 1))}
            disabled={curPage >= pageCount - 1}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink active:scale-95 disabled:opacity-40"
          >
            ถัดไป →
          </button>
        </div>
      )}
    </div>
  );
}
