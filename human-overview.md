# WritersNook — Overview

## What is this?
WritersNook is a desktop app for writing novels and other long-form creative work. It gives you a calm,
distraction-free writing space with a built-in outline ("binder") for organizing chapters and scenes, a
place to keep notes on your characters and world, and an optional AI helper for brainstorming. Everything
you write is stored on your own computer, and the app quietly backs it up off-machine so you never lose work.

## Current status
In production — shipped and in daily use as of mid-2026 (Windows desktop). Mobile and live two-device sync
are planned for a later phase.

## Who is it for?
Writers who want a focused, private place to write and own their files — no cloud lock-in, no subscription
required to write. Right now it's used by the maker and a writing partner; it's built to grow to a wider
audience.

## How do I run it?
You need a Windows machine with the developer prerequisites installed (Node, Rust, and Microsoft's C++
build tools). Then, from the project folder, install dependencies and launch the app in development mode —
the exact two commands are in [`README.md`](README.md) under "Setup." End users don't build it themselves;
they install a signed release that updates itself automatically.

## The main pieces
- **The writing space (editor).** Where you actually write. It's a rich-text editor that autosaves and is
  built to support collaboration and sync later.
- **The binder.** A Scrivener-style outline down the side — chapters, scenes, folders — that you can
  rearrange by dragging. It's how you navigate and structure a manuscript.
- **The Story Bible.** Notes on characters, places, and the world, with a relationship map. The optional AI
  can draw on these for context.
- **Local storage + backup.** Your work is saved in a database file on your machine and backed up off-machine
  automatically, so it's both private and safe.
- **The AI assistant (opt-in).** A consent-gated brainstorming/editing helper. It's off by default, never
  required, and costs nothing unless you choose to use it.
- **The marketing site.** A separate website (writersnook.app) that handles sign-ups, the store, and accounts.

## Key terms
- **Local-first** — your data lives on your device and works fully offline; the cloud is for backup, not the
  source of truth.
- **Binder** — the outline/navigation sidebar for chapters and scenes.
- **Scene** — the smallest unit of writing; each scene is its own self-contained document.
- **Story Bible** — the collected notes about characters, places, and world details.
- **Opt-in AI** — AI features you must deliberately turn on; nothing about core writing depends on them.

## Where to go next
- Day-to-day project state and what's next: [`roadmap/HANDOFF.md`](roadmap/HANDOFF.md).
- The full design and architecture: [`docs/superpowers/specs/`](docs/superpowers/specs/).
- Locked technical decisions: [`decisions/`](decisions/).
