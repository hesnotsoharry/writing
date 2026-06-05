/**
 * FocusHud — translucent bottom-right overlay shown during focus mode.
 *
 * Shows: word count · primary amount-goal ring + progress · streak flame ·
 * optional session timer. Fades out after 2 s without activity; always visible
 * while the settings popover is open.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "../../components/Icon";
import type { FocusSettings, FocusSettingsHook } from "./useFocusSettings";

export interface HudGoalInfo {
  current: number;
  target: number;
  pct: number;
  streak: number;
  /** User-visible goal type name, e.g. "Daily word count". Omit to hide. */
  name?: string;
}

interface FocusHudProps {
  wordCount: number;
  goal: HudGoalInfo;
  goalOn: boolean;
  settingsHook: FocusSettingsHook;
}

// ── GoalRing ──────────────────────────────────────────────────────────────────

function GoalRing({ pct, current, target }: { pct: number; current: number; target: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, pct));
  return (
    <div className="hud-stat" style={{ gap: 7 }}>
      <span className="hud-ring">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r={r} fill="none" stroke="var(--parchment-deep)" strokeWidth="2.5" />
          <circle cx="12" cy="12" r={r} fill="none" stroke="var(--accent)" strokeWidth="2.5"
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
            transform="rotate(-90 12 12)" />
        </svg>
      </span>
      <span>{current.toLocaleString()} / {target.toLocaleString()}</span>
    </div>
  );
}

// ── SessionTimer — separate component so key-remount resets the clock ────────

function padT(n: number) { return String(n).padStart(2, "0"); }
function fmtElapsed(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${padT(h)}:${padT(m)}:${padT(s % 60)}` : `${padT(m)}:${padT(s % 60)}`;
}

function SessionTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hud-stat">
      <Icon name="clock" className="ic" style={{ width: 14, height: 14, color: "var(--ink-3)" }} />
      &nbsp;{fmtElapsed(elapsed)}
    </div>
  );
}

// ── SettingsPopover ───────────────────────────────────────────────────────────

function SettingRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="hud-set-row">
      <span className="hud-set-label">{label}</span>
      <button className={`toggle${on ? " on" : ""}`} role="switch" aria-checked={on}
        aria-label={label} onClick={onToggle} />
    </div>
  );
}

function SettingsPopover({ settings, onToggle, onClose }: {
  settings: FocusSettings; onToggle: (k: keyof FocusSettings) => void; onClose: () => void;
}) {
  return (
    <>
      <div className="hud-set-backdrop" onClick={onClose} />
      <div className="hud-set-pop">
        <SettingRow label="Typewriter scroll" on={settings.typewriter} onToggle={() => onToggle("typewriter")} />
        <SettingRow label="Dim other paragraphs" on={settings.dimParagraphs} onToggle={() => onToggle("dimParagraphs")} />
        <SettingRow label="Word count & goal" on={settings.hud} onToggle={() => onToggle("hud")} />
        <SettingRow label="Session timer" on={settings.timer} onToggle={() => onToggle("timer")} />
      </div>
    </>
  );
}

// ── useFadeActivity ───────────────────────────────────────────────────────────

function useFadeActivity(pinned: boolean): { faded: boolean; reset: () => void } {
  const [faded, setFaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setFaded(false);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFaded(true), 2000);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", reset, { passive: true });
    window.addEventListener("mousemove", reset, { passive: true });
    timerRef.current = setTimeout(() => setFaded(true), 2000);
    return () => {
      window.removeEventListener("keydown", reset);
      window.removeEventListener("mousemove", reset);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [reset]);

  useEffect(() => {
    if (!pinned) return;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, [pinned]);

  return { faded: pinned ? false : faded, reset };
}

// ── HudStats — the visible data section (extracted to keep FocusHud ≤40) ────

function HudStats({ wordCount, goal, goalOn, settings, timerKey }: {
  wordCount: number; goal: HudGoalInfo; goalOn: boolean;
  settings: FocusSettings; timerKey: number;
}) {
  const showRing = goalOn && goal.target > 0;
  return (
    <>
      <div className="hud-sep" />
      {goal.name && (
        <span className="hud-goal-name"
          style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink-3)", fontSize: "var(--text-2xs)" }}>
          {goal.name}
        </span>
      )}
      <div className="hud-stat"><b>{wordCount.toLocaleString()}</b>&nbsp;words</div>
      {showRing && <><div className="hud-sep" /><GoalRing pct={goal.pct} current={goal.current} target={goal.target} /></>}
      {goal.streak > 0 && (
        <><div className="hud-sep" />
          <div className="hud-stat">
            <Icon name="flame" className="ic" style={{ width: 14, height: 14, color: "var(--accent)" }} />
            &nbsp;<b>{goal.streak}</b>
          </div></>
      )}
      {settings.timer && <><div className="hud-sep" /><SessionTimer key={timerKey} /></>}
    </>
  );
}

// ── FocusHud ──────────────────────────────────────────────────────────────────

export function FocusHud({ wordCount, goal, goalOn, settingsHook }: FocusHudProps) {
  const { settings, toggle } = settingsHook;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const { faded, reset } = useFadeActivity(popoverOpen);

  const handleToggle = (k: keyof FocusSettings) => {
    if (k === "timer") setTimerKey((n) => n + 1);
    toggle(k);
  };

  const handleClosePopover = () => {
    setPopoverOpen(false);
    reset();
  };

  return (
    <div className={`focus-hud${faded ? " faded" : ""}`} data-testid="focus-hud">
      <button className="iconbtn hud-gear" title="Focus settings" aria-label="Focus settings"
        onClick={() => setPopoverOpen((o) => !o)}>
        <Icon name="cog" className="ic" style={{ width: 14, height: 14 }} />
      </button>
      {settings.hud && <HudStats wordCount={wordCount} goal={goal} goalOn={goalOn}
        settings={settings} timerKey={timerKey} />}
      {popoverOpen && <SettingsPopover settings={settings} onToggle={handleToggle}
        onClose={handleClosePopover} />}
    </div>
  );
}
