# Wave 49: OpenAI BYOK Direct-Call Research Extract

**Date:** 2026-06-14  
**Objective:** OpenAI Chat Completions API surface for direct HTTP calls from Rust (reqwest) with bring-your-own-key (BYOK), no server intermediary. Streaming only.

---

## 1. Chat Completions Streaming: HTTP Request Body

**Source:** [Create chat completion | OpenAI API Reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) (2026-06-14)

```json
{
  "model": "gpt-5.5",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is the capital of France?"}
  ],
  "stream": true,
  "stream_options": {
    "include_usage": true
  },
  "max_completion_tokens": 1024,
  "temperature": 1.0
}
```

**Key fields:**
- `messages`: array of message objects with roles (system, user, assistant, developer, tool, function)
- `stream: true`: enables SSE streaming
- `stream_options.include_usage: true`: appends a final chunk with usage statistics **before** `data: [DONE]`
- `max_completion_tokens`: upper bound for completion tokens (replaces deprecated `max_tokens`)
- `temperature`: sampling temperature (0–2, default 1.0) — **INCOMPATIBLE with reasoning when `reasoning_effort` is active** (returns 400)

---

## 2. Chat Completions Streaming: SSE Wire Format

**Source:** [Chat Completions streaming events | OpenAI API Reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events) (2026-06-14)

Each chunk is a Server-Sent Event (SSE) with the line format:

```
data: {"id":"chatcmpl-...", "object":"chat.completion.chunk", "created":1756315657, "model":"gpt-5.5", "choices":[{"index":0, "delta":{"content":"text fragment"}, "finish_reason":null, "logprobs":null}], "usage":null}

data: [DONE]
```

**Breaking down the chunk structure:**

```json
{
  "id": "chatcmpl-C9EDpkjH60VPPIB86j2zIhiR8kWiC",
  "object": "chat.completion.chunk",
  "created": 1756315657,
  "model": "gpt-5.5",
  "choices": [
    {
      "index": 0,
      "delta": {
        "content": "text fragment",
        "role": "assistant",
        "tool_calls": null,
        "refusal": null
      },
      "finish_reason": null,
      "logprobs": null
    }
  ],
  "usage": null
}
```

