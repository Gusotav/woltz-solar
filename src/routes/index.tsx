import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Zap,
  Sun,
  ShieldCheck,
  BadgeCheck,
  Star,
  
  
  MapPin,
  ArrowRight,
  TrendingDown,
  Leaf,
  Wrench,
  Wallet,
  CalendarDays,
  Handshake,
} from "lucide-react";

import { RSMap } from "@/components/RSMap";
import { useServerFn } from "@tanstack/react-start";
import { submitLead } from "@/lib/leads.functions";
import logoAsset from "@/assets/woltz-logo.png.asset.json";
import heroSolar from "@/assets/hero-solar.jpg";
import projeto1 from "@/assets/projeto-1.jpg";
import projeto2 from "@/assets/projeto-2.jpg";
import projeto3 from "@/assets/projeto-3.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Woltz Solar — Energia solar que reduz sua conta de luz" },
      {
        name: "description",
        content:
          "Reduza drasticamente a sua conta de luz com energia solar. Projetos residenciais, comerciais e rurais entregues pela Woltz Solar. Solicite uma proposta gratuita.",
      },
      { property: "og:title", content: "Woltz Solar — Energia solar que reduz sua conta de luz" },
      {
        property: "og:description",
        content:
          "Reduza drasticamente a sua conta de luz com energia solar. Solicite uma proposta gratuita da Woltz Solar.",
      },
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
    local: "Residência — Porto Alegre/RS",
    texto:
      "Minha conta caiu de R$ 780 para menos de R$ 90. A equipe da Woltz cuidou de tudo, do projeto à homologação na concessionária.",
    iniciais: "CM",
  },
  {
    nome: "Fernanda Ribeiro",
    local: "Comércio — Novo Hamburgo/RS",
    texto:
      "Instalação rápida e sem dor de cabeça. Em 4 meses o sistema já estava pago pela economia que gerou no caixa da loja.",
    iniciais: "FR",
  },
  {
    nome: "João Paulo Aguiar",
    local: "Propriedade rural — Barra do Ribeiro/RS",
    texto:
      "Colocamos energia solar na fazenda para bombear água e alimentar o galpão. Melhor investimento que já fizemos no campo.",
    iniciais: "JA",
  },
];

const projetos = [
  {
    imagem: projeto1,
    titulo: "Residencial — 8,4 kWp",
    descricao: "Casa térrea com 14 módulos. Economia estimada de 92% na fatura mensal.",
  },
  {
    imagem: projeto2,
    titulo: "Industrial — 320 kWp",
    descricao: "Usina em galpão logístico com 580 módulos e monitoramento em tempo real.",
  },
  {
    imagem: projeto3,
    titulo: "Rural — 45 kWp",
    descricao: "Sistema para bombeamento e galpão agrícola em propriedade familiar.",
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
] as const;

type Tracking = Record<(typeof TRACKING_KEYS)[number], string | null> & {
  referrer: string | null;
  landing_page: string | null;
};

const TRACKING_STORAGE_KEY = "woltz_tracking";

function emptyTracking(): Tracking {
  const base = {} as Tracking;
  for (const k of TRACKING_KEYS) base[k] = null;
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
  for (const k of TRACKING_KEYS) {
    const fromUrl = params.get(k);
    tracking[k] = (fromUrl || stored[k] || null)?.slice(0, 255) ?? null;
  }
  tracking.referrer =
    (stored.referrer || document.referrer || null)?.slice(0, 500) ?? null;
  tracking.landing_page =
    (stored.landing_page ||
      window.location.pathname + window.location.search ||
      null)?.slice(0, 500) ?? null;

  try {
    window.sessionStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(tracking));
  } catch {
    /* storage indisponível */
  }

  return tracking;
}

