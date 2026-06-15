import React from "react";

import { Icon, type IconName } from "../../components/Icon";
import { aiEstimate, estimateRepliesLeft } from "./ai.helpers";
import { type AiChapterRow, type AiCtxConfig, type AiEntity, type AiEstimateResult, type AiManuscriptTree, type AiSceneRow, DEFAULT_MODEL, type ManuscriptAbout, TRIAL_ALLOWANCE_UNITS } from "./ai.types";
import { AiMeter } from "./AiComponents";

/* ---- Consent walkthrough step data (module-level JSX is valid in .tsx) ---- */

type ConsentStep = { icon: IconName; title: string; copy: React.ReactNode; demo: React.ReactNode };

const CONSENT_STEPS: ConsentStep[] = [
  {
    icon: "sparkle",
    title: "A collaborator in the margins",
    copy: <>Brainstorm, critique, beta-read and proofread — grounded in your scenes and Story Bible. <b>It suggests; you write.</b> It never touches the page, and the whole feature disappears if you turn it off.</>,
    demo: null,
  },
  {
    icon: "shield",
    title: "You can always see what it sees",
    copy: <>Each request sends <b>only what&apos;s in the chips</b> — the open scene, the entities linked to it, and your About note. Nothing is stored, logged, or used for training. Ever.</>,
    demo: (
      <div className="ai-chips">
        <span className="ai-chip ai-chip--scene"><Icon name="fileText" className="ic" /><span>The Causeway</span></span>
        <span className="ai-chip"><Icon name="user" className="ic" /><span>Maren Vale</span></span>
        <span className="ai-chip"><Icon name="user" className="ic" /><span>Tomas Roe</span></span>
        <span className="ai-chip"><Icon name="info" className="ic" /><span>About this manuscript</span></span>
      </div>
    ),
  },
  {
    icon: "check",
    title: "A meter, not a bill",
    copy: <>Your free trial includes about {estimateRepliesLeft(TRIAL_ALLOWANCE_UNITS, DEFAULT_MODEL)} replies to try the assistant. Your plan — or trial — includes an allowance; when it runs out, the assistant <b>stops</b> — it never runs up a bill behind your back.</>,
    demo: <AiMeter usedPct={26} resetLabel="Resets July 1" creditsBalance={109_200} model={DEFAULT_MODEL} plan="trial" />,
  },
];

/* ---- AiConsent: 3-step first-run walkthrough ---- */

