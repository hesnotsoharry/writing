import { useEffect, useRef, useState } from "react";

import { Icon } from "../components/Icon";
import type { Entity } from "../db/storyBibleStore";
import styles from "./InspPicker.module.css";

export interface InspPickerProps {
  candidates: Entity[];
  placeholder: string;
  onPick: (c: Entity) => void;
  onClose: () => void;
}

export function InspPicker({ candidates, placeholder, onPick, onClose }: InspPickerProps) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const filtered = candidates.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className={styles.picker}>
      <div className={styles.searchRow}>
        <Icon name="search" className={styles.searchIcon} style={{ width: 14, height: 14 }} />
        <input
          ref={inputRef}
          className={styles.input}
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        />
      </div>
      {filtered.length > 0 ? (
        filtered.map((c) => (
          <button key={c.id} className={styles.row} onClick={() => onPick(c)}>
            <div className={"avatar " + c.type}>{c.name.charAt(0).toUpperCase()}</div>
            <span className={styles.name}>{c.name}</span>
            <Icon name="plus" className={styles.plus} style={{ width: 15, height: 15 }} />
          </button>
        ))
      ) : (
        <div className="empty-hint" style={{ padding: "8px" }}>Nothing left to link.</div>
      )}
    </div>
  );
}
