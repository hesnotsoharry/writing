# Goals — feature spec

**Status:** built in the canon prototype (`index.html`). Supersedes the old
single-toggle Goals sheet.

## What changed since last batch (Jun 2026)

- **Goals are now a list, not a single boolean.** State moved from one `goalsOn`
  flag controlling a fixed session ring to a `goals[]` array (plus `goalsOn` as
  the master on/off). Users can keep several goals at once; the inspector stacks
  one card per goal.
- **The editor adapts to the goal's measurement family.** The old form always
  asked for "words/day." Now the target section morphs (see below).
- **A real, clickable month calendar** for deadline goals (`Calendar` in
  `dialogs.jsx`) — prev/next month, past dates disabled, today ringed, selection
  filled. No native `<input type=date>`.
- **Per-type inspector visualizations** instead of one ring for everything:
  ring (amount), pace bar (deadline), flame + 7-day dots (streak).
- **Manage existing goals**: right-click any inspector goal card → Edit ·
  Manage all · Delete; plus a manager modal that lists every goal with inline
  edit/delete and a "New goal" button.

## The hole it fills

Six goal types shared one word-count target field, so "Deadline pace", "Time at
the desk", and "Writing streak" all nonsensically asked for words. And once a
goal was set there was no way to edit or remove it.

## The model: three measurement families

`GOAL_META[type].family` collapses the six types into three families. The family
drives **both** the editor's target section and the inspector viz. Single source
of truth in `data.jsx`.

| Family | Types | Target the editor asks for | Inspector viz |
|---|---|---|---|
| `amount` | daily · session · project · time | a number + unit (words **or** minutes), plus a "counts toward" scope for daily/session/time | **ring** (% of target) |
| `deadline` | deadline | finish-line word count + already-written + a **calendar** date; shows a live "N words/day … M days away" hint | **pace bar**: fill = words done, notch = where an even pace would put you; "behind/ahead/on pace" |
| `streak` | streak | **what keeps it alive** (`any` "just show up" · `daily` "hit my daily words" · `time` "N minutes") + optional milestone days | **flame + current count + 7-day dots** |

### Why streak is modelled this way

A streak isn't a quantity you write *toward*; it's a by-product of showing up.
So instead of a word target it asks for a **qualifying bar**. The `daily` option
("hit my daily words") references a daily word-count goal when one exists and is
**disabled with a hint when it doesn't** — that's how streak ties into the other
goals without a hard dependency. The optional `milestone` is a day count to aim
for (e.g. 30), surfaced as "6/30 to milestone".

## Data reality check

Everything here is **mock progress** living on the goal object so the prototype
reads believably. In production these come from the writing-session store.

```
goal = {
  id, type,                                   // type ∈ GOAL_ORDER
  // amount:
  words | minutes,  scope: "project"|"all",  current,
  // deadline:
  finalWords, date (ISO), startWords, startDate (ISO), current,
  // streak:
  qualifies: "any"|"daily"|"time", qualifyAmount, milestone,
  streakDays, best, week: bool[7],
}
```

`goalProgress(goal)` (data.jsx) is the **only** place that derives display
numbers (pct, days-left, words/day, ahead/behind, week dots). Date math is
guarded so a missing/invalid date never throws. `goalSummary(goal)` gives the
one-liner used by manager rows + the status bar.

### Porting notes (for the eng port)

- Replace mock progress fields with selectors over the real session log:
  - `amount.current` → words (or minutes) recorded for the period (day / sitting
    / project total).
  - `deadline.current` → live manuscript word count; `startWords`/`startDate`
    are the baseline captured when the goal was created.
  - `streak.streakDays`/`best`/`week` → derived from the run of days whose
    qualifying bar was met.
- `goalProgress` is pure and framework-free — copy it as-is into a util and unit
  test the deadline/expected-pace branch.
- Persist `goals[]` per project (the manager's master toggle stays `goalsOn`).
  Scope `"all"` means the amount goal aggregates across projects.

## Class / component map

| Piece | Where | Notes |
|---|---|---|
| `GoalMeta` / `GOAL_ORDER` / `GOALS` | `data.jsx` | type metadata, picker order, seed goals |
| `goalProgress` / `goalSummary` | `data.jsx` | derived numbers + one-liner |
| `GoalsManager` | `dialogs.jsx` | modal with `mode: list \| edit`; `initial` prop = `"list"` \| `"new"` \| a goal id (right-click "Edit" jumps straight in) |
| `GoalEditor` | `dialogs.jsx` | adaptive target section keyed on `family` |
| `Calendar` / `Stepper` | `dialogs.jsx` | reusable; `Stepper` is the −/+ number field |
| `GoalRowMini` | `dialogs.jsx` | compact per-row indicator in the list |
| `GoalCard` / `GoalRing` / `PaceBar` / `StreakViz` | `inspector.jsx` | per-family card; right-click → `onGoalMenu` |
| `openGoalMenu` / `openGoals` | `shell.jsx` | context menu (Edit/Manage/Delete) + overlay opener with `initial` |
| `saveGoal` / `deleteGoal` | `app.jsx` | upsert / remove on `goals[]` |
| status-bar mini | `chrome.jsx` | formats the **primary** goal (goals[0]) per family |

CSS lives in `app.css` under "Goals: manager list / adaptive editor /
inspector visualizations". Semantic pace pills use `color-mix` over `--good` /
`--warn` so they read in both themes.

## Known follow-ups (not built)

- Reordering goals (which one is "primary" in the status bar) — currently
  `goals[0]`.
- An "achieved" celebration state beyond the ring filling.
- Streak `daily`-qualifier currently references *any* daily goal; if multiple
  daily goals exist, pick which one.
