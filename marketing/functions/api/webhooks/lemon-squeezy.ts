import { Env, makeServiceClient } from "../../_lib/supabase";
import { verifySignature } from "../../_lib/verify-signature";

interface LSPayload {
  meta: { event_name: string };
  data: {
    id: string;
    attributes: {
      user_email: string;
      user_name: string;
      total: string;
      status?: string;
      first_order_item?: { product_name?: string; license_key?: string };
    };
  };
}

function extractRow(p: LSPayload) {
  const a = p.data.attributes;
  return {
    email: a.user_email,
    order_id: p.data.id,
    license_key: a.first_order_item?.license_key ?? null,
    product_name: a.first_order_item?.product_name ?? null,
    user_name: a.user_name,
    total: a.total,
    status: a.status ?? null,
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const raw = await context.request.text();
  const valid = await verifySignature(
    raw,
    context.request.headers.get("X-Signature"),
    context.env.LEMON_SQUEEZY_SIGNING_SECRET,
  );
  if (!valid) return new Response("Unauthorized", { status: 401 });

  const payload = JSON.parse(raw) as LSPayload;
  if (payload.meta.event_name !== "order_created") {
    return new Response(null, { status: 200 });
  }

  const db = makeServiceClient(context.env);
  const { error } = await db
    .from("purchases")
    .upsert(extractRow(payload), { onConflict: "order_id" })
    .select()
    .single();

  if (error) return new Response("Internal Server Error", { status: 500 });
  return new Response(null, { status: 200 });
};
