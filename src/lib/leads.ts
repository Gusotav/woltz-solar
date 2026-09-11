/** Aplica máscara de telefone brasileiro no formato (XX) XXXXX-XXXX ou (XX) XXXX-XXXX. */
export function maskPhone(value: string): string {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const ESQUADRIA_LABELS: Record<string, string> = {
  residencial: "Residência",
  comercial: "Comércio / Empresa",
  industrial: "Indústria",
  rural: "Propriedade rural",
  outro: "Outro",
};

export const TIPO_OPTIONS = ["residencial", "comercial", "industrial", "rural", "outro"];

export function formatTipos(tipos: string[] | string | null | undefined): string {
  if (!tipos) return "—";
  const arr = Array.isArray(tipos) ? tipos : [tipos];
  if (arr.length === 0) return "—";
  return arr.map((t) => ESQUADRIA_LABELS[t] ?? t).join(", ");
}

export const INVESTIMENTO_LABELS: Record<string, string> = {
  ate_5k: "Até R$ 5 mil",
  "5k_15k": "R$ 5 mil – R$ 15 mil",
  "15k_30k": "R$ 15 mil – R$ 30 mil",
  "30k_50k": "R$ 30 mil – R$ 50 mil",
  acima_50k: "Acima de R$ 50 mil",
};

export const INVESTIMENTO_VALOR_MEDIO: Record<string, number> = {
  ate_5k: 3500,
  "5k_15k": 10000,
  "15k_30k": 22500,
  "30k_50k": 40000,
  acima_50k: 70000,
};

export const STAGES = [
  { key: "novos", label: "Novos leads" },
  { key: "primeiro_contato", label: "Primeiro contato" },
  { key: "atendimento", label: "Em atendimento" },
  { key: "orcamento", label: "Em orçamento" },
  { key: "vendas", label: "Vendas" },
] as const;


export const STATUS_LABELS: Record<string, string> = {
  aberto: "Aberto",
  ganho: "Ganho",
  abandonado: "Perdido",
};

export const ESTAGIO_OBRA_OPTIONS = [
  { key: "planejamento", label: "Estamos no planejamento da obra" },
  { key: "execucao", label: "Em execução" },
  { key: "finalizacao", label: "Finalizando a obra" },
] as const;

export const ESTAGIO_OBRA_LABELS: Record<string, string> =
  Object.fromEntries(ESTAGIO_OBRA_OPTIONS.map((o) => [o.key, o.label]));

export type Stage = (typeof STAGES)[number]["key"];

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export function readUtmsFromUrl(): Record<string, string | null> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, string | null> = {};
  for (const k of UTM_KEYS) out[k] = params.get(k);
  return out;
}

export function channelLabel(utmSource: string | null | undefined): string {
  if (!utmSource) return "Direto / Orgânico";
  const s = utmSource.toLowerCase();
  if (s.includes("manual")) return "Cadastro manual";
  if (s.includes("google")) return "Google";
  if (s.includes("meta") || s.includes("facebook") || s.includes("instagram")) return "Meta";
  if (s.includes("tiktok")) return "TikTok";
  if (s.includes("linkedin")) return "LinkedIn";
  if (s.includes("youtube")) return "YouTube";
  if (s.includes("bing")) return "Bing";
  if (s.includes("whatsapp") || s === "wa") return "WhatsApp";
  return utmSource;
}

export type LeadTracking = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  gclid?: string | null;
  wbraid?: string | null;
  gbraid?: string | null;
  referrer?: string | null;
};

/** Reconhece o canal do lead a partir de UTMs, click ids e referrer. */
export function resolveChannel(lead: LeadTracking): string {
  if (lead.gclid || lead.wbraid || lead.gbraid) return "Google Ads";
  if (lead.utm_source) {
    const label = channelLabel(lead.utm_source);
    const medium = (lead.utm_medium ?? "").toLowerCase();
    if (label === "Google" && (medium.includes("cpc") || medium.includes("paid"))) {
      return "Google Ads";
    }
    if (label === "Meta" && (medium.includes("cpc") || medium.includes("paid"))) {
      return "Meta Ads";
    }
    return label;
  }
  const ref = (lead.referrer ?? "").toLowerCase();
  if (ref) {
    if (ref.includes("google")) return "Google";
    if (ref.includes("facebook") || ref.includes("instagram")) return "Meta";
    if (ref.includes("tiktok")) return "TikTok";
    if (ref.includes("bing")) return "Bing";
    if (ref.includes("linkedin")) return "LinkedIn";
    if (ref.includes("youtube")) return "YouTube";
    if (ref.includes("whatsapp") || ref.includes("wa.me")) return "WhatsApp";
    return "Referência";
  }
  return "Direto / Orgânico";
}

/** Texto completo das UTMs para exibição no detalhe do lead. */
export function utmSummary(lead: LeadTracking & { utm_term?: string | null; utm_content?: string | null }) {
  const rows: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value) rows.push({ label, value });
  };
  push("Origem (utm_source)", lead.utm_source);
  push("Mídia (utm_medium)", lead.utm_medium);
  push("Campanha (utm_campaign)", lead.utm_campaign);
  push("Termo (utm_term)", lead.utm_term);
  push("Conteúdo (utm_content)", lead.utm_content);
  push("Google Click ID", lead.gclid ?? lead.wbraid ?? lead.gbraid);
  push("Referrer", lead.referrer);
  return rows;
}

