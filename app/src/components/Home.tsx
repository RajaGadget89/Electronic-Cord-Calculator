import { useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db, deleteJob, exportBackup, importBackup, uid,
  jobKind, jobName, jobCable, jobPhase, jobTags,
  type JobKind, type StoredJob,
} from "../db";
import { downloadText } from "../report";
import { APP_VERSION } from "../version";
import TipCarousel from "./TipCarousel";

type ToolView = "motor" | "check" | "tools" | "meter" | "calc" | "quiz" | "appliance";

type SortKey = "updated_desc" | "updated_asc" | "created_desc" | "created_asc" | "name_asc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "updated_desc", label: "แก้ไขล่าสุด" },
  { key: "updated_asc", label: "แก้ไขเก่าสุด" },
  { key: "created_desc", label: "สร้างล่าสุด" },
  { key: "created_asc", label: "สร้างเก่าสุด" },
  { key: "name_asc", label: "ชื่อ ก–ฮ" },
];
const PAGE_SIZES = [10, 25, 50];

export default function Home({
  onNew,
  onOpen,
  onTool,
}: {
  onNew: () => void;
  onOpen: (job: StoredJob) => void;
  onTool: (t: ToolView) => void;
}) {
  const all = useLiveQuery(() => db.jobs.toArray(), [], [] as StoredJob[]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("updated_desc");
  const [tag, setTag] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<JobKind | "all">("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    (all ?? []).forEach((j) => jobTags(j).forEach((t) => s.add(t)));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "th"));
  }, [all]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (all ?? []).filter((j) => {
      const tags = jobTags(j);
      const matchQ =
        !term ||
        jobName(j).toLowerCase().includes(term) ||
        jobCable(j).toLowerCase().includes(term) ||
        tags.some((t) => t.toLowerCase().includes(term));
      const matchTag = !tag || tags.includes(tag);
      const matchKind = kindFilter === "all" || jobKind(j) === kindFilter;
      return matchQ && matchTag && matchKind;
    });
    return list.sort((a, b) => {
      switch (sort) {
        case "updated_asc": return a.updatedAt - b.updatedAt;
        case "created_desc": return b.createdAt - a.createdAt;
        case "created_asc": return a.createdAt - b.createdAt;
        case "name_asc": return jobName(a).localeCompare(jobName(b), "th");
        default: return b.updatedAt - a.updatedAt;
      }
    });
  }, [all, q, sort, tag, kindFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(curPage * pageSize, curPage * pageSize + pageSize);

  const resetPage = () => setPage(0);

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
  const duplicate = async (j: StoredJob) => {
    const now = Date.now();
    const copyName = `${jobName(j) || "งาน"} (สำเนา)`;
    if (jobKind(j) === "check" && j.check) {
      await db.jobs.put({ id: uid(), createdAt: now, updatedAt: now, kind: "check", check: { ...j.check, name: copyName } });
    } else if (j.input) {
      await db.jobs.put({ id: uid(), createdAt: now, updatedAt: now, kind: "design", input: { ...j.input, name: copyName } });
    }
  };

  const inputCls = "w-full rounded-lg border border-line bg-base px-3 py-2.5 text-[15px] text-ink outline-none focus:border-cyan";
  const selCls = "rounded-lg border border-line bg-base px-2 py-2.5 text-[13px] text-ink outline-none focus:border-cyan";

  return (
    <div className="space-y-4">
      <button onClick={onNew} className="w-full rounded-xl bg-cyan py-3 text-[15px] font-semibold text-[#062330] active:scale-95">
        + สร้างงานใหม่
      </button>

      <div className="flex items-center justify-between text-[13px]">
        <a
          href="./manual.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-cyan active:scale-95"
        >
          📖 คู่มือการใช้งาน
        </a>
        <span className="text-sub">เวอร์ชัน {APP_VERSION}</span>
      </div>

      {/* เกร็ดความรู้ประจำวัน (สไลด์วน) */}
      <TipCarousel />

      <div>
        <div className="mb-1.5 text-[13px] text-sub">เครื่องมือช่าง</div>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["appliance", "❄️", "เครื่องใช้ไฟฟ้า"],
            ["motor", "⚙️", "ปั๊ม/มอเตอร์"],
            ["check", "🔍", "ตรวจสอบวงจร"],
            ["meter", "🔌", "มิเตอร์/สายเมน"],
            ["tools", "🧰", "ท่อ/ระยะสาย"],
            ["calc", "🧮", "เครื่องคิดเลข"],
            ["quiz", "🎓", "ติวสอบ"],
          ] as const).map(([t, icon, label]) => (
            <button key={t} onClick={() => onTool(t)} className="rounded-xl border border-line bg-panel px-2 py-3 text-center text-[13px] text-ink active:scale-95">
              <div className="text-lg">{icon}</div>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium text-ink">งานที่บันทึก ({filtered.length})</h2>
        <div className="flex gap-2 text-xs">
          <button onClick={doExport} className="rounded-lg border border-line px-2.5 py-1 text-sub active:scale-95">สำรอง</button>
          <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-line px-2.5 py-1 text-sub active:scale-95">กู้คืน</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        </div>
      </div>

      {(all?.length ?? 0) > 0 && (
        <>
          <div className="flex gap-2">
            <input className={`${inputCls} flex-1`} placeholder="🔍 ค้นหาชื่องาน / ชนิดสาย / แท็ก" value={q} onChange={(e) => { setQ(e.target.value); resetPage(); }} />
            <select className={selCls} value={sort} onChange={(e) => { setSort(e.target.value as SortKey); resetPage(); }}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          <div className="flex gap-2 text-[13px]">
            {([["all", "ทั้งหมด"], ["design", "🔧 ออกแบบ"], ["check", "🔍 ตรวจสอบ"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => { setKindFilter(k); resetPage(); }}
                className={`flex-1 rounded-lg border px-2 py-1.5 active:scale-95 ${kindFilter === k ? "border-cyan bg-cyan/15 text-cyan" : "border-line text-sub"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {allTags.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <Chip active={tag === null} onClick={() => { setTag(null); resetPage(); }}>ทั้งหมด</Chip>
              {allTags.map((t) => (
                <Chip key={t} active={tag === t} onClick={() => { setTag(tag === t ? null : t); resetPage(); }}>#{t}</Chip>
              ))}
            </div>
          )}
        </>
      )}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-sub">
          {q || tag ? "ไม่พบงานที่ค้นหา" : "ยังไม่มีงานที่บันทึก"}
        </div>
      )}

      <div className="space-y-2">
        {pageItems.map((j, i) => {
          const n = curPage * pageSize + i + 1;
          const tags = jobTags(j);
          const isCheck = jobKind(j) === "check";
          return (
            <div key={j.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-3">
              <span className="min-w-[22px] text-center text-[13px] font-medium text-sub">{n}</span>
              <button onClick={() => onOpen(j)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${isCheck ? "bg-warn/15 text-warn" : "bg-cyan/15 text-cyan"}`}>
                    {isCheck ? "🔍 ตรวจสอบ" : "🔧 ออกแบบ"}
                  </span>
                  <span className="truncate font-medium text-ink">{jobName(j) || "(ไม่มีชื่อ)"}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-sub">
                  {jobCable(j)} · {jobPhase(j) === "1P" ? "1φ" : "3φ"} · แก้ไข {new Date(j.updatedAt).toLocaleDateString("th-TH")}
                </div>
                {tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span key={t} className="rounded-full bg-base px-2 py-0.5 text-[10px] text-cyan">#{t}</span>
                    ))}
                  </div>
                )}
              </button>
              <button onClick={() => duplicate(j)} className="px-1.5 text-sub hover:text-cyan" aria-label="ทำซ้ำ" title="ทำซ้ำ">⧉</button>
              <button onClick={() => confirm("ลบงานนี้?") && deleteJob(j.id)} className="px-1.5 text-sub hover:text-fail" aria-label="ลบ" title="ลบ">🗑</button>
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between pt-1 text-[13px]">
          <label className="flex items-center gap-1.5 text-sub">
            ต่อหน้า
            <select className={selCls} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(0, curPage - 1))} disabled={curPage === 0} className="rounded-lg border border-line px-2.5 py-1.5 text-ink active:scale-95 disabled:opacity-40">←</button>
              <span className="text-sub">{curPage + 1}/{pageCount}</span>
              <button onClick={() => setPage(Math.min(pageCount - 1, curPage + 1))} disabled={curPage >= pageCount - 1} className="rounded-lg border border-line px-2.5 py-1.5 text-ink active:scale-95 disabled:opacity-40">→</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-[12px] active:scale-95 ${
        active ? "border-cyan bg-cyan/15 text-cyan" : "border-line text-sub"
      }`}
    >
      {children}
    </button>
  );
}
