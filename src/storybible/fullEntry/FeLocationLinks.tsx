/**
 * FeLocationLinks — char→location link group for the full-entry rail.
 * Rendered by PeopleGroupInner for character entities only.
 */

import { useEffect, useRef, useState } from "react";

import { Icon } from "../../components/Icon";
import type { EntityLink, Location, StoryBibleStore } from "../../db/storyBibleStore";
import { Editable } from "./Editable";

// ── Helpers ───────────────────────────────────────────────────────────────────

function locInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? "";
}

// ── FeLocationCard ────────────────────────────────────────────────────────────

interface FeLocationCardProps {
  link: EntityLink;
  target: Location | undefined;
  onPushEntry?: (entityId: string, kind: "Character" | "Location") => void;
  onUnlink: (linkId: string) => void;
  onRelabel: (linkId: string, relation: string) => void;
}

function FeLocationCard({ link, target, onPushEntry, onUnlink, onRelabel }: FeLocationCardProps) {
  if (!target) return null;
  function handleOpen() { onPushEntry?.(target!.id, "Location"); }
  return (
    <div className="entity-card fe-person">
      <div className="avatar location" style={{ cursor: "pointer" }} onClick={handleOpen}>
        {locInitial(target.name)}
      </div>
      <div className="entity-meta">
        <div className="entity-name" style={{ cursor: "pointer" }} onClick={handleOpen}>
          {target.name}
        </div>
        <Editable key={`${link.id}:${link.relation}`} className="fe-rel-relation"
          value={link.relation} placeholder="Add relation…"
          onCommit={(v) => onRelabel(link.id, v)} />
      </div>
      <button className="fe-unlink" title="Unlink" onClick={() => onUnlink(link.id)}>
        <Icon name="x" style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
}

// ── useLocationLinks ──────────────────────────────────────────────────────────

interface LocationLinksData {
  links: EntityLink[];
  allLocs: Location[];
  refresh: () => void;
}

function useLocationLinks(
  store: StoryBibleStore,
  entityId: string,
  projectId: string
): LocationLinksData {
  const [links, setLinks] = useState<EntityLink[]>([]);
  const [allLocs, setAllLocs] = useState<Location[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      store.listLinksFor(entityId),
      store.listLocations(projectId),
    ]).then(([allLinks, locs]) => {
      if (!alive) return;
      const locIds = new Set(locs.map((l) => l.id));
      setLinks(allLinks.filter((lk) => locIds.has(lk.toId)));
      setAllLocs(locs);
    });
    return () => { alive = false; };
  }, [store, entityId, projectId, version]);

  return { links, allLocs, refresh: () => setVersion((v) => v + 1) };
}

// ── LocationLinkPicker ────────────────────────────────────────────────────────

interface LocationLinkPickerProps {
  candidates: Location[];
  onPick: (locId: string) => void;
  onClose: () => void;
}

function LocationLinkPicker({ candidates, onPick, onClose }: LocationLinkPickerProps) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const filtered = candidates.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fe-picker">
      <div className="fe-picker-search">
        <Icon name="search" className="ic" />
        <input ref={ref} className="fe-picker-input" placeholder="Search locations…"
          value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} />
      </div>
      {filtered.length === 0
        ? <div className="empty-hint" style={{ padding: "8px" }}>No locations left to link.</div>
        : filtered.map((l) => (
          <button className="fe-pick" key={l.id} onClick={() => onPick(l.id)}>
            <div className="avatar location">{locInitial(l.name)}</div>
            <span className="nm">{l.name}</span>
            <Icon name="plus" className="plus" style={{ width: 15, height: 15 }} />
          </button>
        ))
      }
    </div>
  );
}

// ── LocationLinkGroup ─────────────────────────────────────────────────────────

export interface LocationLinkGroupProps {
  entityId: string;
  projectId: string;
  store: StoryBibleStore;
  onPushEntry?: (entityId: string, kind: "Character" | "Location") => void;
}

export function LocationLinkGroup({ entityId, projectId, store, onPushEntry }: LocationLinkGroupProps) {
  const [picking, setPicking] = useState(false);
  const { links, allLocs, refresh } = useLocationLinks(store, entityId, projectId);
  const locMap = new Map(allLocs.map((l) => [l.id, l]));
  const linkedToIds = new Set(links.map((lk) => lk.toId));
  const candidates = allLocs.filter((l) => !linkedToIds.has(l.id));

  async function handleUnlink(linkId: string) { await store.removeLink(linkId); refresh(); }
  async function handleRelabel(id: string, rel: string) {
    await store.updateLinkRelation(id, rel); refresh();
  }
  async function handlePick(locId: string) {
    await store.addLink(entityId, locId, ""); setPicking(false); refresh();
  }

  return (
    <div className="insp-group">
      <div className="insp-label"><Icon name="mapPin" className="ic" /> Locations</div>
      {links.map((link) => (
        <FeLocationCard key={link.id} link={link} target={locMap.get(link.toId)}
          onPushEntry={onPushEntry}
          onUnlink={(id) => { void handleUnlink(id); }}
          onRelabel={(id, v) => { void handleRelabel(id, v); }}
        />
      ))}
      {picking
        ? <LocationLinkPicker candidates={candidates}
            onPick={(id) => { void handlePick(id); }}
            onClose={() => setPicking(false)} />
        : <button className="fe-add" onClick={() => setPicking(true)}>
            <Icon name="plus" className="ic" /> Link a location
          </button>
      }
    </div>
  );
}
