# Wave 37 — AI Harness Optimization: Anthropic Messages API Research Extract

**Date:** June 13, 2026  
**Source:** Anthropic official API documentation (Context7 + direct fetch)  
**Scope:** Prompt caching contract, messages.create shape, model IDs, pricing for Claude Haiku 4.5, Sonnet 4.6, Opus 4.8

---

## 1. Prompt Caching — Placement & Contract

### 1.1 Top-level (Automatic) vs. Per-block (Explicit) Placement

**Both are valid. Top-level is recommended for most cases.**

#### Top-level (Automatic Caching)
Place a single `cache_control` field at the top level of the request. The system automatically applies the cache breakpoint to the last cacheable block and moves it forward as conversations grow.

```python
response = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=1024,
    cache_control={"type": "ephemeral"},
    system="You are an AI assistant...",
    messages=[
        {"role": "user", "content": "Your question here"}
    ]
)
```

**Source:** https://platform.claude.com/docs/en/build-with-claude/prompt-caching (direct fetch, June 2026)

#### Per-block (Explicit Breakpoints)
Place `cache_control` directly on individual content blocks (system, documents, tool results, tools). This grants fine-grained control over what gets cached.

```python
response = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": "You are an expert legal analyst.",
            "cache_control": {"type": "ephemeral"}
        },
        {
            "type": "text",
            "text": "[Full 50-page legal document here]",
            "cache_control": {"type": "ephemeral"}
        }
    ],
    messages=[
        {"role": "user", "content": "What are the key terms?"}
    ]
)
```

**Source:** https://platform.claude.com/docs/en/build-with-claude/prompt-caching (direct fetch, June 2026); TypeScript SDK test example in `/anthropics/anthropic-sdk-typescript`

#### Top-level-is-400 Question: **RESOLVED — No, top-level is NOT a 400 error**

Top-level `cache_control` is a first-class parameter in `MessageCreateParamsBase` and is fully supported. The earlier "gotcha" flag in prior research was incorrect. Confirmed via TypeScript SDK interface definition:

```typescript
export interface MessageCreateParamsBase {
  cache_control?: CacheControlEphemeral | null;  // Optional top-level field
  system?: string | Array<TextBlockParam>;
  messages: Array<MessageParam>;
  model: Model;
  max_tokens: number;
  temperature?: number;
  // ... other fields
}
```

**Source:** `/anthropics/anthropic-sdk-typescript` (Context7 query, June 2026)

---

## 2. Minimum Cacheable Tokens by Model

**Haiku 4.5 minimum: 4,096 tokens**

| Model | Min Cacheable Tokens | Notes |
|-------|---------------------|-------|
| Claude Haiku 4.5 | 4,096 | **Applies to this wave** |
| Claude Sonnet 4.6 | 1,024 | |
| Claude Opus 4.8 | 1,024 | |
| Claude Opus 4.7 | 2,048 | Uses new tokenizer; up to 35% more tokens for same text |
| Claude Fable 5, Mythos 5 | 512 | |

Shorter prompts will not be cached (no error returned). Verify caching occurred by checking `cache_creation_input_tokens > 0` and `cache_read_input_tokens > 0` in the response `usage` object.

**Source:** https://platform.claude.com/docs/en/build-with-claude/prompt-caching (direct fetch, June 2026)

---

## 3. Cache TTL Mechanics

### 3.1 Two TTL Options

| TTL | Duration | Pricing | Request Syntax |
|-----|----------|---------|-----------------|
| **Ephemeral (default)** | 5 minutes | 1.25x base input | `{"type": "ephemeral"}` |
| **Extended (1-hour)** | 1 hour | 2x base input | `{"type": "ephemeral", "ttl": "1h"}` |

Both are requested using the `ephemeral` type; the `ttl` field is optional (default is 5 minutes).

### 3.2 Example: 1-hour TTL Request

```python
response = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=1024,
    cache_control={
        "type": "ephemeral",
        "ttl": "1h"  # Request 1-hour cache
    },
    system="Long stable prompt...",
    messages=[...]
)
```

**Source:** https://platform.claude.com/docs/en/build-with-claude/prompt-caching (direct fetch, June 2026)

---

## 4. Prompt Caching Pricing

### 4.1 Pricing Multipliers (All Models)

| Operation | Multiplier | Cost Breakdown |
|-----------|-----------|-----------------|
| 5-minute cache **write** | 1.25x base input | Charged when content first stored |
| 1-hour cache **write** | 2x base input | Charged when content first stored |
| Cache **read** (hit) | 0.1x base input | Charged when subsequent request retrieves cached content |

