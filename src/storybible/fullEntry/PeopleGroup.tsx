/**
 * PeopleGroup — Relationships (character) / Characters here (location) rail group.
 * Ported from design-reference/entry.jsx: PeopleGroup, FePersonCard, LivePicker.
 *
 * ALL props are optional+guarded; absent callbacks are no-ops via `?.()`.
 * Parent remounts via key={entityId} to reset picker state on entity change
 * (avoids react-hooks/set-state-in-effect — key-remount pattern).
 */

import { useEffect, useRef, useState } from "react";

import { Icon } from "../../components/Icon";
import type { Character, EntityLink, StoryBibleStore } from "../../db/storyBibleStore";
import { Editable } from "./Editable";
import { LocationLinkGroup } from "./FeLocationLinks";

// ── Pure helper ───────────────────────────────────────────────────────────────

/**
 * Filter the full character list down to picker candidates:
 * excludes the entity itself and any already-linked character ids.
 * Preserves insertion order.
 */
export function pickerCandidates(
  allChars: { id: string; name: string }[],
  selfId: string,
  linkedToIds: string[]
): { id: string; name: string }[] {
  const linked = new Set(linkedToIds);
  return allChars.filter((c) => c.id !== selfId && !linked.has(c.id));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function charInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? "";
}

// ── FePersonCard ──────────────────────────────────────────────────────────────

interface FePersonCardProps {
  link: EntityLink;
  target: Character | undefined;
  onPushEntry?: (entityId: string, kind: "Character" | "Location") => void;
  onUnlink: (linkId: string) => void;
  onRelabel: (linkId: string, relation: string) => void;
}

function FePersonCard({ link, target, onPushEntry, onUnlink, onRelabel }: FePersonCardProps) {
  if (!target) return null;
  const initial = charInitial(target.name);
  function handleOpen() { onPushEntry?.(target!.id, "Character"); }
  return (
    <div className="entity-card fe-person">
      <div className="avatar character" style={{ cursor: "pointer" }} onClick={handleOpen}>
        {initial}
      </div>
      <div className="entity-meta">
        <div className="entity-name" style={{ cursor: "pointer" }} onClick={handleOpen}>
          {target.name}
        </div>
        <Editable
          key={`${link.id}:${link.relation}`}
          className="fe-rel-relation"
          value={link.relation}
          placeholder="Add relation…"
          onCommit={(v) => onRelabel(link.id, v)}
        />
      </div>
      <button className="fe-unlink" title="Unlink" onClick={() => onUnlink(link.id)}>
        <Icon name="x" style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
}

// ── LivePicker ────────────────────────────────────────────────────────────────

interface PickerCandidate { id: string; name: string; }

function PickerList({ items, onPick }: {
  items: PickerCandidate[];
  onPick: (id: string) => void;
}) {
  if (!items.length) {
    return (
      <div className="empty-hint" style={{ padding: "8px" }}>
        No characters left to link.
      </div>
    );
  }
  return (
    <>
      {items.map((c) => (
        <button className="fe-pick" key={c.id} onClick={() => onPick(c.id)}>
          <div className="avatar character">{charInitial(c.name)}</div>
          <span className="nm">{c.name}</span>
          <Icon name="plus" className="plus" style={{ width: 15, height: 15 }} />
        </button>
      ))}
    </>
  );
}

interface LivePickerProps {
  candidates: PickerCandidate[];
  onPick: (characterId: string) => void;
  onClose: () => void;
}

function LivePicker({ candidates, onPick, onClose }: LivePickerProps) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const filtered = candidates.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fe-picker">
      <div className="fe-picker-search">
        <Icon name="search" className="ic" />
        <input
          ref={ref}
          className="fe-picker-input"
          placeholder="Search characters…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        />
      </div>
      <PickerList items={filtered} onPick={onPick} />
    </div>
  );
}

// ── usePeopleGroup ────────────────────────────────────────────────────────────

interface PeopleGroupData {
  links: EntityLink[];
  allChars: Character[];
  refresh: () => void;
}

function usePeopleGroup(
  store: StoryBibleStore | undefined,
  entityId: string | undefined,
  projectId: string | undefined,
  entityType: "character" | "location"
): PeopleGroupData {
  const [links, setLinks] = useState<EntityLink[]>([]);
  const [allChars, setAllChars] = useState<Character[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!store || !entityId || !projectId) return;
    let alive = true;
    // Characters: query by fromId (char's own outgoing links).
    // Locations: query by toId (reverse — chars that link TO this location).
    const linksQuery = entityType === "location"
      ? store.listLinksTo(entityId)
      : store.listLinksFor(entityId);
    void Promise.all([linksQuery, store.listCharacters(projectId)]).then(([l, c]) => {
      if (!alive) return;
      setLinks(l);
      setAllChars(c);
    });
    return () => { alive = false; };
  }, [store, entityId, projectId, entityType, version]);

  function refresh() { setVersion((v) => v + 1); }
  return { links, allChars, refresh };
}

// ── useLinkActions ────────────────────────────────────────────────────────────

interface LinkActionsCtx {
  store: StoryBibleStore;
  entityId: string;
  entityType: "character" | "location";
  projectId: string;
  refresh: () => void;
  setPicking: (v: boolean) => void;
  onPushEntry?: (entityId: string, kind: "Character" | "Location") => void;
}

