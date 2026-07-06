import { useState, type ReactNode } from "react";

export const inputCls =
  "w-full rounded-lg border border-line bg-base px-3 py-2.5 text-[15px] text-ink outline-none focus:border-cyan";

export function InfoDot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="คำอธิบาย"
      className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-sub text-[11px] font-medium leading-none text-sub active:scale-90"
    >
      i
    </button>
  );
}

export function HelpBox({ text }: { text: string }) {
  return (
    <div className="mb-1.5 rounded-lg border border-cyan/30 bg-cyan/5 px-3 py-2 text-[12px] leading-relaxed text-ink/90">
      {text}
    </div>
  );
}

/** Labelled field with an optional ⓘ help toggle. */
export function Field({
  label,
  help,
  required,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <label className="text-[13px] text-sub">
          {label}
          {required && <span className="text-fail"> *</span>}
        </label>
        {help && <InfoDot onClick={() => setOpen((o) => !o)} />}
      </div>
      {help && open && <HelpBox text={help} />}
      {children}
    </div>
  );
}
