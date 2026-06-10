import { Env, makeServiceClient } from "../_lib/supabase";

interface HealthRow {
  id: number;
  note: string | null;
  created_at: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const db = makeServiceClient(context.env);

  const { data: inserted, error: insertErr } = await db
    .from("_health")
    .insert({ note: "heartbeat" })
    .select()
    .single<HealthRow>();

  if (insertErr || inserted === null) {
    return Response.json(
      { ok: false, error: insertErr?.message ?? "insert returned null" },
      { status: 500 }
    );
  }

  const { data: readBack, error: selectErr } = await db
    .from("_health")
    .select("*")
    .eq("id", inserted.id)
    .single<HealthRow>();

  if (selectErr || readBack === null) {
    return Response.json(
      { ok: false, error: selectErr?.message ?? "select returned null" },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, wrote: inserted.id, readBack });
};
