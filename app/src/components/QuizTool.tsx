import { useState } from "react";
import { QUIZ } from "../content/quiz";

const pick = (exclude: number) => {
  if (QUIZ.length <= 1) return 0;
  let i = exclude;
  while (i === exclude) i = Math.floor(Math.random() * QUIZ.length);
  return i;
};

export default function QuizTool({ onBack }: { onBack: () => void }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUIZ.length));
  const [sel, setSel] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const q = QUIZ[idx];
  const revealed = sel !== null;

  const choose = (i: number) => {
    if (revealed) return;
    setSel(i);
    setScore((s) => ({ correct: s.correct + (i === q.answer ? 1 : 0), total: s.total + 1 }));
  };
  const next = () => { setIdx(pick(idx)); setSel(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-medium text-ink">ติวสอบ — โหมดชิมรส</h2>
        <span className="text-[12px] text-sub">คะแนน {score.correct}/{score.total}</span>
      </div>
      <p className="-mt-2 text-[12px] text-sub">ลับสมองความรู้ไฟฟ้า สุ่มคำถามไปเรื่อย ๆ</p>

      <div className="rounded-2xl border border-line bg-panel/50 p-4">
        <div className="text-[15px] font-medium text-ink">{q.q}</div>
        <div className="mt-3 space-y-2">
          {q.choices.map((c, i) => {
            const isAns = i === q.answer;
            const isSel = i === sel;
            let cls = "border-line bg-base text-ink";
            if (revealed && isAns) cls = "border-pass bg-pass/10 text-pass";
            else if (revealed && isSel && !isAns) cls = "border-fail bg-fail/10 text-fail";
            return (
              <button key={i} onClick={() => choose(i)} disabled={revealed}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-[14px] active:scale-[0.99] ${cls}`}>
                {revealed && isAns ? "✓ " : revealed && isSel ? "✗ " : ""}{c}
              </button>
            );
          })}
        </div>
        {revealed && (
          <div className="mt-3 rounded-lg border border-cyan/30 bg-cyan/5 px-3 py-2 text-[13px] leading-relaxed text-ink/90">
            {sel === q.answer ? "✓ ถูกต้อง! " : "เฉลย: "}{q.explain}
          </div>
        )}
      </div>

      <button onClick={next}
        className="w-full rounded-xl bg-cyan py-3 text-[15px] font-semibold text-[#062330] active:scale-95">
        {revealed ? "ข้อถัดไป →" : "ข้ามข้อนี้ →"}
      </button>

      <div className="rounded-xl border border-warn/30 bg-warn/5 p-3 text-[12px] leading-relaxed text-ink/80">
        นี่คือโหมดชิมรส · เวอร์ชัน Pro (อนาคต) จะมี <strong className="text-ink">คลังข้อสอบเต็ม + ข้อสอบเสมือนจริงจับเวลา + คะแนนความพร้อมสอบ</strong> สำหรับเตรียมสอบใบอนุญาตช่างไฟฟ้า
      </div>

      <button onClick={onBack} className="w-full py-2 text-sm text-sub underline">← กลับหน้าแรก</button>
    </div>
  );
}
