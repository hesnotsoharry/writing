---
status: ACTIVE
decided-in: wave-52
promoted-during: wave-52
---

## Context

When hidden prose is stripped for AI context assembly, redaction must happen at a single chokepoint that all four AI paths (managed proxy, BYOK Anthropic, BYOK OpenAI, BYOK local) inherit without redacting plain export or word-count.

## Pick

Add a redacting extractor on `src/yjs/serialize.ts` (mark-aware over Y.Doc deltas) called only by `assembleContext`, alongside `filterAiEntities`; leave plain `extractPlainText` untouched.

## Rationale

`assembleContext` is the verified single chokepoint for all prose-to-AI flow (managed + 3 BYOK); the strip there covers every path once. Keeping plain `extractPlainText` un-redacted protects export and word count. This concentrates the privacy guarantee in one place, making it audit-verifiable and future-resistant.

## Consequences

Two extraction functions coexist (plain + redacting); AI paths use the redacting one, everything else the plain one. The redacting variant walks Y.Doc deltas directly (not ProseMirror node.marks), checking `attributes.aiExclude` at the mark level.

## Enforcement

Asserted by the Phase 2 acceptance test: AI path redacts hidden ranges to `[passage hidden by author]`, export carries full text.
