import { useEffect, useMemo, useState } from "react";
import { dailyTipSet, SPONSOR } from "../content/tips";

type Slide =
  | { kind: "tip"; text: string }
  | { kind: "sponsor"; brand: string; text: string; url: string };

const INTERVAL_MS = 6500; // หน่วงพอให้อ่านทัน

export default function TipCarousel() {
  const slides = useMemo<Slide[]>(() => {
    const tips: Slide[] = dailyTipSet(5).map((t) => ({ kind: "tip", text: t }));
    return SPONSOR ? [...tips, { kind: "sponsor", ...SPONSOR }] : tips;
  }, []);

  const [i, setI] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setI((x) => (x + 1) % slides.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  const s = slides[i];
  const advance = () => setI((x) => (x + 1) % slides.length);

  return (
    <div
      onClick={advance}
      className={`rounded-xl border px-3.5 py-3 ${
        s.kind === "sponsor" ? "border-amber-400/30 bg-amber-400/5" : "border-cyan/25 bg-cyan/5"
      }`}
    >
      <div className="mb-0.5 flex items-center justify-between">
        <span className={`text-[11px] font-medium ${s.kind === "sponsor" ? "text-amber-400" : "text-cyan"}`}>
          {s.kind === "sponsor" ? "โฆษณา" : "💡 เกร็ดความรู้"}
        </span>
        <div className="flex gap-1">
          {slides.map((_, idx) => (
            <span key={idx} className={`h-1.5 w-1.5 rounded-full ${idx === i ? "bg-cyan" : "bg-line"}`} />
          ))}
        </div>
      </div>

      {s.kind === "tip" ? (
        <div key={i} className="animate-fade-slide text-[13px] leading-relaxed text-ink/90">
          {s.text}
        </div>
      ) : (
        <div key={i} className="animate-fade-slide">
          <div className="text-[13px] font-medium text-ink">{s.brand}</div>
          <div className="text-[12px] text-ink/80">{s.text}</div>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-block text-[12px] text-amber-400 underline"
          >
            ดูเพิ่มเติม →
          </a>
        </div>
      )}
    </div>
  );
}
