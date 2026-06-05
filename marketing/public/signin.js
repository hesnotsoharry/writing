// ============================================================================
// signin.js — magic-link send flow (ES module)
//
// Wires the #magicForm on signin.html to Supabase Auth signInWithOtp.
// On success: hides the form card and shows the "check your inbox" card.
// On error:   shows the error message inline below the submit button.
// On resend:  re-submits the last email address.
//
// This file imports from supabase-client.js (which in turn imports from a
// remote CDN URL). Do NOT import this file in Node/Vitest tests — it will
// fail because the CDN URL is unreachable in that environment.
// Pure helpers live in form-utils.js and are tested there.
// ============================================================================

import { supabase } from "./supabase-client.js";
import { isValidEmail } from "./form-utils.js";

// --------------------------------------------------------------------------
// Unconfigured-placeholder guard
// If the developer hasn't replaced the placeholder values in supabase-config.js
// we show a friendly warning in the UI instead of throwing a cryptic error.
// --------------------------------------------------------------------------
function isUnconfigured() {
  const cfg = window.WN_SB || {};
  return !cfg.url || cfg.url === "https://REPLACE_PROJECT.supabase.co";
}

// --------------------------------------------------------------------------
// Inline error display
// Shows a short error message below the submit button inside #formCard.
// --------------------------------------------------------------------------
function showFormError(message) {
  let el = document.getElementById("signinError");
  if (!el) {
    el = document.createElement("p");
    el.id = "signinError";
    el.style.cssText =
      "font-size:13.5px;color:var(--error,#c0392b);margin:10px 0 0;text-align:center";
    const form = document.getElementById("magicForm");
    if (form) form.appendChild(el);
  }
  el.textContent = message;
  el.style.display = "block";
}

function clearFormError() {
  const el = document.getElementById("signinError");
  if (el) el.style.display = "none";
}

// --------------------------------------------------------------------------
// Swap to the "check your inbox" confirmation card
// Reuses signin.html's existing two-card mechanism: #formCard / #sentCard.
// Sets the #sentTo span to the submitted email so the copy is personalised.
// --------------------------------------------------------------------------
function showSentCard(email) {
  const sentTo = document.getElementById("sentTo");
  if (sentTo) sentTo.textContent = email;
  const formCard = document.getElementById("formCard");
  const sentCard = document.getElementById("sentCard");
  if (formCard) formCard.style.display = "none";
  if (sentCard) sentCard.style.display = "block";
}

// --------------------------------------------------------------------------
// Core send — extracted so the "resend" link can call it with the last email.
// --------------------------------------------------------------------------
async function sendMagicLink(email) {
  if (isUnconfigured()) {
    showFormError(
      "Sign-in is not yet configured. " +
        "Replace the placeholders in supabase-config.js with your Supabase project URL and anon key.",
    );
    return;
  }

  clearFormError();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Redirect to account.html relative to the current page's origin + path.
      // new URL("account.html", location.href) handles both root and
      // subdirectory deployments correctly.
      emailRedirectTo: new URL("account.html", location.href).href,
      // Create the Supabase Auth user on first magic-link click (just-in-time).
      // The purchases row (created by the m1 webhook) already exists; RLS
      // scopes it to auth.jwt() ->> 'email' = purchases.email.
      // See Locked Decision 1 in wave-m3-magic-link-accounts.md.
      shouldCreateUser: true,
    },
  });

  if (error) {
    showFormError(error.message || "Something went wrong — please try again.");
    return;
  }

  showSentCard(email);
}

// --------------------------------------------------------------------------
// DOM wiring — runs after the document is parsed.
// --------------------------------------------------------------------------
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    let lastEmail = "";

    const form = document.getElementById("magicForm");
    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        const emailInput = document.getElementById("email");
        const email = emailInput ? emailInput.value.trim() : "";

        if (!isValidEmail(email)) {
          showFormError("Please enter a valid email address.");
          return;
        }

        lastEmail = email;

        // Disable the submit button while the request is in-flight.
        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Sending…";
        }

        await sendMagicLink(email);

        // Re-enable if we're still on the form (error path).
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Email me a sign-in link";
        }
      });
    }

    // "Send it again" link in the sentCard — re-sends to the same address.
    const resend = document.getElementById("resend");
    if (resend) {
      resend.addEventListener("click", async function (e) {
        e.preventDefault();
        if (!lastEmail) return;
        resend.textContent = "Sending…";
        await sendMagicLink(lastEmail);
        resend.textContent = "sent again ✓";
      });
    }
  });
}