**Final usage chunk (only when `stream_options.include_usage: true`):**

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion.chunk",
  "created": 1756315658,
  "model": "gpt-5.5",
  "choices": [],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150,
    "prompt_tokens_details": {
      "cached_tokens": 20
    },
    "completion_tokens_details": {
      "reasoning_tokens": 0
    }
  }
}
```

Then, literally:

```
data: [DONE]
```

**Critical parsing notes:**
- Content arrives in `choices[0].delta.content` (NOT `message.content`)
- Non-final chunks carry `usage: null`
- Final chunk has **empty `choices` array** (`[]`) with populated `usage`
- SSE terminator is the literal string `data: [DONE]` on a line
- `finish_reason` values: `"stop"` (natural), `"length"` (token limit), `"tool_calls"` (function invoked), `"content_filter"` (safety filter)
- If stream is interrupted, the final usage chunk **may not arrive**

---

## 3. Token Accounting: The Cached-Token Double-Bill Trap

**Source:** [Example Usage Object with Cached Tokens | OpenAI API](https://developers.openai.com/api/docs/guides/prompt-caching) (2026-06-14)

```json
"usage": {
  "prompt_tokens": 2006,
  "completion_tokens": 300,
  "total_tokens": 2306,
  "prompt_tokens_details": {
    "cached_tokens": 1920
  },
  "completion_tokens_details": {
    "reasoning_tokens": 0
  }
}
```

**THE TRAP:**  
`prompt_tokens` **INCLUDES** `cached_tokens`. That is:
- `prompt_tokens` = all prompt tokens sent (2006)
- `prompt_tokens_details.cached_tokens` = how many of those 2006 were cache hits (1920)
- **Billing subtracts cached_tokens at a lower rate**, NOT from the total

So if pricing is $5.00/MTok input and $0.50/MTok cached input:
- **NOT:** `2006 * $5.00`
- **BUT:** `(2006 - 1920) * $5.00 + 1920 * $0.50` = `86 * $5.00 + 1920 * $0.50` = `$430 + $960` = `$1,390`

**Exact JSON paths:**
- Input tokens (total, including cached): `usage.prompt_tokens`
- Cached portion: `usage.prompt_tokens_details.cached_tokens`
- Uncached portion: `usage.prompt_tokens - usage.prompt_tokens_details.cached_tokens`
- Output tokens: `usage.completion_tokens`

---

## 4. GPT-5 Parameter Matrix: `reasoning_effort`, `temperature`, `max_completion_tokens`

**Source:** [Reasoning models | OpenAI API](https://developers.openai.com/api/docs/guides/reasoning) (2026-06-14)

### `reasoning_effort` Enum

| Model | Supported Values | Default |
|---|---|---|
| **GPT-5.4** | `none`, `low`, `medium`, `high`, `xhigh` | `none` |
| **GPT-5.5** | `none`, `low`, `medium`, `high`, `xhigh` | `none` |
| **GPT-5.4-mini** | `none`, `low`, `medium`, `high`, `xhigh` (assumed, not explicitly documented) | `none` |

### Temperature Constraint

- **When `reasoning_effort` is NOT `"none"`:** `temperature` parameter is **REJECTED with HTTP 400**.
- **When `reasoning_effort` is `"none"`:** `temperature` is accepted (range 0–2, default 1.0).
- Request simultaneously specifying `reasoning_effort: "low"` and `temperature: 1.0` will fail with status 400.

### `max_completion_tokens`

- Replaces deprecated `max_tokens`.
- Applies to **output only** (does not include reasoning tokens, which count separately in usage).
- Upper bound; actual output may be shorter if the model finishes naturally or hits stop sequences.

---

## 5. Model IDs & Pricing (Per 1M Tokens, as of 2026-06-14)

**Source:** [GPT-5.4 Model | OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.4), [GPT-5.5 Model | OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.5), [GPT-5.4 mini Model | OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.4-mini) (2026-06-14)

### GPT-5.4

| Property | Value |
|---|---|
| **Canonical model ID** | `gpt-5.4` |
| **Snapshot ID** | `gpt-5.4-2026-03-05` |
| **Input (standard)** | $2.50 / 1M tokens |
| **Input (cached)** | $0.25 / 1M tokens |
| **Output** | $15.00 / 1M tokens |
| **Context window** | 1,050,000 tokens |
| **Max output** | 128,000 tokens |
| **Knowledge cutoff** | 2025-08-31 |

### GPT-5.5

| Property | Value |
|---|---|
| **Canonical model ID** | `gpt-5.5` |
| **Snapshot ID** | `gpt-5.5-2026-04-23` |
| **Input (standard)** | $5.00 / 1M tokens |
| **Input (cached)** | $0.50 / 1M tokens |
| **Output** | $30.00 / 1M tokens |
| **Context window** | 1,050,000 tokens |
| **Max output** | 128,000 tokens |
| **Knowledge cutoff** | 2025-08-31 |
| **High token count penalty** | >272K input: 2x input, 1.5x output for full session |

### GPT-5.4-mini

| Property | Value |
|---|---|
| **Canonical model ID** | `gpt-5.4-mini` |
| **Snapshot ID** | (not found; use `gpt-5.4-mini`) |
| **Input (standard)** | $0.75 / 1M tokens |
| **Input (cached)** | $0.075 / 1M tokens |
| **Output** | $4.50 / 1M tokens |
| **Context window** | 400,000 tokens |
| **Max output** | 128,000 tokens |
| **Knowledge cutoff** | 2025-08-31 |

---

## 6. Authentication & Error Handling

### Bearer Token

**Source:** [Authenticate and Specify Organization/Project | OpenAI API](https://developers.openai.com/api/docs/api-reference/runs/step-object) (2026-06-14)

```
Authorization: Bearer $OPENAI_API_KEY
```

Header is required. Invalid or missing key returns 401.

### 401 Unauthorized (Invalid API Key)

**Source:** [Error Codes | OpenAI API](https://developers.openai.com/api/docs/guides/error-codes) (2026-06-14)

Response status: `401`

Response body (JSON):
```json
{
  "error": {
    "message": "Incorrect API key provided. You can find your API key at https://platform.openai.com/account/api-keys.",
    "type": "invalid_request_error",
    "param": null,
    "code": "invalid_api_key"
  }
}
```

**For Rust:** Extract and sanitize — **do NOT log the Authorization header; do NOT echo the API key**. Display to user as: "Invalid API key — check Settings."

### 429 Rate Limit (Too Many Requests)

**Source:** [Error Codes | OpenAI API](https://developers.openai.com/api/docs/guides/error-codes) (2026-06-14)

Response status: `429`

Response body (JSON):
```json
{
  "error": {
    "message": "Rate limit reached for requests. Limit: 100, Used: 100, Requested: 1. Please try again in 60s.",
    "type": "rate_limit_error",
    "param": null,
    "code": "rate_limit_exceeded"
  }
}
```

The `message` field often includes a suggested retry-after time (seconds). Implement exponential backoff.

---

## 7. 2026 Gotchas: Direct Streaming from Rust

### Chunked Transfer Encoding Issue

**Source:** [Assistants API Streaming Connection Closure Issue | OpenAI Community](https://community.openai.com/t/assistants-api-streaming-connection-closure-issue/1367634) (2025-11), [Chat Completions streaming | OpenAI API](https://developers.openai.com/api/docs/guides/streaming-responses) (2026-06-14)

**Finding:** OpenAI has reported prematurely closing HTTP connections before sending the complete chunked transfer encoding termination sequence, causing `RemoteProtocolError` in strict HTTP clients (especially embedded systems).

**Mitigation for reqwest:**
- Use `reqwest` 0.11.20+ with liberal timeout settings (streaming waits longer between chunks than typical requests)
- Do NOT validate the transfer encoding trailer strictly; gracefully handle early close
- Implement a timeout on the stream reader itself (some chunks may arrive slowly)

### Partial-Line Buffering Across Chunk Boundaries

**Observation from SSE protocol:** SSE lines (starting with `data: `) may span multiple TCP packets. Reqwest's streaming JSON decoder should handle this, but be aware:
- A `data: {...JSON...}` line **may arrive in parts**
- Buffer and parse at the newline boundary, not the packet boundary
- The `data: [DONE]` terminator is always on its own line and signals the absolute end

### Stream Obfuscation

**Source:** [Streaming API responses | OpenAI API](https://developers.openai.com/api/docs/guides/streaming-responses) (2026-06-14)

OpenAI can inject an `obfuscation` field into streaming chunks to normalize payload sizes and mitigate side-channel attacks. Your Rust parser should ignore unknown fields; serde will handle this if the struct is marked with `#[serde(deny_unknown_fields = false)]`.

