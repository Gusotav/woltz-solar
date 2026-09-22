import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Handshake,
  Leaf,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Wallet,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackWebEvent } from "@/lib/fbpixel";
import { trackLeadConversion } from "@/lib/googleAds";
import { submitLead } from "@/lib/leads.functions";
import logoAsset from "@/assets/woltz-logo.png.asset.json";
import comercialAsset from "@/assets/woltz-comercial.jpg.asset.json";
import equipeAsset from "@/assets/woltz-equipe.jpg.asset.json";
import paineisAsset from "@/assets/woltz-paineis.jpg.asset.json";
import residencialAsset from "@/assets/woltz-residencial.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Woltz Solar | Energia solar em Guaíba e região" },
      {
        name: "description",
        content:
          "Energia solar residencial, comercial e rural em Guaíba e região. Financie seu kit solar com taxa a partir de 0,99% ao mês.",
      },
      { property: "og:title", content: "Woltz Solar | Energia solar em Guaíba e região" },
      {
        property: "og:description",
        content:
          "Projeto, instalação e homologação de energia solar com financiamento em até 72 vezes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const faixasConta = [
  "Até R$ 300",
  "R$ 300 a R$ 600",
  "R$ 600 a R$ 1.000",
  "R$ 1.000 a R$ 2.000",
  "Acima de R$ 2.000",
];

const depoimentos = [
  {
    nome: "Carlos Menezes",
    local: "Residência em Guaíba, RS",
    texto:
      "A equipe cuidou de todo o projeto e da homologação. Foi um atendimento próximo, claro e muito tranquilo do início ao fim.",
  },
  {
    nome: "Fernanda Ribeiro",
    local: "Comércio na região de Guaíba, RS",
    texto:
      "A instalação foi organizada e hoje conseguimos acompanhar a geração do sistema com facilidade. A diferença na conta é muito boa.",
  },
  {
    nome: "João Paulo Aguiar",
    local: "Propriedade rural na região de Guaíba, RS",
    texto:
      "Escolhemos a Woltz pela confiança no atendimento. O projeto ficou adequado à rotina da propriedade e tudo foi bem explicado.",
  },
];

const TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "gad_source",
  "gbraid",
  "wbraid",
] as const;

type Tracking = Record<(typeof TRACKING_KEYS)[number], string | null> & {
  referrer: string | null;
  landing_page: string | null;
};

const TRACKING_STORAGE_KEY = "woltz_tracking";

function emptyTracking(): Tracking {
  const base = {} as Tracking;
  for (const key of TRACKING_KEYS) base[key] = null;
  base.referrer = null;
  base.landing_page = null;
  return base;
}

function getTracking(): Tracking {
  if (typeof window === "undefined") return emptyTracking();

  let stored: Partial<Tracking> = {};
  try {
    const raw = window.sessionStorage.getItem(TRACKING_STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as Partial<Tracking>;
  } catch {
    stored = {};
  }

  const params = new URLSearchParams(window.location.search);
  const tracking = emptyTracking();
  for (const key of TRACKING_KEYS) {
    const fromUrl = params.get(key);
    tracking[key] = (fromUrl || stored[key] || null)?.slice(0, 255) ?? null;
  }
  tracking.referrer =
    (stored.referrer || document.referrer || null)?.slice(0, 500) ?? null;
  tracking.landing_page =
    (stored.landing_page || window.location.pathname + window.location.search || null)?.slice(
      0,
      500,
    ) ?? null;

  if (!tracking.utm_source) {
    if (tracking.gclid || tracking.gad_source || tracking.gbraid || tracking.wbraid) {
      tracking.utm_source = "google";
      tracking.utm_medium = tracking.utm_medium || "cpc";
    } else {
      let referrerHost: string | null = null;
      try {
        if (tracking.referrer) {
          const host = new URL(tracking.referrer).hostname;
          if (host && host !== window.location.hostname) referrerHost = host;
        }
      } catch {
        referrerHost = null;
      }

      if (referrerHost) {
        tracking.utm_source = referrerHost.slice(0, 255);
        tracking.utm_medium = tracking.utm_medium || "referral";
      } else {
        tracking.utm_source = "direct";
        tracking.utm_medium = tracking.utm_medium || "none";
      }
    }
  }

  try {
    window.sessionStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(tracking));
  } catch {
    // A captura continua funcionando quando o armazenamento está indisponível.
  }

  return tracking;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function anchorProps(id: string) {
  return {
    href: `#${id}`,
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    },
  };
}