**Key insight:** A cache write at 1.25x breaks even after one cache read (0.1x), making the 5-minute cache profitable on second use.

### 4.2 Per-model Pricing Table

| Model | Base Input | 5m Cache Write | 1h Cache Write | Cache Read | Base Output |
|-------|-----------|--------------|--------------|----------|-----------|
| Claude Haiku 4.5 | $1 / MTok | $1.25 / MTok | $2 / MTok | $0.10 / MTok | $5 / MTok |
| Claude Sonnet 4.6 | $3 / MTok | $3.75 / MTok | $6 / MTok | $0.30 / MTok | $15 / MTok |
| Claude Opus 4.8 | $5 / MTok | $6.25 / MTok | $10 / MTok | $0.50 / MTok | $25 / MTok |

**Source:** https://platform.claude.com/docs/en/docs/about-claude/pricing (WebFetch, June 2026)

---

## 5. Response Usage Tracking

The response `usage` object reports cache activity via three fields:

```python
response.usage
# {
#   "input_tokens": <uncached tokens after last breakpoint>,
#   "output_tokens": <response tokens>,
#   "cache_creation_input_tokens": <tokens written to cache>,
#   "cache_read_input_tokens": <tokens retrieved from cache>
# }
```

**Field definitions:**
- `cache_creation_input_tokens`: Tokens written to cache on this request (billed at 1.25x or 2x)
- `cache_read_input_tokens`: Tokens retrieved from cache on this request (billed at 0.1x)
- `input_tokens`: New tokens after the last cache breakpoint (billed at 1x)

**Total input cost:** `(cache_read_input_tokens × 0.1) + (cache_creation_input_tokens × 1.25_or_2) + (input_tokens × 1)`

**Source:** https://platform.claude.com/docs/en/build-with-claude/prompt-caching (direct fetch, June 2026)

---

## 6. messages.create Request Shape

### 6.1 Required & Core Optional Parameters

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `model` | string | required | See **Model IDs** section below |
| `messages` | array | required | `[{role: "user" \| "assistant", content: string \| array}]` |
| `max_tokens` | number | required | Must be ≥ 1; used for both output limit and thinking budget constraint |
| `system` | string \| array | optional | String for simple prompt, array of `TextBlockParam` for multi-block with caching |
| `temperature` | number | optional | Range: 0.0–1.0; default undefined (not set). **Incompatible with extended thinking** (returns 400 error) |
| `cache_control` | object | optional | `{type: "ephemeral"}` or `{type: "ephemeral", ttl: "1h"}` (top-level automatic caching) |

### 6.2 Complete Example

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=2048,
    temperature=0.7,
    cache_control={"type": "ephemeral"},
    system=[
        {
            "type": "text",
            "text": "You are a helpful writing assistant.",
            "cache_control": {"type": "ephemeral"}
        }
    ],
    messages=[
        {
            "role": "user",
            "content": "Write a short story about a robot learning to paint."
        }
    ]
)

print(response.content[0].text)
print(f"Cache usage: {response.usage.cache_read_input_tokens} read, {response.usage.cache_creation_input_tokens} written")
```

**Source:** `/anthropics/anthropic-sdk-typescript` (Context7) + https://platform.claude.com/docs/en/build-with-claude/prompt-caching (direct fetch, June 2026)

---

## 7. Model IDs & Current Availability

### 7.1 For Wave 37 (Haiku, Sonnet, Opus)

| Model | Canonical ID | Status | Input | Output |
|-------|--------------|--------|-------|--------|
| **Claude Haiku 4.5** | `claude-haiku-4-5-20251001` | Current (June 2026) | $1 / MTok | $5 / MTok |
| **Claude Sonnet 4.6** | `claude-sonnet-4-6` | Current | $3 / MTok | $15 / MTok |
| **Claude Opus 4.8** | `claude-opus-4-8` | Current (premium) | $5 / MTok | $25 / MTok |

The versioned ID `claude-haiku-4-5-20251001` and generic `claude-haiku-4-5` both resolve to the same model; the versioned form is preferred for reproducibility.

**Source:** `/anthropics/anthropic-sdk-typescript` Model type definition (Context7) + https://platform.claude.com/docs/en/docs/about-claude/pricing (WebFetch, June 2026)

---

## 8. Extended Thinking & Temperature Constraint

### 8.1 The Constraint

**Temperature is incompatible with extended thinking. Setting `temperature` when `thinking` is enabled returns a 400 error.**

```python
# ❌ This will fail with 400 error
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=16000,
    temperature=0.7,  # FORBIDDEN when thinking is enabled
    thinking={"type": "enabled", "budget_tokens": 10000},
    messages=[...]
)

