import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

type AdminSession = { unlocked?: boolean };

function sessionConfig() {
  return {
    password: process.env["KOMMO_DASHBOARD_SESSION_SECRET"]!,
    name: "woltz-envio-kommo",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function passwordMatches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

async function requireUnlocked() {
  const session = await useSession<AdminSession>(sessionConfig());
  if (!session.data.unlocked) throw new Error("Não autorizado");
}

export const unlockKommoDashboard = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => z.object({ password: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env["KOMMO_DASHBOARD_PASSWORD"];
    if (!expected || !passwordMatches(data.password, expected)) return { ok: false as const };
    const session = await useSession<AdminSession>(sessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockKommoDashboard = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const getKommoDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AdminSession>(sessionConfig());
  if (!session.data.unlocked) return { unlocked: false as const, leads: [] };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id, created_at, nome, telefone, email, cidade, kommo_status, kommo_lead_id, kommo_error, kommo_sent_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Falha ao carregar leads");
  return { unlocked: true as const, leads: data ?? [] };
});

async function resendOne(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: l, error } = await supabaseAdmin.from("leads").select("*").eq("id", id).single();
  if (error || !l) return { id, ok: false, error: "Lead não encontrado" };
  if (l.kommo_status === "enviado" && l.kommo_lead_id) return { id, ok: true };
  try {
    const { createKommoLead } = await import("./kommo.server");
    const kommoLeadId = await createKommoLead({
      nome: l.nome,
      values: {
        telefone: l.telefone, email: l.email, cidade: l.cidade, tipo_imovel: l.tipo_imovel,
        conta_luz: l.conta_luz, utm_source: l.utm_source, utm_medium: l.utm_medium,
        utm_campaign: l.utm_campaign, utm_term: l.utm_term, utm_content: l.utm_content,
        gclid: l.gclid, fbclid: l.fbclid, gad_source: l.gad_source, gbraid: l.gbraid,
        wbraid: l.wbraid, referrer: l.referrer, landing_page: l.landing_page,
      },
    });
    await supabaseAdmin.from("leads").update({
      kommo_lead_id: kommoLeadId, kommo_status: "enviado",
      kommo_sent_at: new Date().toISOString(), kommo_error: null,
    }).eq("id", id);
    return { id, ok: true };
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
    await supabaseAdmin.from("leads").update({ kommo_status: "erro", kommo_error: message }).eq("id", id);
    return { id, ok: false, error: message };
  }
}

export const retryKommoLeads = createServerFn({ method: "POST" })
  .inputValidator((d: { ids: string[] }) => z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const results = [];
    for (const id of data.ids) {
      results.push(await resendOne(id));
      await new Promise((r) => setTimeout(r, 300));
    }
    return { results };
  });
