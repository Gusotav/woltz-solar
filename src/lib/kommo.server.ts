// Server-only helper for the Kommo CRM API.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE_URL = "https://woltzsolar.kommo.com/api/v4";

export const KOMMO_PIPELINE_ID = 11656355;
export const KOMMO_STATUS_ID = 89559675;

/** field_key -> nome do campo personalizado no Kommo */
export const KOMMO_FIELDS: Record<string, string> = {
  telefone: "WhatsApp (site)",
  email: "E-mail (site)",
  cidade: "Cidade (site)",
  tipo_imovel: "Tipo de imóvel",
  conta_luz: "Faixa da conta de luz",
  utm_source: "utm_source",
  utm_medium: "utm_medium",
  utm_campaign: "utm_campaign",
  utm_term: "utm_term",
  utm_content: "utm_content",
  gclid: "gclid",
  fbclid: "fbclid",
  gad_source: "gad_source",
  gbraid: "gbraid",
  wbraid: "wbraid",
  referrer: "referrer",
  landing_page: "landing_page",
};

let cachedMap: Record<string, number> | null = null;

function token(): string {
  const t = process.env["KOMMO_LONG_LIVED_TOKEN"];
  if (!t) throw new Error("KOMMO_LONG_LIVED_TOKEN ausente");
  return t;
}

async function kommoFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[Kommo] ${init?.method ?? "GET"} ${path} falhou [${res.status}]: ${body}`);
    throw new Error(`Kommo ${res.status}: ${body}`);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

type KommoCustomField = { id: number; name: string; type?: string };

async function loadStoredMap(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.from("kommo_field_map").select("field_key, field_id");
  if (error) {
    console.error("[Kommo] erro lendo kommo_field_map", error);
    return {};
  }
  const map: Record<string, number> = {};
  for (const row of data ?? []) map[row.field_key] = Number(row.field_id);
  return map;
}

export async function ensureFields(): Promise<Record<string, number>> {
  if (cachedMap && Object.keys(KOMMO_FIELDS).every((k) => cachedMap![k])) {
    return cachedMap;
  }

  const map = await loadStoredMap();
  const missingKeys = Object.keys(KOMMO_FIELDS).filter((k) => !map[k]);

  if (missingKeys.length > 0) {
    // Campos já existentes na conta (paginado)
    const existing = new Map<string, number>();
    for (let page = 1; page <= 10; page++) {
      const res = (await kommoFetch(`/leads/custom_fields?page=${page}&limit=250`)) as {
        _embedded?: { custom_fields?: KommoCustomField[] };
      } | null;
      const fields = res?._embedded?.custom_fields ?? [];
      for (const f of fields) existing.set(f.name.trim().toLowerCase(), f.id);
      if (fields.length < 250) break;
    }

    const toCreate: { name: string; type: string }[] = [];
    for (const key of missingKeys) {
      const name = KOMMO_FIELDS[key]!;
      const found = existing.get(name.trim().toLowerCase());
      if (found) map[key] = found;
      else toCreate.push({ name, type: "text" });
    }

    if (toCreate.length > 0) {
      const created = (await kommoFetch("/leads/custom_fields", {
        method: "POST",
        body: JSON.stringify(toCreate),
      })) as { _embedded?: { custom_fields?: KommoCustomField[] } } | null;
      for (const f of created?._embedded?.custom_fields ?? []) {
        const key = Object.keys(KOMMO_FIELDS).find(
          (k) => KOMMO_FIELDS[k]!.trim().toLowerCase() === f.name.trim().toLowerCase(),
        );
        if (key) map[key] = f.id;
      }
    }

    const rows = Object.entries(map).map(([field_key, field_id]) => ({ field_key, field_id }));
    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from("kommo_field_map").upsert(rows, { onConflict: "field_key" });
      if (error) console.error("[Kommo] erro salvando kommo_field_map", error);
    }
  }

  cachedMap = map;
  return map;
}

export type KommoLeadPayload = {
  nome: string;
  values: Record<string, string | null | undefined>;
};

export async function createKommoLead(payload: KommoLeadPayload): Promise<number> {
  const map = await ensureFields();

  const custom_fields_values = Object.entries(payload.values)
    .filter(([key, value]) => Boolean(map[key]) && value != null && value !== "")
    .map(([key, value]) => ({
      field_id: map[key]!,
      values: [{ value: String(value) }],
    }));

  const res = (await kommoFetch("/leads/complex", {
    method: "POST",
    body: JSON.stringify([
      {
        name: `${payload.nome}`,
        pipeline_id: KOMMO_PIPELINE_ID,
        status_id: KOMMO_STATUS_ID,
        custom_fields_values,
      },
    ]),
  })) as Array<{ id: number }> | null;

  const id = res?.[0]?.id;
  if (!id) throw new Error(`Kommo não retornou o id do lead: ${JSON.stringify(res)}`);
  return id;
}
