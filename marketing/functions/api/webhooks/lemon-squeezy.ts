import { PostgrestError } from "@supabase/supabase-js";

import { Env, makeServiceClient } from "../../_lib/supabase";
import { verifySignature } from "../../_lib/verify-signature";

const HANDLED_EVENTS = new Set(["order_created", "order_refunded", "license_key_created"]);

interface OrderAttributes {
  user_email: string;
  user_name: string;
  total: string;
  status?: string;
  refunded_at?: string;
  first_order_item?: { product_name?: string };
}

interface LicenseKeyAttributes {
  order_id?: number;
  user_email: string;
  key: string;
}

interface OrderPayload {
  meta: { event_name: "order_created" | "order_refunded" };
  data: { type: "orders"; id: string; attributes: OrderAttributes };
}

interface LicenseKeyPayload {
  meta: { event_name: "license_key_created" };
  data: { type: "license-keys"; id: string; attributes: LicenseKeyAttributes };
}

type LSPayload = OrderPayload | LicenseKeyPayload;

function extractOrderRow(p: OrderPayload) {
  const a = p.data.attributes;
  return { email: a.user_email, order_id: p.data.id, license_key: null as string | null,
    product_name: a.first_order_item?.product_name ?? null, user_name: a.user_name,
    total: a.total, status: a.status ?? null };
}

function extractRefundRow(p: OrderPayload) {
  const a = p.data.attributes;
  return { email: a.user_email, order_id: p.data.id, user_name: a.user_name,
    total: a.total, status: "refunded" as const, refunded_at: a.refunded_at ?? null };
}

function extractLicenseRow(p: LicenseKeyPayload) {
  const a = p.data.attributes;
  return { order_id: String(a.order_id), email: a.user_email, license_key: a.key };
}

function resolveOrderId(payload: LSPayload): string | null {
  if (payload.data.type === "license-keys") {
    const raw = (payload as LicenseKeyPayload).data.attributes.order_id;
    return raw != null ? String(raw) : null;
  }
  const raw = (payload as OrderPayload).data.id;
  return raw != null && raw !== "" ? raw : null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const raw = await context.request.text();
  const valid = await verifySignature(
    raw, context.request.headers.get("X-Signature"), context.env.LEMON_SQUEEZY_SIGNING_SECRET,
  );
  if (!valid) return new Response("Unauthorized", { status: 401 });

  const payload = JSON.parse(raw) as LSPayload;
  const eventName = payload.meta.event_name;
  if (!HANDLED_EVENTS.has(eventName)) return new Response(null, { status: 200 });

  const orderId = resolveOrderId(payload);
  if (!orderId) return new Response("Bad Request", { status: 400 });

  const db = makeServiceClient(context.env);

  let upsertRow: Record<string, unknown>;
  if (eventName === "order_created") upsertRow = extractOrderRow(payload as OrderPayload);
  else if (eventName === "order_refunded") upsertRow = extractRefundRow(payload as OrderPayload);
  else upsertRow = extractLicenseRow(payload as LicenseKeyPayload);

  const { error: upsertError } = await db.from("purchases")
    .upsert(upsertRow, { onConflict: "order_id" }).select().single();
  if (upsertError) return new Response("Internal Server Error", { status: 500 });

  const { error: ledgerError } = await db
    .from("webhook_events").insert({ event_name: eventName, order_id: orderId });
  const ledgerCode = (ledgerError as PostgrestError | null)?.code;
  if (ledgerCode === "23505") return new Response(null, { status: 200 });
  if (ledgerError) return new Response("Internal Server Error", { status: 500 });
  return new Response(null, { status: 200 });
};
