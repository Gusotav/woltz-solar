import {
  ESQUADRIA_LABELS,
  ESTAGIO_OBRA_LABELS,
  INVESTIMENTO_LABELS,
  STAGES,
  STATUS_LABELS,
  resolveChannel,
  type LeadTracking,
} from "@/lib/leads";

const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]),
);

/** Escapa um valor para CSV com separador ponto e vírgula. */
function escapeCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Monta o conteúdo CSV a partir de cabeçalhos e linhas. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(";"));
  return `\uFEFF${lines.join("\r\n")}`;
}

/** Dispara o download de um CSV no navegador. */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fmtNumber(value: number | null | undefined): string {
  if (value == null) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTipos(tipos: unknown): string {
  const arr = Array.isArray(tipos) ? tipos : tipos ? [tipos] : [];
  return arr.map((t) => ESQUADRIA_LABELS[String(t)] ?? String(t)).join(", ");
}

export type ExportableLead = LeadTracking & {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  cidade?: string | null;
  tipo_esquadria?: string[] | null;
  estagio_obra?: string | null;
  investimento?: string | null;
  investimento_valor?: number | null;
  mensagem?: string | null;
  stage: string;
  status: string;
  quality_score?: number | null;
  motivo_perda?: string | null;
  responsavel_id?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  landing_page?: string | null;
  created_at: string;
  fechado_em?: string | null;
  updated_at?: string | null;
};

const HEADERS = [
  "Nome",
  "Telefone",
  "E-mail",
  "Cidade",
  "Tipo de esquadria",
  "Estágio da obra",
  "Faixa de investimento",
  "Valor do projeto",
  "Mensagem",
  "Etapa do funil",
  "Status",
  "Qualidade",
  "Motivo da perda",
  "Responsável",
  "Canal",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "wbraid",
  "gbraid",
  "Referrer",
  "Landing page",
  "Criado em",
  "Fechado em",
  "Atualizado em",
  "ID",
];

/** Gera o CSV completo dos leads informados. */
export function leadsToCsv(
  leads: ExportableLead[],
  responsavelNome: (id: string | null | undefined) => string,
): string {
  const rows = leads.map((l) => [
    l.nome,
    l.telefone,
    l.email ?? "",
    l.cidade ?? "",
    fmtTipos(l.tipo_esquadria),
    l.estagio_obra ? (ESTAGIO_OBRA_LABELS[l.estagio_obra] ?? l.estagio_obra) : "",
    l.investimento ? (INVESTIMENTO_LABELS[l.investimento] ?? l.investimento) : "",
    fmtNumber(l.investimento_valor),
    l.mensagem ?? "",
    STAGE_LABELS[l.stage] ?? l.stage,
    STATUS_LABELS[l.status] ?? l.status,
    l.quality_score ?? "",
    l.motivo_perda ?? "",
    responsavelNome(l.responsavel_id),
    resolveChannel(l),
    l.utm_source ?? "",
    l.utm_medium ?? "",
    l.utm_campaign ?? "",
    l.utm_term ?? "",
    l.utm_content ?? "",
    l.gclid ?? "",
    l.wbraid ?? "",
    l.gbraid ?? "",
    l.referrer ?? "",
    l.landing_page ?? "",
    fmtDate(l.created_at),
    fmtDate(l.fechado_em),
    fmtDate(l.updated_at),
    l.id,
  ]);
  return toCsv(HEADERS, rows);
}
