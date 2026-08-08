---
vendor: "Azure Artifact Signing (formerly Trusted Signing)"
sdkVersion: "signtool + Microsoft.Trusted.Signing.Client dlib"
firstWritten: 2026-06-10
lastVerified: 2026-06-10
relatedPaths:
  - publish.ps1
notes: "Authenticode signing for the NSIS release bundle via publish.ps1. signtool+dlib, ~/.artifact-signing/, User-scope Azure SP env vars."
---

# Azure Artifact Signing gotchas

## 2026-06-10 — Setup: signtool + dlib, User-scope env vars, agent shells don't inherit them
Source: commit 930b8d6

**Gotcha:** Authenticode signing is wired into `publish.ps1` via signtool + the
`Microsoft.Trusted.Signing.Client` dlib. Assets live in `~/.artifact-signing/` (dlib under
`client\bin\x64\`, `metadata.json` holds endpoint `https://eus.codesigning.azure.net`, account
`writersnook`, profile `writersnook-pub`). Auth is `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` /
`AZURE_CLIENT_SECRET` set as **User-scope** environment variables (app registration
`writersnook-signer`, role "Artifact Signing Certificate Profile Signer" on the account). Agent
shells do NOT inherit freshly-set User-scope env vars.

**Workaround:** load the vars in-process before testing:
`[Environment]::GetEnvironmentVariable($v,'User')` for each of the three, rather than assuming a
new shell picks them up automatically.

**Why:** Windows User-scope env vars are written to the registry and only propagate to processes
started after the write, in a session that re-reads the environment block — a shell opened before
the vars were set (or one spawned without re-sourcing user env) won't see them.

## 2026-06-10 — Two 403 traps: anti-enumeration masking + IAM picker resolving a stale duplicate SP
Source: commit 930b8d6

**Gotcha:** two separate issues both surface as an opaque 403 and cost roughly an hour to
untangle:
1. The signing service returns **403, not 404, for a wrong account/profile name**
   (anti-enumeration) — a name typo is indistinguishable from a genuine permission problem from
   the error alone.
2. The Azure portal's IAM "add role assignment" member picker resolved the display name
   `writersnook-signer` to a **stale duplicate object** (principal `9989b5e4…`) instead of the
   real service principal (`2b5ffece…`). The role showed as correctly assigned in the portal UI,
   but the app actually authenticating never had it.

**Workaround:** if signing 403s, get ground truth via the `az` CLI (device-code login as Cole)
instead of trusting portal display names: `az ad sp show --id <client-id>` and compare its
`objectId` against `az role assignment list --scope <signing account resource id>`. The Rust
wrapper CLIs (`trusted-signing-cli`, `artifact-signing-cli`) are dead ends for a
subscription-less service principal — they shell out to `az login`, which fails with "No
subscriptions found." signtool + dlib with `ExcludeCredentials` forcing `EnvironmentCredential` is
the working path.

**Why:** Azure's anti-enumeration design intentionally can't distinguish "doesn't exist" from
"exists, no permission" over the API; the portal's name-based picker is a UX convenience that can
silently resolve to the wrong underlying object when duplicates exist (e.g. from a prior failed
setup attempt).

**Cleanup still pending as of 2026-06-10:** rotate the client secret (was exposed in a session
transcript); optionally delete the failed profile `writersnook-public` and the stale `9989b5e4`
role assignment.
