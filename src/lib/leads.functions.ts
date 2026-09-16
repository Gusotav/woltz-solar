import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const leadSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  telefone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Telefone inválido"),
  email: optionalText(255),
  cidade: optionalText(120),
  tipo_imovel: optionalText(80),
  conta_luz: optionalText(80),
  utm_source: optionalText(255),
  utm_medium: optionalText(255),
  utm_campaign: optionalText(255),
  utm_term: optionalText(255),
  utm_content: optionalText(255),
  gclid: optionalText(255),
  fbclid: optionalText(255),
  referrer: optionalText(500),
  landing_page: optionalText(500),
});

export type LeadInput = z.input<typeof leadSchema>;

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((data: LeadInput) => leadSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inserted, error } = await supabaseAdmin
      .from("leads")
      .insert(data)
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("[leads] erro ao gravar lead", error);
      throw new Error("Não foi possível salvar o lead");
    }

    try {
      const { createKommoLead } = await import("./kommo.server");
      const kommoLeadId = await createKommoLead({
        nome: data.nome,
        values: {
          telefone: data.telefone,
          email: data.email,
          cidade: data.cidade,
          tipo_imovel: data.tipo_imovel,
          conta_luz: data.conta_luz,
          utm_source: data.utm_source,
          utm_medium: data.utm_medium,
          utm_campaign: data.utm_campaign,
          utm_term: data.utm_term,
          utm_content: data.utm_content,
          gclid: data.gclid,
          fbclid: data.fbclid,
          referrer: data.referrer,
          landing_page: data.landing_page,
        },
      });

      await supabaseAdmin
        .from("leads")
        .update({
          kommo_lead_id: kommoLeadId,
          kommo_status: "enviado",
          kommo_sent_at: new Date().toISOString(),
          kommo_error: null,
        })
        .eq("id", inserted.id);

      return { ok: true as const, id: inserted.id, kommoLeadId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[leads] falha ao enviar para o Kommo", message);
      await supabaseAdmin
        .from("leads")
        .update({ kommo_status: "erro", kommo_error: message.slice(0, 2000) })
        .eq("id", inserted.id);

      // O lead ficou salvo no banco; o visitante segue com a confirmação normal.
      return { ok: true as const, id: inserted.id, kommoLeadId: null };
    }
  });
