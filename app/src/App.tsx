import { useState } from "react";
import { calculate, type CalcResult, type JobInput } from "./engine";
import { getJob, jobKind, saveJob, uid, type CheckJob, type StoredJob } from "./db";
import Home from "./components/Home";
import JobForm from "./components/JobForm";
import ResultCard from "./components/ResultCard";
import MotorTool from "./components/MotorTool";
import CheckTool from "./components/CheckTool";
import ExtraTools from "./components/ExtraTools";
import MeterTool from "./components/MeterTool";
import Calculators from "./components/Calculators";
import QuizTool from "./components/QuizTool";
import ApplianceTool from "./components/ApplianceTool";
import Footer from "./components/Footer";

type View = "home" | "form" | "result" | "motor" | "check" | "tools" | "meter" | "calc" | "quiz" | "appliance";
type ToolView = "motor" | "check" | "tools" | "meter" | "calc" | "quiz" | "appliance";

function newInput(): JobInput {
  return {
    name: "",
    phase: "1P",
    voltage: 230,
    cableType: "THW",
    installGroup: 2,
    lengthM: 0,
    ambientTempC: 40,
    groupingCircuits: 1,
    loads: [],
    maxCableSizeSqmm: 50,
    tags: [],
  };
}

export default function App() {
  const [view, setView] = useState<View>("home");
  const [input, setInput] = useState<JobInput>(newInput());
  const [result, setResult] = useState<CalcResult | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [checkInitial, setCheckInitial] = useState<{ id: string; check: CheckJob } | null>(null);

  const startNew = () => {
    setInput(newInput());
    setCurrentId(null);
    setResult(null);
    setSaved(false);
    setView("form");
  };

  const openJob = (j: StoredJob) => {
    if (jobKind(j) === "check" && j.check) {
      setCheckInitial({ id: j.id, check: j.check });
      setView("check");
      return;
    }
    setInput(j.input!);
    setCurrentId(j.id);
    setResult(calculate(j.input!));
    setSaved(true);
    setView("result");
  };

  const doCalculate = (job: JobInput) => {
    setInput(job);
    setResult(calculate(job));
    setSaved(false);
    setView("result");
  };

  const doSave = async () => {
    const id = currentId ?? uid();
    const now = Date.now();
    // Preserve the original createdAt when re-saving an existing job.
    let createdAt = now;
    if (currentId) {
      const existing = await getJob(currentId);
      if (existing) createdAt = existing.createdAt;
    }
    await saveJob({ id, createdAt, updatedAt: now, input });
    setCurrentId(id);
    setSaved(true);
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col overflow-x-hidden">
      <header className="no-print flex items-center gap-2.5 border-b border-line px-4 py-3">
        <button onClick={() => setView("home")} className="flex items-center gap-2.5">
          <img src="./logo.png" alt="9SPYRE" className="h-7 w-7 rounded-md border border-cyan/40" />
          <span className="text-[15px] font-medium tracking-wide">
            9SPYRE <span className="text-cyan">Wire</span>
          </span>
        </button>
        <span className="ml-auto text-[11px] text-sub">มาตรฐาน วสท.</span>
      </header>

      <main className="flex-1 px-4 py-4">
        {view === "home" && (
          <Home
            onNew={startNew}
            onOpen={openJob}
            onTool={(t: ToolView) => {
              if (t === "check") setCheckInitial(null);
              setView(t);
            }}
          />
        )}
        {view === "motor" && <MotorTool onBack={() => setView("home")} />}
        {view === "check" && <CheckTool initial={checkInitial} onBack={() => setView("home")} />}
        {view === "tools" && <ExtraTools onBack={() => setView("home")} />}
        {view === "meter" && <MeterTool onBack={() => setView("home")} />}
        {view === "calc" && <Calculators onBack={() => setView("home")} />}
        {view === "quiz" && <QuizTool onBack={() => setView("home")} />}
        {view === "appliance" && (
          <ApplianceTool
            onCalculate={(j) => { setCurrentId(null); doCalculate(j); }}
            onBack={() => setView("home")}
          />
        )}
        {view === "form" && (
          <JobForm initial={input} onCalculate={doCalculate} onCancel={() => setView("home")} />
        )}
        {view === "result" && result && (
          <ResultCard
            job={input}
            result={result}
            saved={saved}
            onSave={doSave}
            onEdit={() => setView("form")}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