function LeadForm({ compact = false }: { compact?: boolean }) {
  const [form, setForm] = useState({
    nome: "",
    whatsapp: "",
    email: "",
    cidade: "",
    tipo: "Residencial",
    conta: "",
  });
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enviarLead = useServerFn(submitLead);

  const set = (campo: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [campo]: event.target.value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.nome.trim() || !form.whatsapp.trim() || !form.conta) {
      toast.error("Preencha nome, WhatsApp e o valor da conta de luz.");
      return;
    }
    if (form.whatsapp.replace(/\D/g, "").length < 10) {
      toast.error("Informe um WhatsApp válido com DDD.");
      return;
    }

    setEnviando(true);
    const tracking = getTracking();
    let resultado: Awaited<ReturnType<typeof enviarLead>>;
    try {
      resultado = await enviarLead({
        data: {
          nome: form.nome.trim().slice(0, 120),
          telefone: form.whatsapp.trim().slice(0, 20),
          email: form.email.trim().slice(0, 255) || null,
          cidade: form.cidade.trim().slice(0, 120) || null,
          tipo_imovel: form.tipo,
          conta_luz: form.conta,
          ...tracking,
        },
      });
    } catch (error) {
      console.error("Erro ao salvar lead", error);
      toast.error("Não conseguimos enviar agora. Tente novamente em instantes.");
      return;
    } finally {
      setEnviando(false);
    }

    if (!resultado?.kommoLeadId) {
      toast.error("Não conseguimos enviar agora. Tente novamente em instantes.");
      return;
    }

    void trackLeadConversion({
      email: form.email.trim() || null,
      phone: form.whatsapp,
      name: form.nome,
      transactionId: resultado.id,
    });

    const nameParts = form.nome.trim().split(/\s+/).filter(Boolean);
    void trackWebEvent(
      "Lead",
      { content_name: "form_contato", content_category: "lead_form" },
      {
        email: form.email.trim() || null,
        phone: form.whatsapp,
        first_name: nameParts[0] ?? null,
        last_name: nameParts.slice(1).join(" ") || null,
        city: form.cidade.trim() || null,
      },
      resultado.id,
    );

    setEnviado(true);
    toast.success("Recebido! Nossa equipe entrará em contato.");
  }

  if (enviado) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <BadgeCheck className="h-8 w-8" />
        </span>
        <h3 className="mt-6 text-3xl font-bold">Recebemos seus dados</h3>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Um especialista Woltz Solar vai chamar você no WhatsApp para preparar sua simulação.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-input bg-background/70 px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20";

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Simulação gratuita</p>
          <h2 className="mt-1 text-2xl font-bold">Veja quanto pode economizar</h2>
        </div>
        <Sun className="mt-1 h-7 w-7 shrink-0 text-primary" />
      </div>

      <div>
        <label htmlFor={compact ? "hero-nome" : "nome"} className="mb-1.5 block text-xs font-semibold">
          Nome completo *
        </label>
        <input
          id={compact ? "hero-nome" : "nome"}
          type="text"
          required
          maxLength={100}
          value={form.nome}
          onChange={set("nome")}
          placeholder="Seu nome"
          autoComplete="name"
          className={inputClass}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={compact ? "hero-whatsapp" : "whatsapp"} className="mb-1.5 block text-xs font-semibold">
            WhatsApp *
          </label>
          <input
            id={compact ? "hero-whatsapp" : "whatsapp"}
            type="tel"
            required
            maxLength={15}
            inputMode="tel"
            autoComplete="tel"
            value={form.whatsapp}
            onChange={(event) =>
              setForm((current) => ({ ...current, whatsapp: maskPhone(event.target.value) }))
            }
            placeholder="(51) 99999-9999"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={compact ? "hero-email" : "email"} className="mb-1.5 block text-xs font-semibold">
            E-mail
          </label>
          <input
            id={compact ? "hero-email" : "email"}
            type="email"
            maxLength={255}
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            placeholder="voce@email.com"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={compact ? "hero-cidade" : "cidade"} className="mb-1.5 block text-xs font-semibold">
            Cidade
          </label>
          <input
            id={compact ? "hero-cidade" : "cidade"}
            type="text"
            maxLength={80}
            value={form.cidade}
            onChange={set("cidade")}
            placeholder="Guaíba, RS"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={compact ? "hero-tipo" : "tipo"} className="mb-1.5 block text-xs font-semibold">
            Tipo de imóvel
          </label>
          <select
            id={compact ? "hero-tipo" : "tipo"}
            value={form.tipo}
            onChange={set("tipo")}
            className={inputClass}
          >
            <option>Residencial</option>
            <option>Comercial</option>
            <option>Rural</option>
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 block text-xs font-semibold">Valor médio da conta de luz *</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {faixasConta.map((faixa) => (
            <Button
              type="button"
              variant={form.conta === faixa ? "default" : "outline"}
              key={faixa}
              onClick={() => setForm((current) => ({ ...current, conta: faixa }))}
              className="h-auto min-h-10 whitespace-normal px-2 py-2 text-xs"
            >
              {faixa}
            </Button>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={enviando} size="lg" className="h-12 w-full font-bold">
        <Zap />
        {enviando ? "Enviando..." : "Quero minha simulação"}
      </Button>
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        Ao enviar, você concorda com a nossa{" "}
        <Link to="/privacidade" className="underline hover:text-primary">
          política de privacidade
        </Link>
        .
      </p>
    </form>
  );
}