### Connection Pooling & Keep-Alive

No documented gotchas, but best practice:
- Reuse `reqwest::Client` across requests (built-in connection pooling)
- Chat Completions streaming can take 10–60 seconds; don't set overly aggressive timeouts on the request itself (timeout should be on individual chunk arrival, not total duration)

---

## 8. Summary of Highest-Risk Findings

### 1. **Cached-Token Double-Bill** (Critical for Billing)

`prompt_tokens` includes cached tokens. Billing uses a weighted calculation:
```
cost = (prompt_tokens - cached_tokens) * standard_rate + cached_tokens * cached_rate
```
Not: `prompt_tokens * standard_rate`

**Action:** When showing user the API cost or tracking usage, subtract `prompt_tokens_details.cached_tokens` from the billing amount at standard rate, then bill that separately at the cache rate.

### 2. **Temperature Rejected When Reasoning Active** (400 Error)

Setting both `reasoning_effort: "low"` (or any non-`"none"` value) **and** `temperature: 1.0` simultaneously will return HTTP 400: `"invalid_request_error"` with message referencing incompatible parameters.

**Action:** When dispatching to OpenAI, if user has reasoning enabled, **force `temperature` to 0 or omit it entirely**; default to `reasoning_effort: "none"` with normal temperature if user doesn't request reasoning.

### 3. **Model ID Snapshot Uncertainty** (VERIFY)

| Model | ID Confirmed | Notes |
|---|---|---|
| GPT-5.4 | `gpt-5.4-2026-03-05` ✓ | Snapshot dated March 5, 2026 |
| GPT-5.4-mini | `gpt-5.4-mini` ✓ | No dated snapshot found in docs; use canonical |
| GPT-5.5 | `gpt-5.5-2026-04-23` ✓ | Snapshot dated April 23, 2026 |

**Recommendation:** Use the canonical IDs (`gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`) for production. Pin to snapshots only if a specific model behavior is critical and needs to be locked.

---

## References

- [OpenAI Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
- [Streaming API Responses Guide](https://developers.openai.com/api/docs/guides/streaming-responses)
- [Chat Completions Streaming Events Reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events)
- [Prompt Caching & Cached Token Usage](https://developers.openai.com/api/docs/guides/prompt-caching)
- [Reasoning Models Guide](https://developers.openai.com/api/docs/guides/reasoning)
- [Error Codes & Handling](https://developers.openai.com/api/docs/guides/error-codes)
- [GPT-5.4 Model Docs](https://developers.openai.com/api/docs/models/gpt-5.4)
- [GPT-5.5 Model Docs](https://developers.openai.com/api/docs/models/gpt-5.5)
- [GPT-5.4-mini Model Docs](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

**All source URLs accessed 2026-06-14 and verified current.**