# ✅ Correct: omit temperature when using thinking
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 10000},
    messages=[...]
)
```

### 8.2 Alternative: top_p When Thinking is Enabled

When extended thinking is enabled, you **can** set `top_p` to values between 0.95 and 1.0 (default is effectively 1.0).

**Source:** https://platform.claude.com/docs/en/build-with-claude/extended-thinking (direct fetch, June 2026) + search-verified constraint reports

### 8.3 Adaptive Thinking (Newer Models)

Claude Opus 4.8, Opus 4.7, and Sonnet 4.6 prefer adaptive thinking over manual budget-based thinking:

```python
# Preferred for Opus 4.8 / 4.7 / Sonnet 4.6
response = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=16000,
    thinking={"type": "adaptive", "effort": "high"},  # Instead of budget_tokens
    messages=[...]
)
```

Adaptive thinking does NOT forbid `temperature`; it only controls thinking depth via the `effort` parameter (low / medium / high / max).

**Source:** https://platform.claude.com/docs/en/build-with-claude/extended-thinking (direct fetch, June 2026)

---

## 9. Caching with Extended Thinking

When both prompt caching and extended thinking are used:

- **System prompt cache:** Preserved when thinking parameters change
- **Message cache:** Invalidated when thinking parameters change
- **Thinking blocks:** Count as input tokens when read from cache; considered regular content for caching purposes

Anthropic recommends the **1-hour cache duration** for extended thinking tasks that take longer than 5 minutes.

**Source:** https://platform.claude.com/docs/en/build-with-claude/extended-thinking (direct fetch, June 2026)

---

## 10. Summary Table: Wave 37 Request Skeleton

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Cache placement** | Top-level `cache_control` (automatic) | Simpler; system auto-manages breakpoints as conversation grows. Per-block if granular control needed. |
| **Haiku min tokens** | 4,096 | Wave target model; shorter prompts silently skip cache (no error). |
| **TTL for brainstorm** | 5-minute ephemeral (default) | Reasonable for interactive sessions. Consider 1-hour if brainstorm cache reused >4 min apart. |
| **Temperature + thinking** | Omit temperature when thinking enabled | 400 error otherwise. Use `top_p: 0.95–1.0` or adaptive `effort` parameter instead. |
| **Model ID (Haiku)** | `claude-haiku-4-5-20251001` | Versioned for reproducibility; current as of June 2026. |
| **Pricing optimization** | Cache read ROI: 1 hit for 5m, 2 hits for 1h | 1.25x write cost breaks even at first read (0.1x); 2x write at second read. |

---

## 11. Known Gaps & Version Sensitivity

| Gap | Status | Impact |
|-----|--------|--------|
| **top_k with extended thinking** | Forbidden (like temperature) | If using thinking, omit `top_k`. Use `top_p` instead. |
| **Forced tool use with extended thinking** | Not supported | `tool_choice: {type: "any"}` and `{type: "tool"}` unsupported with thinking enabled; only `auto` / `none`. |
| **Opus 4.8 manual thinking** | Not supported | Manual budget-based thinking removed; use adaptive thinking + `effort` parameter only. |
| **Caching on Haiku 3.5** | Min 2,048 tokens | If supporting older Haiku, adjust min-token threshold. Haiku 3.5 is retired (except on Bedrock/Vertex). |

---

## Sources

- **Anthropic SDK TypeScript:** `/anthropics/anthropic-sdk-typescript` (Context7, June 2026)
  - `messages.ts`: MessageCreateParamsBase interface, Model type definitions, CacheControlEphemeral type
  - `tests/api-resources/messages/messages.test.ts`: Cache control examples on system blocks
  
- **Anthropic Platform Docs (Pricing):** https://platform.claude.com/docs/en/docs/about-claude/pricing (WebFetch, June 2026)
  - Official pricing table: model input/output rates, cache write/read multipliers
  
- **Anthropic Platform Docs (Prompt Caching):** https://platform.claude.com/docs/en/build-with-claude/prompt-caching (WebFetch, June 2026)
  - Automatic vs. explicit caching, minimum tokens by model, TTL syntax, cache usage tracking
  
- **Anthropic Platform Docs (Extended Thinking):** https://platform.claude.com/docs/en/build-with-claude/extended-thinking (WebFetch, June 2026)
  - Temperature constraint, adaptive vs. manual thinking, caching interaction
  
- **WebSearch:** Extended thinking + temperature constraint verification (June 2026)
  - GitHub issues confirming 400 error on temperature with thinking enabled