function useLinkActions(ctx: LinkActionsCtx) {
  const { store, entityId, entityType, projectId, refresh, setPicking, onPushEntry } = ctx;
  async function handleAddNew() {
    const newChar = await store.createCharacter(projectId, "New character", null);
    // Location mode: canonical direction is char→location (fromId=char, toId=loc).
    const [fromId, toId] = entityType === "location"
      ? [newChar.id, entityId]
      : [entityId, newChar.id];
    await store.addLink(fromId, toId, "");
    refresh();
    onPushEntry?.(newChar.id, "Character");
  }
  async function handleUnlink(linkId: string) {
    await store.removeLink(linkId);
    refresh();
  }
  async function handleRelabel(linkId: string, relation: string) {
    await store.updateLinkRelation(linkId, relation);
    refresh();
  }
  async function handlePick(characterId: string) {
    // Location mode: canonical direction is char→location (fromId=char, toId=loc).
    const [fromId, toId] = entityType === "location"
      ? [characterId, entityId]
      : [entityId, characterId];
    await store.addLink(fromId, toId, "");
    setPicking(false);
    refresh();
  }
  return { handleAddNew, handleUnlink, handleRelabel, handlePick };
}

// ── CharLinksGroup ────────────────────────────────────────────────────────────
// The char→char (or location→char) relationships group.

interface CharLinksGroupProps {
  label: string;
  charLinks: EntityLink[];
  charMap: Map<string, Character>;
  candidates: PickerCandidate[];
  act: ReturnType<typeof useLinkActions>;
  onPushEntry?: (entityId: string, kind: "Character" | "Location") => void;
}

function CharLinksGroup({ label, charLinks, charMap, candidates, act, onPushEntry }: CharLinksGroupProps) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="insp-group">
      <div className="insp-label">
        <Icon name="users" className="ic" /> {label}
        <button className="add" title="Add a new character"
          onClick={() => { void act.handleAddNew(); }}>
          <Icon name="plus" style={{ width: 14, height: 14 }} />
        </button>
      </div>
      {charLinks.map((link) => (
        <FePersonCard key={link.id} link={link} target={charMap.get(link.toId)}
          onPushEntry={onPushEntry}
          onUnlink={(id) => { void act.handleUnlink(id); }}
          onRelabel={(id, v) => { void act.handleRelabel(id, v); }}
        />
      ))}
      {picking
        ? <LivePicker candidates={candidates}
            onPick={(id) => { void act.handlePick(id); setPicking(false); }}
            onClose={() => setPicking(false)} />
        : <button className="fe-add" onClick={() => setPicking(true)}>
            <Icon name="plus" className="ic" /> Link a character
          </button>
      }
    </div>
  );
}

// ── PeopleGroupInner ──────────────────────────────────────────────────────────

interface PeopleGroupInnerProps {
  entityId: string;
  projectId: string;
  entityType: "character" | "location";
  store: StoryBibleStore;
  onPushEntry?: (entityId: string, kind: "Character" | "Location") => void;
}

function PeopleGroupInner({ entityId, projectId, entityType, store, onPushEntry }: PeopleGroupInnerProps) {
  const { links: allLinks, allChars, refresh } = usePeopleGroup(store, entityId, projectId, entityType);
  // useLinkActions uses fromId-based addLink — remains correct for character entries.
  const act = useLinkActions({ store, entityId, entityType, projectId, refresh, setPicking: () => {}, onPushEntry });
  const label = entityType === "location" ? "Characters here" : "Relationships";
  const charMap = new Map(allChars.map((c) => [c.id, c]));
  // For character entries: link.toId is the related character.
  // For location entries (reverse links): link.fromId is the character linked to this location.
  const linkedCharIds = entityType === "location"
    ? allLinks.map((l) => l.fromId)
    : allLinks.filter((lk) => charMap.has(lk.toId)).map((l) => l.toId);
  const charLinks = entityType === "location"
    ? allLinks.filter((lk) => charMap.has(lk.fromId))
    : allLinks.filter((lk) => charMap.has(lk.toId));
  // For the CharLinksGroup, we need links with a consistent "target id" concept.
  // Wrap location-mode links so target = fromId (the character).
  const normalizedLinks: EntityLink[] = entityType === "location"
    ? charLinks.map((lk) => ({ ...lk, toId: lk.fromId })) // swap so card reads lk.toId
    : charLinks;
  const candidates = pickerCandidates(allChars, entityId, linkedCharIds);
  return (
    <>
      <CharLinksGroup
        label={label} charLinks={normalizedLinks} charMap={charMap}
        candidates={candidates} act={act} onPushEntry={onPushEntry}
      />
      {entityType === "character" && (
        <LocationLinkGroup entityId={entityId} projectId={projectId}
          store={store} onPushEntry={onPushEntry} />
      )}
    </>
  );
}

// ── PeopleGroup ───────────────────────────────────────────────────────────────

export interface PeopleGroupProps {
  entityId?: string;
  projectId?: string;
  entityType?: "character" | "location";
  store?: StoryBibleStore;
  onPushEntry?: (entityId: string, kind: "Character" | "Location") => void;
}

export function PeopleGroup({ entityId, projectId, entityType, store, onPushEntry }: PeopleGroupProps) {
  if (!entityId || !projectId || !store) return null;
  return (
    <PeopleGroupInner
      entityId={entityId}
      projectId={projectId}
      entityType={entityType ?? "character"}
      store={store}
      onPushEntry={onPushEntry}
    />
  );
}