function Index() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="absolute inset-x-0 top-0 z-30 border-b border-border/60 bg-background/65 backdrop-blur-lg">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <img src={logoAsset.url} alt="Woltz Solar" className="h-10 w-auto" />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a {...anchorProps("projetos")} className="transition-colors hover:text-foreground">Projetos</a>
            <a {...anchorProps("financiamento")} className="transition-colors hover:text-foreground">Financiamento</a>
            <a {...anchorProps("depoimentos")} className="transition-colors hover:text-foreground">Clientes</a>
          </nav>
          <Button asChild size="lg" className="hidden sm:inline-flex">
            <a {...anchorProps("proposta")}>Simular agora <ArrowRight /></a>
          </Button>
        </div>
      </header>

      <section className="relative min-h-[920px] pt-20 lg:min-h-[760px]">
        <img
          src={residencialAsset.url}
          alt="Projeto residencial da Woltz Solar em Guaíba"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-hero-shade" />
        <div className="relative mx-auto grid min-h-[840px] max-w-7xl items-center gap-10 px-5 py-14 lg:min-h-[680px] lg:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.65fr)] lg:px-8">
          <div className="max-w-3xl self-end pb-4 lg:self-center lg:pb-0">
            <p className="flex items-center gap-2 text-xs font-bold uppercase text-primary">
              <span className="h-px w-10 bg-primary" /> Energia solar em Guaíba e região
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-bold leading-[0.98] sm:text-6xl lg:text-7xl">
              Financie o seu kit solar com taxa a partir de <span className="text-primary">0,99%</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-foreground/80 sm:text-lg">
              Projeto, instalação e homologação feitos por uma equipe próxima, que conhece a região e acompanha cada etapa.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-t border-foreground/25 pt-6">
              <div><strong className="block text-2xl text-primary">15 anos</strong><span className="text-xs text-foreground/70">de garantia dos painéis</span></div>
              <div><strong className="block text-2xl text-primary">10 anos</strong><span className="text-xs text-foreground/70">de garantia dos inversores</span></div>
              <div><strong className="block text-2xl text-primary">72x</strong><span className="text-xs text-foreground/70">para financiar</span></div>
            </div>
          </div>

          <div id="proposta" className="self-center border border-border bg-card/95 p-5 shadow-editorial backdrop-blur-md sm:p-7">
            <LeadForm compact />
          </div>
        </div>
        <a {...anchorProps("projetos")} aria-label="Ver projetos" className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 text-foreground/70 transition-colors hover:text-primary lg:block">
          <ArrowDownRight className="h-7 w-7" />
        </a>
      </section>

      <section className="border-y border-border bg-surface-soft">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-3 lg:px-8">
          {[
            [Sun, "Energia produzida no seu telhado", "Seu imóvel passa a gerar boa parte da energia que consome todos os dias."],
            [ShieldCheck, "Tudo cuidado pela Woltz", "Do dimensionamento à homologação, nossa equipe acompanha o projeto inteiro."],
            [Leaf, "Economia que fica com você", "Menos peso da conta de luz e um imóvel preparado para o futuro."],
          ].map(([Icon, title, text], index) => {
            const FeatureIcon = Icon as typeof Sun;
            return (
              <article key={String(title)} className="border-l border-border pl-6">
                <span className="text-xs font-bold text-primary">0{index + 1}</span>
                <FeatureIcon className="mt-5 h-7 w-7 text-primary" />
                <h2 className="mt-4 text-xl font-bold">{String(title)}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{String(text)}</p>
              </article>
            );
          })}
        </div>
        <div className="pb-14 text-center">
          <Button asChild size="lg"><a {...anchorProps("proposta")}>Quero começar a economizar <ArrowRight /></a></Button>
        </div>
      </section>

      <section id="projetos" className="bg-paper text-ink">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="grid items-end gap-8 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase text-primary">Trabalho de verdade</p>
            <h2 className="mt-4 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">Projetos feitos perto de você</h2>
          </div>
          <p className="max-w-lg text-base leading-relaxed text-ink-muted lg:justify-self-end">
            Instalações reais da Woltz Solar em residências, comércios e propriedades rurais da região.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-12 lg:grid-rows-2">
          <figure className="group relative min-h-[520px] overflow-hidden lg:col-span-7 lg:row-span-2">
            <img src={paineisAsset.url} alt="Painéis solares pretos instalados pela Woltz Solar" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-photo-caption p-7 text-foreground">
              <p className="text-xs font-bold uppercase text-primary">Residencial</p>
              <h3 className="mt-2 text-2xl font-bold">Energia gerada no próprio telhado</h3>
            </figcaption>
          </figure>
          <figure className="group relative min-h-[250px] overflow-hidden lg:col-span-5">
            <img src={comercialAsset.url} alt="Projeto comercial de energia solar da Woltz Solar" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-photo-caption p-6 text-foreground">
              <p className="text-xs font-bold uppercase text-primary">Comercial</p>
              <h3 className="mt-1 text-xl font-bold">Mais previsibilidade para o negócio</h3>
            </figcaption>
          </figure>
          <figure className="group relative min-h-[250px] overflow-hidden lg:col-span-5">
            <img src={equipeAsset.url} alt="Veículo da equipe Woltz Solar na região de atendimento" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-photo-caption p-6 text-foreground">
              <p className="text-xs font-bold uppercase text-primary">Rural</p>
              <h3 className="mt-1 text-xl font-bold">Atendimento onde o cliente está</h3>
            </figcaption>
          </figure>
        </div>
        <div className="mt-10 text-center"><Button asChild size="lg"><a {...anchorProps("proposta")}>Quero um projeto Woltz <ArrowRight /></a></Button></div>
        </div>
      </section>

      <section id="financiamento" className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-bold uppercase">Condição especial</p>
              <p className="mt-5 text-lg font-bold">a partir de</p>
              <p className="mt-1 text-7xl font-bold leading-none sm:text-8xl">0,99%</p>
              <p className="mt-2 text-lg font-bold">ao mês</p>
            </div>
            <div>
              <h2 className="text-4xl font-bold leading-tight sm:text-5xl">Financie seu sistema de energia solar</h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-primary-foreground/75">
                A Woltz Solar fecha com a CAIXA uma condição especial para você levar economia solar para casa.
              </p>
            </div>
          </div>

          <div className="mt-16 grid border-y border-primary-foreground/25 md:grid-cols-3">
            {[
              [CalendarDays, "Em até 72x", "Parcelas planejadas para caber no orçamento."],
              [Handshake, "Parceria com a CAIXA", "Uma condição especial para o seu projeto."],
              [ShieldCheck, "Garantia de qualidade", "Equipamentos e instalação com segurança."],
            ].map(([Icon, title, text]) => {
              const FinanceIcon = Icon as typeof Wallet;
              return (
                <article key={String(title)} className="border-b border-primary-foreground/25 p-7 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                  <FinanceIcon className="h-7 w-7" />
                  <h3 className="mt-8 text-xl font-bold">{String(title)}</h3>
                  <p className="mt-2 text-sm text-primary-foreground/70">{String(text)}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg" variant="secondary"><a {...anchorProps("proposta")}>Faça uma simulação gratuita agora <ArrowRight /></a></Button>
          </div>
        </div>
      </section>

      <section id="depoimentos" className="bg-paper-soft text-ink">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="grid gap-14 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-xs font-bold uppercase text-primary">Quem escolheu a Woltz</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">A confiança começa no atendimento</h2>
            <div className="mt-6 flex gap-1" aria-label="Cinco estrelas">
              {Array.from({ length: 5 }).map((_, index) => <Star key={index} className="h-5 w-5 fill-primary text-primary" />)}
            </div>
          </div>
          <div className="divide-y divide-paper border-y border-paper">
            {depoimentos.map((depoimento, index) => (
              <figure key={depoimento.nome} className="grid gap-5 py-8 sm:grid-cols-[48px_1fr]">
                <span className="text-3xl font-bold text-primary">0{index + 1}</span>
                <div>
                  <blockquote className="text-lg leading-relaxed text-ink">“{depoimento.texto}”</blockquote>
                  <figcaption className="mt-5 text-sm"><strong>{depoimento.nome}</strong><span className="ml-2 text-ink-muted">{depoimento.local}</span></figcaption>
                </div>
              </figure>
            ))}
          </div>
        </div>
        <div className="mt-10 text-center"><Button asChild size="lg"><a {...anchorProps("proposta")}>Quero economia como esses clientes <ArrowRight /></a></Button></div>
        </div>
      </section>

      <section id="areas" className="relative overflow-hidden border-y border-border bg-surface-soft">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 lg:block">
          <img src={residencialAsset.url} alt="Instalação solar Woltz em Guaíba" loading="lazy" className="h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-area-shade" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <MapPin className="h-8 w-8 text-primary" />
          <p className="mt-8 text-xs font-bold uppercase text-primary">Área de atendimento</p>
          <h2 className="mt-4 max-w-xl text-5xl font-bold leading-tight sm:text-6xl">Guaíba, RS e região</h2>
          <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
            Atendimento próximo, visita técnica local e acompanhamento em todas as etapas do seu projeto.
          </p>
          <Button asChild size="lg" className="mt-8"><a {...anchorProps("proposta")}>Consultar atendimento <ArrowRight /></a></Button>
        </div>
      </section>

      <section className="bg-paper text-ink">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Seu próximo passo</p>
          <h2 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">Comece a produzir sua própria energia</h2>
          <ul className="mt-8 space-y-4 text-sm text-ink-muted">
            {[
              "Simulação baseada no valor da sua conta",
              "Visita técnica para avaliar o imóvel",
              "Projeto completo e homologado",
            ].map((item) => <li key={item} className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-primary" />{item}</li>)}
          </ul>
        </div>
        <div className="border border-border bg-card p-6 shadow-editorial sm:p-8"><LeadForm /></div>
        </div>
      </section>

      <footer className="border-t border-border bg-surface-soft">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:grid-cols-2 sm:items-end lg:px-8">
          <div>
            <img src={logoAsset.url} alt="Woltz Solar" className="h-11 w-auto" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">Energia solar residencial, comercial e rural em Guaíba e região.</p>
          </div>
          <div className="sm:text-right">
            <Link to="/privacidade" className="text-sm text-muted-foreground underline hover:text-primary">Política de privacidade</Link>
            <p className="mt-4 text-xs text-muted-foreground">© {new Date().getFullYear()} Woltz Solar. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}