# Play Store submission — runbook and listing draft

> Created 2026-08-22. Companion-only Android app (`com.coles.writersnook`), no IAP,
> no accounts. Desktop remains the purchased product; mobile is free.

## State of the blockers (from HANDOFF "not submittable")

| Blocker | State |
|---|---|
| Marketing version `0.1.0` | **Done** — `app.json` is `1.0.0`; `versionCode` is EAS-managed (`autoIncrement: true` in the production profile). |
| Release signing = debug keystore | **One Cole command** (below). EAS generates and holds the upload keystore; Play App Signing re-signs anyway. Never hand-edit `build.gradle` — prebuild regenerates it. |
| Stale privacy policy | **Done** — privacy.html now covers the phone app, camera/QR pairing, share sheet, Device Sync E2E, mobile AI credential handoff, and Fathom (site-only). Live once master is pushed. |
| Store listing / data safety / age rating | **Drafted below** — paste into Play Console. |
| No in-app account deletion | **Done.** Settings has a "Remove AI access" action (`clearAiCredential()` in `mobile/src/features/ai/credentialHandoff.ts`) that deletes the SecureStore credential/trial key and clears in-memory session state, with a destructive confirm. The deletion URL is `https://writersnook.app/delete-account.html`. Reasoning: this app has no account-creation flow, so Google/Apple's strict account-deletion mandate (delete the whole account in-app) doesn't literally apply — the credential handed off from desktop is the entire local footprint, and the web page covers the server-side email/name/order-history/license-key/credit-balance data held only if something was bought or trialed. This is the proportionate compliance surface, not a full account-deletion flow. |
| Splash migration unverified on device | Verify on the Pixel during the next device session (cold launch, light + dark). |

## The one interactive command (Cole)

EAS keystore generation cannot run non-interactively. From `mobile/`:

```bash
eas credentials -p android
```

Choose: production → Keystore → "Set up a new keystore" → let EAS generate and store it.
After that, the production AAB is a normal cloud build (agents can run it):
`eas build -p android --profile production` — profile already sets `app-bundle` + autoIncrement.
`eas submit` is configured for the internal track, draft release.

## Listing draft

- **App name:** WritersNook — Companion
- **Short description (≤80 chars):**
  `Your novel on your phone. Companion to the WritersNook desktop writing app.`
- **Full description:**

  WritersNook Companion brings your manuscripts to your phone — as a companion to
  the WritersNook desktop app for Windows and macOS.

  Write and edit scenes, capture stray ideas into your Inbox, browse your story
  bible, check your writing goals, and rearrange your outline — wherever you are.
  Pair with your desktop by scanning a QR code, and your changes travel between
  your devices end-to-end encrypted. Your words are never stored on our servers;
  the sync relay only passes encrypted changes along.

  • Local-first: everything on the phone is stored on the phone
  • End-to-end encrypted Device Sync with your desktop
  • Scenes, chapters, outliner, corkboard, and boards
  • Story bible: characters, places, relationships
  • Quick capture: share text from any app straight into your Inbox
  • Writing goals and streaks
  • Optional AI brainstorming assistant (via your desktop's subscription — never
    required, and the app works fully without it)
  • No account, no ads, no analytics

  A WritersNook desktop installation is required for pairing; the app is a
  companion, not a standalone product.

- **Category:** Productivity. **Free**, no ads, no in-app purchases.
- **Contact:** support@writersnook.app · https://writersnook.app
- **Privacy policy URL:** https://writersnook.app/privacy.html

## Data safety questionnaire (answers)

- Does the app collect or share user data? **No data collected, no data shared.**
  - Manuscript/sync data: stays on-device / E2E-encrypted relay transit — Google's
    definition of "collected" excludes E2E-encrypted transient transit and
    on-device data. AI assistant text is user-initiated, processed ephemerally
    ("transient processing" exemption), not stored; declare **nothing collected**.
    If reviewers push back on the AI path, the fallback declaration is
    "Other in-app messages — shared, ephemeral, user-initiated, optional".
- Data encrypted in transit? **Yes** (TLS + E2E). Deletion mechanism? **Data is
  on-device; delete by uninstalling, or use Settings → "Remove AI access" for the
  AI credential specifically. Server-side data (only if you bought or trialed
  something) via https://writersnook.app/delete-account.html.**
- Security practices: independent review **No**.

## Content rating (IARC)

Utility/productivity app, no UGC exchange with strangers, no location, no
violence/sexual content/gambling → expect **Everyone / PEGI 3**. The AI assistant
is generative but private to the user; answer the "AI-generated content" question
honestly per the current questionnaire wording.

## Screenshots / assets still needed

- ≥2 phone screenshots (1080×1920+): Hub, editor, binder, relationship map, goals.
  Take on the Pixel 3 XL or emulator with a seeded demo project — not Cole's data.
- Feature graphic 1024×500 (parchment + feather mark + "Your novel, on your phone").
- 512×512 icon: already have (`assets/icon.png` source art).