function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function Index() {
  const [form, setForm] = useState({
    nome: "",
    whatsapp: "",
    email: "",
    cidade: "",
    tipo: "Residência",
    conta: "",
  });
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const set = (campo: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    const { error } = await supabase.from("leads").insert({
      nome: form.nome.trim().slice(0, 120),
      telefone: form.whatsapp.trim().slice(0, 20),
      email: form.email.trim().slice(0, 255) || null,
      cidade: form.cidade.trim().slice(0, 120) || null,
      tipo_imovel: form.tipo,
      conta_luz: form.conta,
      ...tracking,
    });
    setEnviando(false);

    if (error) {
      console.error("Erro ao salvar lead", error);
      toast.error("Não conseguimos enviar agora. Tente novamente em instantes.");
      return;
    }

    setEnviado(true);
    toast.success("Recebido! Nossa equipe entra em contato em até 1 dia útil.");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <img src={logoAsset.url} alt="Woltz Solar" className="h-9 w-auto" />
          <a
            href="#proposta"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 glow-volt"
          >
            Quero economizar
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src={heroSolar}
          alt="Casa com painéis solares ao pôr do sol"
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-24 text-center md:pt-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-volt-soft px-4 py-1.5 text-sm font-medium text-primary">
            <Sun className="h-4 w-4" />
            Energia solar fotovoltaica
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Financie o seu kit solar com taxa de{" "}
            <span className="text-gradient-volt">0,99%</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            A Woltz Solar projeta, instala e homologa seu sistema de energia
            solar — você só acompanha a economia cair na fatura.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#proposta"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground transition-transform hover:scale-105 glow-volt"
            >
              Receber proposta gratuita
              <ArrowRight className="h-5 w-5" />
            </a>
            <a
              href="#projetos"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-7 py-3.5 text-base font-semibold text-secondary-foreground hover:bg-accent"
            >
              Ver projetos entregues
            </a>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-4">
            {[
              { valor: "+350", label: "projetos entregues" },
              { valor: "Economia", label: "real na sua conta de luz" },
              { valor: "25 anos", label: "de garantia dos módulos" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-card/70 p-4 backdrop-blur-sm"
              >
                <p className="font-display text-2xl font-bold text-primary md:text-3xl">
                  {s.valor}
                </p>
                <p className="mt-1 text-xs text-muted-foreground md:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="border-y border-border bg-card/40 grid-texture">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: TrendingDown,
              titulo: "Economia imediata",
              texto: "Desde o primeiro mês você paga bem menos pela energia que consome.",
            },
            {
              icon: ShieldCheck,
              titulo: "Projeto homologado",
              texto: "Cuidamos de toda a burocracia junto à concessionária de energia.",
            },
            {
              icon: Wrench,
              titulo: "Instalação própria",
              texto: "Equipe técnica da Woltz, sem terceirização, com garantia de serviço.",
            },
            {
              icon: Leaf,
              titulo: "Energia limpa",
              texto: "Reduza sua pegada de carbono e valorize seu imóvel.",
            },
          ].map((b) => (
            <div key={b.titulo} className="rounded-xl border border-border bg-card p-6">
              <b.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-display text-lg font-semibold">{b.titulo}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.texto}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <a
            href="#proposta"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground transition-transform hover:scale-105 glow-volt"
          >
            Quero começar a economizar
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>

      {/* Financiamento */}
      <section id="financiamento" className="border-y border-border bg-card/30">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="overflow-hidden rounded-2xl border border-primary/30 bg-card">
            {/* Header da taxa */}
            <div className="relative bg-gradient-to-r from-primary/15 via-primary/10 to-transparent px-6 py-10 text-center md:px-10">
              <div className="absolute inset-0 grid-texture opacity-30" />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-volt-soft px-4 py-1.5 text-sm font-bold text-primary">
                  <Zap className="h-4 w-4" />
                  Taxa especial
                </span>
                <div className="mt-4 flex items-end justify-center gap-2">
                  <span className="font-display text-6xl font-extrabold text-primary glow-volt md:text-7xl">
                    0,99%
                  </span>
                  <span className="mb-2 text-lg font-medium text-muted-foreground">
                    ao mês
                  </span>
                </div>
                <h2 className="mt-4 font-display text-2xl font-bold md:text-3xl">
                  Financie seu sistema de energia solar
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
                  A Woltz Solar fecha com a CAIXA uma condição especial para
                  você levar economia solar para casa.
                </p>
              </div>
            </div>

            {/* Cards de condições */}
            <div className="grid gap-0 md:grid-cols-3">
              <div className="flex flex-col items-center gap-3 px-6 py-8 text-center md:border-r md:border-border">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-volt-soft">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-base font-bold">
                  Até R$ 50 mil
                </h3>
                <p className="text-sm text-muted-foreground">
                  para instalação do seu sistema de energia solar.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 border-t border-border px-6 py-8 text-center md:border-r">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-volt-soft">
                  <CalendarDays className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-base font-bold">
                  Até 72 meses
                </h3>
                <p className="text-sm text-muted-foreground">
                  para pagar com parcelas que cabem no seu bolso.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 border-t border-border px-6 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-volt-soft">
                  <Handshake className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-base font-bold">
                  Condição especial
                </h3>
                <p className="text-sm text-muted-foreground">
                  em parceria com a CAIXA para levar mais economia até você.
                </p>
              </div>
            </div>

            {/* Parceria + CTA */}
            <div className="flex flex-col items-center gap-5 border-t border-border bg-background/40 px-6 py-8 md:flex-row md:justify-between">
              <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Parceria oficial: Woltz Solar + CAIXA
              </p>
              <a
                href="#proposta"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground transition-transform hover:scale-105 glow-volt"
              >
                Faça uma simulação gratuita agora
                <ArrowRight className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Projetos */}
      <section id="projetos" className="mx-auto max-w-6xl px-4 py-20">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">
            Portfólio
          </span>
          <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
            Projetos entregues
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Residências, empresas e propriedades rurais que já produzem a
            própria energia com a Woltz Solar.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {projetos.map((p) => (
            <article
              key={p.titulo}
              className="group overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="overflow-hidden">
                <img
                  src={p.imagem}
                  alt={p.titulo}
                  width={1024}
                  height={768}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                <h3 className="font-display text-lg font-semibold">{p.titulo}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.descricao}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-12 text-center">
          <a
            href="#proposta"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground transition-transform hover:scale-105 glow-volt"
          >
            Quero um projeto como este
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>

      {/* Prova social */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              Quem já economiza
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
              O que nossos clientes dizem
            </h2>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                4,9/5 — avaliação média dos clientes
              </span>
            </div>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {depoimentos.map((d) => (
              <figure
                key={d.nome}
                className="flex flex-col rounded-xl border border-border bg-card p-6"
              >
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">
                  “{d.texto}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-volt-soft font-display text-sm font-bold text-primary">
                    {d.iniciais}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{d.nome}</span>
                    <span className="block text-xs text-muted-foreground">{d.local}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-12 text-center">
            <a
              href="#proposta"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground transition-transform hover:scale-105 glow-volt"
            >
              Quero economia real como esses clientes
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>
      <section id="proposta" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              Proposta gratuita
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
              Descubra quanto você pode <span className="text-gradient-volt">economizar</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Responda as perguntas ao lado e receba uma simulação
              personalizada, sem compromisso. Nossa equipe entra em contato em
              até 1 dia útil.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "Simulação de economia com base na sua conta de luz",
                "Visita técnica e estudo do telhado sem custo",
                "Financiamento em até 72x — a parcela fica menor que a conta",
                "Homologação e garantia cuidadas pela Woltz",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm text-foreground/90">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-card p-6 md:p-8 glow-volt">
            {enviado ? (
              <div className="flex min-h-80 flex-col items-center justify-center text-center">
                <Zap className="h-14 w-14 text-primary" />
                <h3 className="mt-4 font-display text-2xl font-bold">Recebemos seus dados!</h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  Um especialista Woltz Solar vai te chamar no WhatsApp em até 1
                  dia útil com sua simulação de economia.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-display text-xl font-bold">
                  Solicite sua simulação
                </h3>
                <div>
                  <label htmlFor="nome" className="mb-1.5 block text-sm font-medium">
                    Nome completo *
                  </label>
                  <input
                    id="nome"
                    type="text"
                    required
                    maxLength={100}
                    value={form.nome}
                    onChange={set("nome")}
                    placeholder="Seu nome"
                    className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="whatsapp" className="mb-1.5 block text-sm font-medium">
                      WhatsApp *
                    </label>
                    <input
                      id="whatsapp"
                      type="tel"
                      required
                      maxLength={15}
                      inputMode="tel"
                      value={form.whatsapp}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, whatsapp: maskPhone(e.target.value) }))
                      }
                      placeholder="(51) 99999-9999"
                      className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                      E-mail
                    </label>
                    <input
                      id="email"
                      type="email"
                      maxLength={255}
                      value={form.email}
                      onChange={set("email")}
                      placeholder="voce@email.com"
                      className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cidade" className="mb-1.5 block text-sm font-medium">
                      Cidade/UF
                    </label>
                    <input
                      id="cidade"
                      type="text"
                      maxLength={80}
                      value={form.cidade}
                      onChange={set("cidade")}
                      placeholder="Londrina/PR"
                      className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="tipo" className="mb-1.5 block text-sm font-medium">
                      Tipo de imóvel
                    </label>
                    <select
                      id="tipo"
                      value={form.tipo}
                      onChange={set("tipo")}
                      className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                    >
                      <option>Residência</option>
                      <option>Comércio / Empresa</option>
                      <option>Indústria</option>
                      <option>Propriedade rural</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Valor médio da sua conta de luz *
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {faixasConta.map((faixa) => (
                      <button
                        type="button"
                        key={faixa}
                        onClick={() => setForm((f) => ({ ...f, conta: faixa }))}
                        className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
                          form.conta === faixa
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background text-foreground hover:border-primary/60"
                        }`}
                      >
                        {faixa}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={enviando}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-base font-bold text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-70"
                >
                  <Zap className="h-5 w-5" />
                  {enviando ? "Enviando..." : "Quero minha proposta gratuita"}
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Seus dados estão seguros e não serão compartilhados.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Áreas de atendimento */}
      <section id="areas" className="border-y border-border bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-volt-soft px-4 py-1.5 text-sm font-medium text-primary">
              <MapPin className="h-4 w-4" />
              Cobertura regional
            </span>
            <h2 className="mt-6 font-display text-3xl font-bold md:text-4xl">
              Áreas de atendimento
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              A Woltz Solar atende clientes em toda a região metropolitana de
              Porto Alegre e litoral sul do Rio Grande do Sul.
            </p>
          </div>
          <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
            <RSMap />
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
            {[
              "Porto Alegre",
              "Eldorado do Sul",
              "Barra do Ribeiro",
              "Tapes",
              "Mariana Pimentel",
              "Arambaré",
              "Camaquã",
              "Canoas",
              "Esteio",
              "Sapucaia do Sul",
              "São Leopoldo",
              "Novo Hamburgo",
              "Gravataí",
              "Cachoeirinha",
              "Alvorada",
              "Viamão",
            ].map((cidade) => (
              <span
                key={cidade}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium text-foreground/90"
              >
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {cidade}
              </span>
            ))}
            </div>
          </div>
          <div className="mt-10 text-center">
            <a
              href="#proposta"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground transition-transform hover:scale-105 glow-volt"
            >
              Quero atender na minha cidade
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center">
          <img src={logoAsset.url} alt="Woltz Solar" className="h-10 w-auto" />
          <p className="max-w-md text-sm text-muted-foreground">
            Energia solar fotovoltaica para residências, empresas e agronegócio.
            Economia real, projeto completo, instalação garantida.
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Woltz Solar. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
