// ============================================================================
// account.js — auth-gated account page glue (ES module, browser-only).
//
// Imports are from CDN (supabase-client.js) and a pure local module
// (account-render.js). This file MUST NOT be imported in Vitest tests —
// supabase-client.js's CDN import is unreachable in Node.
//
// Flow:
//   1. On DOMContentLoaded, check getSession().
//   2a. Authenticated → fetch purchases row via RLS, renderAccount(), apply DOM.
//   2b. Unauthenticated → hide account panel, show sign-in prompt.
//   Guard: if supabase-config.js has placeholder values, show a dev warning.
// ============================================================================

import { supabase } from "./supabase-client.js";
import { renderAccount } from "./account-render.js";

// --------------------------------------------------------------------------
// Unconfigured-placeholder guard (same check as signin.js)
// --------------------------------------------------------------------------
function isUnconfigured() {
  const cfg = window.WN_SB || {};
  return !cfg.url || cfg.url === "https://REPLACE_PROJECT.supabase.co";
}

// --------------------------------------------------------------------------
// Apply the renderAccount view object to the DOM.
// --------------------------------------------------------------------------
function applyViewToDom(view) {
  // License key
  const lickey = document.getElementById("lickey");
  if (lickey) lickey.textContent = view.licenseKey ?? "—";

  // Order / product / date / amount in the billing history table
  const billProduct = document.getElementById("bill-product");
  if (billProduct) billProduct.textContent = view.product ?? "—";

  const billDate = document.getElementById("bill-date");
  if (billDate) billDate.textContent = view.purchaseDate ?? "—";

  const billAmount = document.getElementById("bill-amount");
  if (billAmount) billAmount.textContent = view.amount ?? "—";

  const billOrderId = document.getElementById("bill-order-id");
  if (billOrderId) billOrderId.textContent = view.orderId ? "#" + view.orderId : "—";

  // Profile email
  const profileEmail = document.getElementById("profile-email");
  if (profileEmail) profileEmail.textContent = view.email;

  // Header email + avatar initial
  const headerEmail = document.getElementById("header-email");
  if (headerEmail) headerEmail.textContent = view.email;

  const avatarInitial = document.getElementById("avatar-initial");
  if (avatarInitial) avatarInitial.textContent = view.email.charAt(0).toUpperCase();

  // No-purchase note
  const noPurchaseNote = document.getElementById("no-purchase-note");
  if (noPurchaseNote) {
    noPurchaseNote.style.display = view.hasPurchase ? "none" : "block";
  }
}

// --------------------------------------------------------------------------
// Show / hide the two mutually exclusive panels.
// #acct-panel  — the account data (authenticated state)
// #signin-prompt — the sign-in call-to-action (unauthenticated state)
// --------------------------------------------------------------------------
function showAccountPanel() {
  const panel = document.getElementById("acct-panel");
  const prompt = document.getElementById("signin-prompt");
  if (panel) panel.style.display = "";
  if (prompt) prompt.style.display = "none";
}

function showSigninPrompt() {
  const panel = document.getElementById("acct-panel");
  const prompt = document.getElementById("signin-prompt");
  if (panel) panel.style.display = "none";
  if (prompt) prompt.style.display = "";
}

// --------------------------------------------------------------------------
// Wire the sign-out button.
// --------------------------------------------------------------------------
function wireSignOut() {
  const btn = document.getElementById("signout-btn");
  if (btn) {
    btn.addEventListener("click", async function () {
      await supabase.auth.signOut();
      window.location.href = "signin.html";
    });
  }
}

// --------------------------------------------------------------------------
// Main init — runs on DOMContentLoaded.
// --------------------------------------------------------------------------
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", async function () {
    wireSignOut();

    if (isUnconfigured()) {
      // Developer hasn't configured Supabase yet — show a friendly note.
      const panel = document.getElementById("acct-panel");
      if (panel) {
        panel.style.display = "";
        const note = document.createElement("p");
        note.style.cssText =
          "font-size:14px;color:var(--error,#c0392b);margin:16px 0;padding:12px;background:var(--surface-2,#fafafa);border-radius:8px";
        note.textContent =
          "Account sign-in is not yet configured. Replace the placeholders in " +
          "supabase-config.js with your Supabase project URL and anon key.";
        panel.prepend(note);
      }
      const prompt = document.getElementById("signin-prompt");
      if (prompt) prompt.style.display = "none";
      return;
    }

    const { data } = await supabase.auth.getSession();

    if (data.session) {
      const email = data.session.user.email;

      // RLS scopes this query to the signed-in user's own rows automatically.
      const { data: rows } = await supabase
        .from("purchases")
        .select("*")
        .limit(1);

      const view = renderAccount(rows?.[0] ?? null, email);
      showAccountPanel();
      applyViewToDom(view);
    } else {
      showSigninPrompt();
    }
  });
}
