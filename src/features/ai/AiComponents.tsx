import React from "react";

import { Icon, type IconName } from "../../components/Icon";
import { avgCostForModel } from "./ai.cost-window";
import { aiMeterStatus, estimateRepliesLeft } from "./ai.helpers";
import { AI_MODEL_ORDER, AI_MODELS, AI_VERB_ORDER, AI_VERBS, type AiMessageRecord, type ContextSnapshot, type ConversationRecord, type ManagedModel, type VerbKey } from "./ai.types";

/* ---- Markdown-lite inline renderer (module-private) ---- */

function aiInline(text: string, key: string): React.ReactNode {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <b key={key + "-" + i}>{p}</b> : p));
}

/* ---- Reply body renderer ---- */

export function AiBody({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: React.ReactNode[] | null = null;
  const flush = () => {
    if (bullets) { out.push(<ul key={"ul" + out.length}>{bullets}</ul>); bullets = null; }
  };
  lines.forEach((ln, i) => {
    if (ln.startsWith("- ")) {
      bullets = bullets ?? [];
      bullets.push(<li key={i}>{aiInline(ln.slice(2), "l" + i)}</li>);
      return;
    }
    flush();
    if (!ln.trim()) return;
    if (ln.startsWith("### ")) out.push(<div className="ai-h" key={i}>{ln.slice(4)}</div>);
    else if (ln.startsWith("> ")) out.push(<div className="ai-q" key={i}>{ln.slice(2)}</div>);
    else if (ln.startsWith("EDIT|")) {
      const [, from, to, why] = ln.split("|");
      out.push(
        <div className="ai-edit" key={i}>
          <div className="pair"><span className="from">{from}</span><span className="arrow">→</span><span className="to">{to}</span></div>
          {why && <div className="why">{why}</div>}
        </div>
      );
    } else if (ln.startsWith("NOTE|")) {
      out.push(<div className="ai-note" key={i}><Icon name="check" className="ic" />{ln.slice(5)}</div>);
    } else out.push(<p key={i}>{aiInline(ln, "p" + i)}</p>);
  });
  flush();
  return <div className="ai-msg-body">{out}{streaming && <span className="ai-cursor"></span>}</div>;
}

/* ---- Per-message context receipt ---- */

export function AiReceipt({ ctx }: { ctx: ContextSnapshot | null }) {
  const [open, setOpen] = React.useState(false);
  if (!ctx) return null;
  const chips: { cls?: string; icon: IconName; label: string }[] = [];
  chips.push({ cls: "ai-chip--scene", icon: "fileText", label: ctx.sceneTitle + (ctx.sceneWords ? " · " + ctx.sceneWords.toLocaleString() + " words" : "") });
  ctx.extraSceneTitles.forEach(x => chips.push({ icon: "book", label: x }));
  ctx.entityNames.forEach(n => chips.push({ icon: "user", label: n }));
  if (ctx.selWords) chips.push({ cls: "ai-chip--sel", icon: "quote", label: "Selection · " + ctx.selWords + " words" });
  if (ctx.about) chips.push({ icon: "info", label: "About this manuscript" });
  if (ctx.boundaryLabel) chips.push({ icon: "shield", label: "Read up to " + ctx.boundaryLabel });
  const n = chips.length;
  return (
    <div>
      <div className="ai-receipt" onClick={() => setOpen(o => !o)} title="What this message could see">
        {open ? "Saw" : "Saw " + (ctx.sceneTitle || "context") + (n > 1 ? " +" + (n - 1) : "")}
      </div>
      {open && (
        <div className="ai-receipt-chips">
          {chips.map((c, i) => (
            <span className={"ai-chip " + (c.cls ?? "")} key={i}><Icon name={c.icon} className="ic" /><span>{c.label}</span></span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Messages ---- */

export function AiMessage({ msg, onCopy, onSaveNote, onAddToBoard }: { msg: AiMessageRecord; onCopy: (m: AiMessageRecord) => void; onSaveNote: (m: AiMessageRecord) => void; onAddToBoard?: (m: AiMessageRecord) => void }) {
  if (msg.role === "you") {
    return (
      <div className="ai-msg-you">
        <div className="bubble">{msg.text}</div>
        <AiReceipt ctx={msg.ctx} />
      </div>
    );
  }
  const verb = AI_VERBS[msg.verb] ?? AI_VERBS.brainstorm;
  return (
    <div className="ai-msg-ai">
      <div className="ai-msg-head">
        <Icon name="sparkle" className="ic" /> {verb.label}
        <span className="when">{msg.when}</span>
      </div>
      <AiBody text={msg.text} streaming={msg.streaming} />
      {!msg.streaming && (
        <div className="ai-msg-acts">
          <div className="ai-msg-act" role="button" onClick={() => onCopy(msg)}><Icon name="copy" className="ic" /> Copy</div>
          <div className="ai-msg-act" role="button" onClick={() => onSaveNote(msg)}><Icon name="inbox" className="ic" /> Save to notes</div>
          {onAddToBoard && <div className="ai-msg-act" role="button" onClick={() => onAddToBoard(msg)}><Icon name="plus" className="ic" /> Add to board</div>}
        </div>
      )}
      {!msg.streaming && msg.creditsCost != null && msg.creditsCost > 0 && (
        <div className="ai-msg-cost">~{msg.creditsCost.toLocaleString()} credits</div>
      )}
    </div>
  );
}

/* ---- Empty state: pick a verb, take a starter ---- */

export function AiEmptyState({ verb, setVerb, onStarter, onFocusInput }: { verb: VerbKey; setVerb: (v: VerbKey) => void; onStarter: (s: string) => void; onFocusInput?: () => void }) {
  const v = AI_VERBS[verb];
  return (
    <div className="ai-empty">
      <div className="mark"><Icon name="sparkle" className="ic" /></div>
      <h3>What would you like to talk through?</h3>
      <div className="sub">Grounded in the open scene and its Story Bible entities — nothing else.</div>
      <button className={"ai-askhero" + (verb === "ask" ? " on" : "")} onClick={() => { setVerb("ask"); onFocusInput?.(); }}>
        <Icon name="feather" className="ic" />
        <span className="ah-body">
          <span className="ah-nm">Ask anything</span>
          <span className="ah-bl">Any question — grounded in your manuscript</span>
        </span>
      </button>
      <div className="ai-verbgrid">
        {AI_VERB_ORDER.map(k => (
          <button className={"ai-verbcard" + (k === verb ? " on" : "")} key={k} onClick={() => setVerb(k)}>
            <span className="vc-top"><Icon name={AI_VERBS[k].icon as IconName} className="ic" />{AI_VERBS[k].label}</span>
            <span className="vc-blurb">{AI_VERBS[k].blurb}</span>
          </button>
        ))}
      </div>
      <div className="ai-starters">
        {v.starters.slice(0, 2).map((s, i) => (
          <button className="ai-starter" key={i} onClick={() => onStarter(s)}>&quot;{s}&quot;</button>
        ))}
      </div>
    </div>
  );
}

/* ---- Dormant (consent not yet given) ---- */

export function AiDormant({ onWake }: { onWake: () => void }) {
  return (
    <div className="ai-dormant">
      <div className="mark"><Icon name="sparkle" className="ic" /></div>
      <h3>The assistant is asleep</h3>
      <p>Ask anything, or brainstorm, critique, beta-read and proofread — grounded in your manuscript. Nothing leaves your machine until you turn it on.</p>
      <button className="btn btn-primary" onClick={onWake}><Icon name="sparkle" className="ic" /> See how it works</button>
    </div>
  );
}

/* ---- Conversation list ---- */

export function AiConvoList({ convos, activeId, onOpen, onNew, onDelete }: { convos: ConversationRecord[]; activeId: string | null; onOpen: (id: string) => void; onNew: () => void; onDelete: (id: string) => void }) {
  return (
    <div className="ai-convlist">
      {convos.map(c => {
        const last = c.messages[c.messages.length - 1];
        const icon = (c.verb && AI_VERBS[c.verb] ? AI_VERBS[c.verb] : AI_VERBS.brainstorm).icon as IconName;
        return (
          <div className={"ai-convrow" + (c.id === activeId ? " on" : "")} role="button" key={c.id} onClick={() => onOpen(c.id)}>
            <Icon name={icon} className="ic" />
            <div className="meta">
              <div className="nm">{c.title}</div>
              <div className="snip">{last ? last.text.replace(/[#*>|-]/g, "").slice(0, 90) : "No messages yet"}</div>
            </div>
            <span className="when">{c.when}</span>
            <span className="del" role="button" title="Delete conversation"
              onClick={e => { e.stopPropagation(); onDelete(c.id); }}><Icon name="x" className="ic" /></span>
          </div>
        );
      })}
      <button className="ai-newconv" onClick={onNew}><Icon name="plus" className="ic" /> New conversation</button>
    </div>
  );
}

/* ---- Credit meter ---- */

function MeterPop({ creditsBalance, model }: { creditsBalance: number; model: ManagedModel }) {
  return (
    <div className="ai-meterpop" role="dialog" aria-label="Budget by model">
      {AI_MODEL_ORDER.map(m => (
        <div key={m} className={"ai-meterpop-row" + (m === model ? " on" : "")}>
          <span className="nm">{AI_MODELS[m].label}</span>
          <span className="est">~{estimateRepliesLeft(creditsBalance, m, avgCostForModel(m) ?? undefined)}</span>
        </div>
      ))}
      <div className="ai-meterpop-nudge">Cheaper models go further — switch any time.</div>
    </div>
  );
}

export function AiMeter({ usedPct, resetLabel, creditsBalance, model, plan }: {
  usedPct: number;
  resetLabel: string;
  creditsBalance: number;
  model: ManagedModel;
  plan: "active" | "trial" | "expired";
}) {
  const [pop, setPop] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const st = aiMeterStatus(usedPct, resetLabel);
  const pctLeft = Math.max(0, 100 - Math.min(100, usedPct));
  const replies = estimateRepliesLeft(creditsBalance, model, avgCostForModel(model) ?? undefined);
  const showReset = plan !== "trial"; // trials convert, not reset — hide the reset label so the meter doesn't contradict the Subscribe modal
  React.useEffect(() => {
    if (!pop) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPop(false); };
    const onOut = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPop(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOut);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onOut); };
  }, [pop]);
  return (
    <div className="ai-meter" ref={wrapRef}>
      <button className="ai-meter-btn" onClick={() => setPop(o => !o)} aria-expanded={pop} title="Budget breakdown by model">
        <div className="ai-meter-row">
          <span className={"st " + st.cls}>{pctLeft}% left</span>
          {plan === "trial" && <span className="ai-meter-badge">Free trial</span>}
          {showReset && st.sub && <span>{st.sub}</span>}
        </div>
        <div className="ai-meter-track">
          <div className={"ai-meter-fill " + st.cls} style={{ width: Math.max(2, pctLeft) + "%" }}></div>
        </div>
        <div className="ai-meter-replies">~{replies} more replies on {AI_MODELS[model].label}</div>
      </button>
      {pop && <MeterPop creditsBalance={creditsBalance} model={model} />}
    </div>
  );
}
