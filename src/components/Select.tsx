import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type Option = { value: string; label: string };

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
};

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Selecionar…",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState<number>(-1);

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  );

  // fechar ao clicar fora
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // mover foco com teclado quando aberto
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const max = options.length - 1;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i < max ? i + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i > 0 ? i - 1 : max));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const opt = options[activeIdx];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, options, activeIdx, onChange]);

  useEffect(() => {
    // ao abrir, ativa o índice do selecionado
    if (open) {
      const idx = Math.max(0, options.findIndex((o) => o.value === value));
      setActiveIdx(idx);
    }
  }, [open, options, value]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-2 py-1 rounded-md bg-neutral-800 border border-white/10 text-white outline-none flex items-center justify-between"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">
          {selected ? selected.label : <span className="text-white/60">{placeholder}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border border-white/10 bg-neutral-900 shadow-lg"
        >
          {options.map((opt, idx) => {
            const selected = opt.value === value;
            const active = idx === activeIdx;
            return (
              <div
                key={opt.value || "any"}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`px-2 py-1.5 cursor-pointer text-sm ${
                  active ? "bg-white/10" : ""
                } ${selected ? "text-emerald-400" : "text-white"}`}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