export function AiConsent({ onClose, onEnable }: { onClose: () => void; onEnable: () => void }) {
  const [step, setStep] = React.useState(0);
  const s = CONSENT_STEPS[step];
  const last = step === CONSENT_STEPS.length - 1;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet ai-consent" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div><div className="sheet-title"><Icon name="sparkle" className="ic" />Meet the assistant</div></div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body">
          <div className="step">
            <div className="mark"><Icon name={s.icon} className="ic" /></div>
            <h3>{s.title}</h3>
            <div className="copy">{s.copy}</div>
            {s.demo && <div className="demo">{s.demo}</div>}
            <div className="dots">{CONSENT_STEPS.map((_, i) => <span key={i} className={"dot" + (i === step ? " on" : "")}></span>)}</div>
            <div className="acts">
              {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
              {!last
                ? <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Continue</button>
                : <button className="btn btn-primary" onClick={onEnable}><Icon name="sparkle" className="ic" /> Turn on the assistant</button>}
            </div>
            {last && <div className="fine">$14.99/month, or bring your own API key. Cancel any time — your writing never depends on it.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- AiAboutCard: inline About editor (draft init at mount; key-remount at call site) ---- */

export function AiAboutCard({ about, onSave }: { about: ManuscriptAbout; onSave: (a: ManuscriptAbout) => void }) {
  const [editing, setEditing] = React.useState(!about.synopsis);
  const [draft, setDraft] = React.useState<ManuscriptAbout>(about);
  const field = (key: keyof ManuscriptAbout, label: string, textarea: boolean, full?: boolean) => (
    <div className={"ai-field" + (full ? " full" : "")}>
      <label>{label}</label>
      {textarea
        ? <textarea value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />
        : <input value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />}
    </div>
  );
  if (!editing) return (
    <div className="ai-about-card">
      <div className="ai-about-line">
        {about.synopsis
          ? (<><b>{about.genre || "Untyped"}</b> · {about.pov || "POV unset"} — {about.synopsis}</>)
          : "Nothing here yet. A synopsis, genre and tone ride along with every request, so the assistant knows what book it's helping with."}
      </div>
      <div className="ai-about-foot">
        <button className="btn btn-ghost" onClick={() => setEditing(true)}><Icon name="edit" className="ic" /> {about.synopsis ? "Edit" : "Write it"}</button>
      </div>
    </div>
  );
  return (
    <div className="ai-about-card">
      <div className="ai-about-edit">
        {field("synopsis", "Synopsis", true, true)}
        {field("genre", "Genre", false)}
        {field("tone", "Tone", false)}
        {field("pov", "POV & tense", false)}
        {field("notes", "Things the assistant should know", true, true)}
      </div>
      <div className="ai-about-foot">
        <button className="btn btn-ghost" onClick={() => { setDraft(about); setEditing(false); }}>Cancel</button>
        <button className="btn btn-primary" onClick={() => { onSave(draft); setEditing(false); }}>Save</button>
      </div>
    </div>
  );
}

/* ---- AiContextPicker sub-components ---- */

interface SceneTreeProps { tree: AiManuscriptTree; scene: AiSceneRow; extraSceneIds: string[]; onToggle: (id: string) => void; }

function AiSceneTree({ tree, scene, extraSceneIds, onToggle }: SceneTreeProps) {
  const extraSet = new Set(extraSceneIds);
  return (
    <div className="ai-scenetree">
      {tree.chapters.map(ch => (
        <React.Fragment key={ch.id}>
          <div className="ai-chaprow">{ch.title}</div>
          {ch.scenes.map(s => {
            const isCur = s.id === scene.id;
            const on = isCur || extraSet.has(s.id);
            return (
              <div key={s.id} className={"ai-scenerow" + (isCur ? " current" : "")} role="button" onClick={() => onToggle(s.id)}>
                <span className={"ai-check" + (isCur ? " lock" : on ? " on" : "")}>{on && <Icon name="check" className="ic" />}</span>
                <span className="nm">{s.title}</span>
                <span className="wc">{(s.words || 0).toLocaleString()}</span>
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

interface EntityGridProps { entities: AiEntity[]; offEntityNames: string[]; neverNames: string[]; onToggle: (name: string) => void; onToggleNever: (name: string) => void; }

function AiEntityGrid({ entities, offEntityNames, neverNames, onToggle, onToggleNever }: EntityGridProps) {
  const offSet = new Set(offEntityNames);
  const neverSet = new Set(neverNames);
  return (
    <div className="ai-entgrid">
      {entities.map(e => {
        const isNever = neverSet.has(e.name);
        const on = !isNever && !offSet.has(e.name);
        return (
          <div key={e.id} className={"ai-entrow" + (isNever ? " never" : "")} role="button" onClick={() => onToggle(e.name)}>
            <span className={"ai-check" + (on ? " on" : "")}>{on && <Icon name="check" className="ic" />}</span>
            <span className="nm">{e.name}</span>
            <span className={"shield" + (isNever ? " on" : "")} role="button"
              title={isNever ? "Shared with the assistant again" : "Never share this entity with the assistant"}
              onClick={ev => { ev.stopPropagation(); onToggleNever(e.name); }}>
              <Icon name={isNever ? "shieldOff" : "shield"} className="ic" />
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface BoundaryProps { tree: AiManuscriptTree; aiCtx: AiCtxConfig; setAiCtx: (c: AiCtxConfig) => void; }

function AiBoundarySelect({ tree, aiCtx, setAiCtx }: BoundaryProps) {
  return (
    <div className="ai-boundary">
      <select value={aiCtx.boundary ?? ""} onChange={e => setAiCtx({ ...aiCtx, boundary: e.target.value || null })}>
        <option value="">No boundary</option>
        {tree.chapters.map((ch: AiChapterRow) => <option key={ch.id} value={ch.id}>Read up to {ch.title}</option>)}
      </select>
      <span className="note">The assistant is told to behave as if it hasn&apos;t read past this point — useful for beta reads.</span>
    </div>
  );
}

function AiPickerHead({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet-head">
      <div>
        <div className="sheet-title"><Icon name="shield" className="ic" />What the assistant can see</div>
        <div className="sheet-sub">An honest inventory — every request sends exactly this, and nothing else.</div>
      </div>
      <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
    </div>
  );
}

function AiPickerSection({ icon, label, hint, children }: { icon: IconName; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="ai-sec-label">
        <Icon name={icon} className="ic" /> {label}
        {hint && <span className="hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function AiPickerFoot({ est, onClose }: { est: AiEstimateResult; onClose: () => void }) {
  return (
    <div className="ai-picker-foot">
      <div className="ai-meter">
        <div className="ai-meter-row">
          <span className="st">Size of this context</span>
          <span className="ai-est">≈ <b>{est.pct}%</b> of your monthly allowance per ask</span>
        </div>
        <div className="ai-meter-track"><div className="ai-meter-fill" style={{ width: Math.min(100, est.pct * 8) + "%" }}></div></div>
      </div>
      <button className="btn btn-primary" onClick={onClose}>Done</button>
    </div>
  );
}

interface PickerDerivedParams {
  tree: AiManuscriptTree;
  scene: AiSceneRow;
  entities: AiEntity[];
  aiCtx: AiCtxConfig;
  neverNames: string[];
}

function pickerDerived({ tree, scene, entities, aiCtx, neverNames }: PickerDerivedParams) {
  const extraSet = new Set(aiCtx.extraSceneIds);
  const offSet = new Set(aiCtx.offEntityNames);
  const neverSet = new Set(neverNames);
  const allScenes = [...tree.chapters.flatMap(ch => ch.scenes), ...tree.shortPieces];
  const extraWords = [...extraSet].map(id => (allScenes.find(s => s.id === id) ?? { words: 0 }).words).reduce((a, b) => a + b, 0);
  const included = entities.filter(e => !neverSet.has(e.name) && !offSet.has(e.name)).length;
  const est = aiEstimate({ sceneWords: scene.words, extraWords, entityCount: included, about: aiCtx.about });
  return { extraSet, offSet, neverSet, est };
}

/* ---- AiContextPicker ---- */

interface AiContextPickerProps {
  tree: AiManuscriptTree;
  scene: AiSceneRow;
  entities: AiEntity[];
  aiCtx: AiCtxConfig;
  setAiCtx: (c: AiCtxConfig) => void;
  neverNames: string[];
  toggleNever: (name: string) => void;
  about: ManuscriptAbout;
  setAbout: (a: ManuscriptAbout) => void;
  resetLabel: string;
  onClose: () => void;
}

export function AiContextPicker({ tree, scene, entities, aiCtx, setAiCtx, neverNames, toggleNever, about, setAbout, onClose }: AiContextPickerProps) {
  const { extraSet, offSet, neverSet, est } = pickerDerived({ tree, scene, entities, aiCtx, neverNames });
  const toggleScene = (id: string) => {
    if (id === scene.id) return;
    const next = new Set(extraSet);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    setAiCtx({ ...aiCtx, extraSceneIds: [...next] });
  };
  const toggleEntity = (name: string) => {
    if (neverSet.has(name)) return;
    const next = new Set(offSet);
    if (next.has(name)) { next.delete(name); } else { next.add(name); }
    setAiCtx({ ...aiCtx, offEntityNames: [...next] });
  };
  const aboutKey = `${about.synopsis}|${about.genre}|${about.tone}|${about.pov}|${about.notes}`;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet ai-picker" onClick={e => e.stopPropagation()}>
        <AiPickerHead onClose={onClose} />
        <div className="sheet-body">
          <AiPickerSection icon="info" label="About this manuscript" hint="rides along with every request">
            <AiAboutCard about={about} onSave={setAbout} key={aboutKey} />
          </AiPickerSection>
          <AiPickerSection icon="fileText" label="Scenes" hint="the open scene is always included">
            <AiSceneTree tree={tree} scene={scene} extraSceneIds={aiCtx.extraSceneIds} onToggle={toggleScene} />
          </AiPickerSection>
          <AiPickerSection icon="users" label="Story Bible" hint="linked to the open scene · shield = never share">
            <AiEntityGrid entities={entities} offEntityNames={aiCtx.offEntityNames} neverNames={neverNames}
              onToggle={toggleEntity} onToggleNever={toggleNever} />
          </AiPickerSection>
          <AiPickerSection icon="book" label="Spoiler boundary">
            <AiBoundarySelect tree={tree} aiCtx={aiCtx} setAiCtx={setAiCtx} />
          </AiPickerSection>
          <AiPickerFoot est={est} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
