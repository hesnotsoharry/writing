/**
 * AutoLinkPeek — hover tooltip shown when the user hovers over an `.al-link`
 * span in the editor prose. Positioned below the hovered element (flips above
 * when it would overflow the viewport).
 *
 * Spec: design-reference/AUTOLINK-SPEC.md §Interactions.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { StoryBibleStore } from "../db/storyBibleStore";
import { toDisplaySrc } from "./fullEntry/portraitService";

export interface AutoLinkPeekProps {
  entityId: string;
  entityType: string;
  store: StoryBibleStore;
  anchorEl: HTMLElement;
  onOpenEntry: (id: string, kind: string) => void;
  onClose: () => void;
}

interface PeekPos { left: number; top: number; ready: boolean; }

function typeLabel(type: string): string {
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : "";
}

function entityKind(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// ---------------------------------------------------------------------------
// useEntityDetails — load name + description + portrait from the store on mount.
// ---------------------------------------------------------------------------

interface EntityDetails {
  name: string;
  description: string | null;
  portraitSrc: string | null;
  loaded: boolean;
}

function useEntityDetails(store: StoryBibleStore, type: string, id: string): EntityDetails {
  const aliveRef = useRef(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState<string | null>(null);
  const [portraitSrc, setPortraitSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    aliveRef.current = true;
    store.getEntity(type, id)
      .then((ent) => {
        if (!aliveRef.current) return;
        setName(ent?.name ?? "");
        setDescription(ent?.notes ?? null);
        setPortraitSrc(toDisplaySrc(ent?.portraitPath ?? null));
        setLoaded(true);
      })
      .catch((e: unknown) => {
        console.error("[AutoLinkPeek] getEntity failed", e);
        if (aliveRef.current) setLoaded(true);
      });
    return () => { aliveRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { name, description, portraitSrc, loaded };
}

// ---------------------------------------------------------------------------
// useClampedPosition — viewport-clamped position, computed after layout.
// ---------------------------------------------------------------------------

function useClampedPosition(
  ref: React.RefObject<HTMLDivElement | null>,
  anchorEl: HTMLElement,
  entityId: string,
): PeekPos {
  const anchor = anchorEl.getBoundingClientRect();
  const [pos, setPos] = useState<PeekPos>({ left: anchor.left, top: anchor.bottom + 7, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 10;
    const rect = anchorEl.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 7;
    if (left + el.offsetWidth + pad > window.innerWidth) left = window.innerWidth - el.offsetWidth - pad;
    if (top + el.offsetHeight + pad > window.innerHeight) top = rect.top - el.offsetHeight - 7;
    setPos({ left: Math.max(pad, left), top: Math.max(pad, top), ready: true });
  }, [anchorEl, entityId, ref]);

  return pos;
}

// ---------------------------------------------------------------------------
// AutoLinkPeek
// ---------------------------------------------------------------------------

export function AutoLinkPeek({ entityId, entityType, store, anchorEl, onOpenEntry, onClose }: AutoLinkPeekProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useClampedPosition(ref, anchorEl, entityId);
  const { name, description, portraitSrc, loaded } = useEntityDetails(store, entityType, entityId);

  return (
    <div ref={ref} className="al-peek"
      style={{ left: pos.left, top: pos.top, visibility: pos.ready ? "visible" : "hidden" }}
      onMouseLeave={onClose}>
      <div className="al-peek-head">
        {portraitSrc
          ? <img src={portraitSrc} className="al-peek-portrait" alt={name} />
          : <div className={"avatar " + entityType}>{name ? name.charAt(0).toUpperCase() : "?"}</div>
        }
        <div style={{ minWidth: 0 }}>
          <div className="al-peek-name">{loaded ? name : "…"}</div>
          <div className="al-peek-type">{typeLabel(entityType)}</div>
        </div>
      </div>
      {description && <div className="al-peek-note">{description.slice(0, 120)}</div>}
      <div className="al-peek-acts">
        <button className="al-pbtn" onClick={() => onOpenEntry(entityId, entityKind(entityType))}>
          Open entry
        </button>
      </div>
    </div>
  );
}
