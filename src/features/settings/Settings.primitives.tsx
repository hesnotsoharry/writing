/** Shared primitive components for the Settings sheet. */

// ── SetRow ────────────────────────────────────────────────────────────────────

export interface SetRowProps {
  label: string;
  desc?: string;
  last?: boolean;
  children: React.ReactNode;
}

export function SetRow({ label, desc, last, children }: SetRowProps) {
  return (
    <div className="set-row" style={last ? { borderBottom: "none" } : undefined}>
      <div className="set-row-l">
        <div className="set-row-label">{label}</div>
        {desc && <div className="set-row-desc">{desc}</div>}
      </div>
      <div className="set-row-c">{children}</div>
    </div>
  );
}

// ── Seg ───────────────────────────────────────────────────────────────────────

export interface SegProps {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}

export function Seg({ value, options, onChange }: SegProps) {
  return (
    <div className="set-seg">
      {options.map(([v, l]) => (
        <button key={v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

// ── SetToggle ─────────────────────────────────────────────────────────────────

export interface SetToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
}

export function SetToggle({ value, onChange }: SetToggleProps) {
  return (
    <div className={"toggle" + (value ? " on" : "")} onClick={() => onChange(!value)} />
  );
}

// ── SetSelect ─────────────────────────────────────────────────────────────────

export interface SetSelectProps {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}

export function SetSelect({ value, options, onChange }: SetSelectProps) {
  return (
    <select className="set-select" value={value} onChange={e => onChange(e.target.value)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

// ── SetChips ──────────────────────────────────────────────────────────────────

export interface SetChipsProps {
  /** [value, label] pairs for each chip. */
  options: [string, string][];
  /** Currently selected values (multi-select). */
  value: string[];
  onChange: (v: string[]) => void;
}

export function SetChips({ options, value, onChange }: SetChipsProps) {
  function toggle(v: string): void {
    const next = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
    onChange(next);
  }
  return (
    <div className="set-chips">
      {options.map(([v, l]) => (
        <button key={v} className={"set-chip" + (value.includes(v) ? " on" : "")} onClick={() => toggle(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
