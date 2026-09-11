import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Paperclip,
  Trophy,
  XCircle,
  MessageSquare,
  Phone,
  Mail,
  Download,
  Trash2,
  Users,
  CheckSquare,
  Square,
  UserRound,
  Tag,
  Pencil,
  SlidersHorizontal,
  X,
  CalendarIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  STAGES,
  STATUS_LABELS,
  INVESTIMENTO_LABELS,
  maskPhone,
  channelLabel,
  resolveChannel,
  utmSummary,
  type Stage,
} from "@/lib/leads";
import {
  responsaveisQuery,
  motivosPerdaQuery,
  toDateInput,
  type Tarefa,
  type Responsavel,
} from "@/lib/crm-data";
import { leadsToCsv, downloadCsv } from "@/lib/export-csv";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "Funil de vendas — Woltz CRM" },
      { name: "description", content: "Gestão de oportunidades e leads da Rhopi Marcenaria." },
      { property: "og:title", content: "Funil de vendas — Woltz CRM" },
      { property: "og:description", content: "Gestão de oportunidades e leads." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CrmPage,
});

type Lead = {
  id: string;
  nome: string;
  telefone: string;
  cidade: string | null;
  email: string | null;
  tipo_esquadria: string[];
  investimento: string | null;
  investimento_valor: number | null;
  stage: Stage;
  status: string;
  estagio_obra: string | null;
  motivo_perda: string | null;
  fechado_em: string | null;
  responsavel_id: string | null;
  mensagem: string | null;
  quality_score: number | null;
  landing_page: string | null;
  updated_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  gclid: string | null;
  wbraid: string | null;
  gbraid: string | null;
  referrer: string | null;
  created_at: string;
};


const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function CrmPage() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fechamentoFrom, setFechamentoFrom] = useState("");
  const [fechamentoTo, setFechamentoTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [responsavelFilter, setResponsavelFilter] = useState<string>("todos");
  const [motivoFilter, setMotivoFilter] = useState<string>("todos");
  const [canalFilter, setCanalFilter] = useState<string>("todos");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [equipeOpen, setEquipeOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState<Date | undefined>(undefined);
  const [exportTo, setExportTo] = useState<Date | undefined>(undefined);


  const leadsQuery = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Lead[];
    },
  });

  const responsaveis = useQuery(responsaveisQuery);
  const motivos = useQuery(motivosPerdaQuery);
  const responsavelById = useMemo(() => {
    const map = new Map<string, Responsavel>();
    for (const r of responsaveis.data ?? []) map.set(r.id, r);
    return map;
  }, [responsaveis.data]);

  const motivoOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of motivos.data ?? []) set.add(m.motivo);
    for (const l of leadsQuery.data ?? []) if (l.motivo_perda) set.add(l.motivo_perda);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [motivos.data, leadsQuery.data]);

  const canalOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of leadsQuery.data ?? []) set.add(resolveChannel(l));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [leadsQuery.data]);

  const leads = useMemo(() => {
    const all = leadsQuery.data ?? [];
    return all.filter((l) => {
      const created = new Date(l.created_at);
      if (from && created < new Date(`${from}T00:00:00`)) return false;
      if (to && created > new Date(`${to}T23:59:59`)) return false;
      if (statusFilter !== "todos" && l.status !== statusFilter) return false;
      if (responsavelFilter === "sem" && l.responsavel_id) return false;
      if (
        responsavelFilter !== "todos" &&
        responsavelFilter !== "sem" &&
        l.responsavel_id !== responsavelFilter
      )
        return false;
      if (motivoFilter !== "todos" && (l.motivo_perda ?? "") !== motivoFilter) return false;
      if (canalFilter !== "todos" && resolveChannel(l) !== canalFilter) return false;
      if (fechamentoFrom || fechamentoTo) {
        if (l.status !== "ganho" && l.status !== "abandonado") return false;
        const closed = l.fechado_em ? new Date(l.fechado_em) : null;
        if (!closed) return false;
        if (fechamentoFrom && closed < new Date(`${fechamentoFrom}T00:00:00`)) return false;
        if (fechamentoTo && closed > new Date(`${fechamentoTo}T23:59:59`)) return false;
      }
      return true;
    });
  }, [
    leadsQuery.data,
    from,
    to,
    fechamentoFrom,
    fechamentoTo,
    statusFilter,
    responsavelFilter,
    motivoFilter,
    canalFilter,
  ]);

  function clearFilters() {
    setFrom("");
    setTo("");
    setFechamentoFrom("");
    setFechamentoTo("");
    setStatusFilter("todos");
    setResponsavelFilter("todos");
    setMotivoFilter("todos");
    setCanalFilter("todos");
  }

  const statusLabels: Record<string, string> = {
    aberto: "Aberto",
    ganho: "Ganho",
    abandonado: "Perdido",
  };

  const activeFilters: { key: string; label: string; value: string; clear: () => void }[] = [];
  if (from) activeFilters.push({ key: "from", label: "Criado de", value: from, clear: () => setFrom("") });
  if (to) activeFilters.push({ key: "to", label: "Criado até", value: to, clear: () => setTo("") });
  if (fechamentoFrom)
    activeFilters.push({
      key: "fFrom",
      label: "Fechamento de",
      value: fechamentoFrom,
      clear: () => setFechamentoFrom(""),
    });
  if (fechamentoTo)
    activeFilters.push({
      key: "fTo",
      label: "Fechamento até",
      value: fechamentoTo,
      clear: () => setFechamentoTo(""),
    });
  if (statusFilter !== "todos")
    activeFilters.push({
      key: "status",
      label: "Status",
      value: statusLabels[statusFilter] ?? statusFilter,
      clear: () => setStatusFilter("todos"),
    });
  if (responsavelFilter !== "todos")
    activeFilters.push({
      key: "resp",
      label: "Responsável",
      value:
        responsavelFilter === "sem"
          ? "Sem responsável"
          : (responsavelById.get(responsavelFilter)?.nome ?? "—"),
      clear: () => setResponsavelFilter("todos"),
    });
  if (motivoFilter !== "todos")
    activeFilters.push({
      key: "motivo",
      label: "Motivo",
      value: motivoFilter,
      clear: () => setMotivoFilter("todos"),
    });
  if (canalFilter !== "todos")
    activeFilters.push({
      key: "canal",
      label: "Canal",
      value: canalFilter,
      clear: () => setCanalFilter("todos"),
    });


  // Mantém o lead aberto sincronizado com os dados mais recentes
  useEffect(() => {
    if (!selected) return;
    const fresh = (leadsQuery.data ?? []).find((l) => l.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [leadsQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notificação em tempo real de novos leads
  const seenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const channel = supabase
      .channel("crm-new-leads")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload) => {
        const lead = payload.new as { id: string; nome?: string; cidade?: string | null };
        if (seenRef.current.has(lead.id)) return;
        seenRef.current.add(lead.id);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        toast.success(`Novo lead: ${lead.nome ?? "sem nome"}`, {
          description: lead.cidade ? `Cidade: ${lead.cidade}` : "Confira no funil de vendas.",
          duration: 10000,
        });
        try {
          const ctx = new (
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          )();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        } catch {
          /* som é opcional */
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const moveMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function onDrop(e: React.DragEvent, stage: Stage) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) moveMutation.mutate({ id, stage });
  }

  const total = leads.reduce((acc, l) => acc + (l.investimento_valor ?? 0), 0);

  function exportCsv() {
    setExportOpen(true);
  }

  function confirmExport() {
    const fromDate = exportFrom ? new Date(exportFrom) : undefined;
    const toDate = exportTo ? new Date(exportTo) : undefined;
    if (fromDate) fromDate.setHours(0, 0, 0, 0);
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const filtered = leads.filter((l) => {
      const created = new Date(l.created_at);
      if (fromDate && created < fromDate) return false;
      if (toDate && created > toDate) return false;
      return true;
    });

    if (filtered.length === 0) {
      toast.error("Nenhum lead para exportar no período selecionado.");
      return;
    }

    const csv = leadsToCsv(filtered, (id) => (id ? (responsavelById.get(id)?.nome ?? "") : ""));
    downloadCsv(`leads-${toDateInput(new Date())}.csv`, csv);
    toast.success(`${filtered.length} lead(s) exportado(s).`);
    setExportOpen(false);
    setExportFrom(undefined);
    setExportTo(undefined);
  }

  function DatePicker({
    value,
    onChange,
    placeholder,
  }: {
    value: Date | undefined;
    onChange: (date: Date | undefined) => void;
    placeholder?: string;
  }) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy") : <span>{placeholder ?? "Selecione"}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    );
  }


  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Funil de vendas</h1>
          <p className="text-sm text-muted-foreground">
            {leads.length} oportunidades · {BRL.format(total)} em pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="mr-1 h-4 w-4" /> Filtrar
            {activeFilters.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[11px]">
                {activeFilters.length}
              </Badge>
            )}
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> Exportar CSV
          </Button>

          <Button variant="outline" onClick={() => setEquipeOpen(true)}>
            <Users className="mr-1 h-4 w-4" /> Responsáveis
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nova oportunidade
          </Button>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <Badge key={f.key} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1 font-normal">
              <span className="text-muted-foreground">{f.label}:</span> {f.value}
              <button
                type="button"
                aria-label={`Remover filtro ${f.label}`}
                onClick={f.clear}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpar tudo
          </Button>
        </div>
      )}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Refine as oportunidades exibidas no funil.</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Criação do lead
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="from" className="text-xs">
                    De
                  </Label>
                  <Input
                    id="from"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to" className="text-xs">
                    Até
                  </Label>
                  <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Data de fechamento
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fechamentoFrom" className="text-xs">
                    De
                  </Label>
                  <Input
                    id="fechamentoFrom"
                    type="date"
                    value={fechamentoFrom}
                    onChange={(e) => setFechamentoFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fechamentoTo" className="text-xs">
                    Até
                  </Label>
                  <Input
                    id="fechamentoTo"
                    type="date"
                    value={fechamentoTo}
                    onChange={(e) => setFechamentoTo(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Classificação
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="ganho">Ganho</SelectItem>
                    <SelectItem value="abandonado">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Responsável</Label>
                <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sem">Sem responsável</SelectItem>
                    {(responsaveis.data ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Motivo de perda</Label>
                <Select value={motivoFilter} onValueChange={setMotivoFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {motivoOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Canal</Label>
                <Select value={canalFilter} onValueChange={setCanalFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {canalOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={clearFilters}
                disabled={activeFilters.length === 0}
              >
                Limpar
              </Button>
              <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                Ver {leads.length} resultado{leads.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>


      {leadsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando leads...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {STAGES.map((stage) => {
            const items = leads.filter((l) => l.stage === stage.key);
            const stageTotal = items.reduce((acc, l) => acc + (l.investimento_valor ?? 0), 0);
            return (
              <div
                key={stage.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, stage.key)}
                className="flex h-[calc(100vh-19rem)] min-h-64 flex-col rounded-xl bg-surface p-3"
              >
                <div className="sticky top-0 z-10 mb-3 rounded-lg bg-surface px-1 py-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{stage.label}</h2>
                    <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                    {BRL.format(stageTotal)}
                  </p>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
                  {items.map((lead) => (
                    <button
                      key={lead.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
                      onClick={() => setSelected(lead)}
                      className={[
                        "surface-card w-full shrink-0 cursor-grab border-l-4 p-3 text-left transition-shadow hover:shadow-elegant active:cursor-grabbing",
                        lead.status === "ganho"
                          ? "border-l-green-500 bg-green-500/[0.06]"
                          : lead.status === "abandonado"
                            ? "border-l-red-500 bg-red-500/[0.06]"
                            : "border-l-transparent",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold">{lead.nome}</span>
                        {lead.status !== "aberto" && (
                          <Badge variant={lead.status === "ganho" ? "default" : "destructive"}>
                            {STATUS_LABELS[lead.status]}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {lead.telefone}
                      </p>
                      <p className="mt-2 text-base font-bold">
                        {lead.investimento_valor != null
                          ? BRL.format(lead.investimento_valor)
                          : (INVESTIMENTO_LABELS[lead.investimento ?? ""] ?? "Sem valor")}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs">
                        <Badge variant="outline" className="gap-1 font-normal">
                          <Tag className="h-3 w-3" />
                          {resolveChannel(lead)}
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <UserRound className="h-3 w-3" />
                          {lead.responsavel_id
                            ? (responsavelById.get(lead.responsavel_id)?.nome ?? "—")
                            : "Sem responsável"}
                        </Badge>
                      </div>
                    </button>
                  ))}
                  {items.length === 0 && (
                    <p className="px-1 text-xs text-muted-foreground">Arraste cards para cá</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateLeadDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ResponsaveisDialog open={equipeOpen} onOpenChange={setEquipeOpen} />
      <LeadDetailDialog lead={selected} onClose={() => setSelected(null)} />

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar leads em CSV</DialogTitle>
            <DialogDescription>
              Escolha o período de criação dos leads que deseja exportar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="export-from">De</Label>
                <DatePicker value={exportFrom} onChange={setExportFrom} placeholder="Data inicial" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="export-to">Até</Label>
                <DatePicker value={exportTo} onChange={setExportTo} placeholder="Data final" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Serão exportados os leads filtrados atualmente que também estiverem dentro do período.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmExport}>Exportar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResponsaveisDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const responsaveis = useQuery(responsaveisQuery);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("responsaveis")
        .insert({ nome: nome.trim().slice(0, 120), email: email.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      setNome("");
      setEmail("");
      toast.success("Responsável cadastrado.");
      queryClient.invalidateQueries({ queryKey: ["responsaveis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("responsaveis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Responsável removido.");
      queryClient.invalidateQueries({ queryKey: ["responsaveis"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responsáveis</DialogTitle>
          <DialogDescription>Vendedores que podem ser atribuídos aos leads.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1 space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Vendedor" />
          </div>
          <div className="min-w-40 flex-1 space-y-1">
            <Label className="text-xs">E-mail (opcional)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vendedor@empresa.com"
            />
          </div>
          <Button disabled={!nome.trim() || create.isPending} onClick={() => create.mutate()}>
            Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {(responsaveis.data ?? []).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{r.nome}</p>
                {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => remove.mutate(r.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {(responsaveis.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum responsável cadastrado ainda.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const responsaveis = useQuery(responsaveisQuery);
  const emptyForm = {
    nome: "",
    email: "",
    telefone: "",
    valor: "",
    responsavel_id: "sem",
  };
  const [form, setForm] = useState(emptyForm);

  const mutation = useMutation({
    mutationFn: async () => {
      const email = form.email.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("E-mail inválido.");
      }
      const { error } = await supabase.from("leads").insert({
        nome: form.nome.trim().slice(0, 120),
        email: email.slice(0, 255) || null,
        telefone: form.telefone.trim().slice(0, 40),
        investimento_valor: form.valor ? Number(form.valor) : null,
        responsavel_id: form.responsavel_id === "sem" ? null : form.responsavel_id,
        utm_source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Oportunidade criada.");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onOpenChange(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova oportunidade</DialogTitle>
          <DialogDescription>Cadastro manual de um lead no funil.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Nome completo *</Label>
            <Input
              maxLength={120}
              placeholder="Nome do cliente"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input
                type="email"
                maxLength={255}
                placeholder="cliente@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp / Telefone *</Label>
              <Input
                inputMode="tel"
                maxLength={15}
                placeholder="(00) 00000-0000"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor do projeto (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Select
                value={form.responsavel_id}
                onValueChange={(v) => setForm({ ...form, responsavel_id: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem">Sem responsável</SelectItem>
                  {(responsaveis.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!form.nome || !form.telefone || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Criar oportunidade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type TimelineEntry = {
  id: string;
  content: string;
  created_at: string;
  attachments: { id: string; file_name: string; file_path: string }[];
};

function LeadDetailDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const { isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [motivoId, setMotivoId] = useState("");
  const [motivoOutro, setMotivoOutro] = useState("");
  const [perdaOpen, setPerdaOpen] = useState(false);
  const [editandoContato, setEditandoContato] = useState(false);
  const [contato, setContato] = useState({
    nome: "",
    telefone: "",
    email: "",
    cidade: "",
    valor: "",
    responsavel_id: "sem",
  });

  const responsaveis = useQuery(responsaveisQuery);
  const motivos = useQuery(motivosPerdaQuery);

  useEffect(() => {
    if (!lead) return;
    setEditandoContato(false);
    setMotivoId("");
    setMotivoOutro("");
    setContato({
      nome: lead.nome ?? "",
      telefone: lead.telefone ?? "",
      email: lead.email ?? "",
      cidade: lead.cidade ?? "",
      valor: lead.investimento_valor != null ? String(lead.investimento_valor) : "",
      responsavel_id: lead.responsavel_id ?? "sem",
    });
  }, [lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveContato = useMutation({
    mutationFn: async () => {
      const email = contato.email.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
      if (!contato.nome.trim()) throw new Error("Informe o nome.");
      if (!contato.telefone.trim()) throw new Error("Informe o telefone.");
      const parsed = contato.valor.trim() === "" ? null : Number(contato.valor.replace(",", "."));
      if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
        throw new Error("Informe um valor válido.");
      }
      const { error } = await supabase
        .from("leads")
        .update({
          nome: contato.nome.trim().slice(0, 120),
          telefone: contato.telefone.trim().slice(0, 40),
          email: email.slice(0, 255) || null,
          cidade: contato.cidade.trim() || null,
          investimento_valor: parsed,
          responsavel_id: contato.responsavel_id === "sem" ? null : contato.responsavel_id,
        })
        .eq("id", lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados do lead atualizados.");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLead = useMutation({
    mutationFn: async () => {
      const leadId = lead!.id;
      const { data: atts, error: attErr } = await supabase
        .from("lead_attachments")
        .select("id, file_path")
        .eq("lead_id", leadId);
      if (attErr) throw attErr;

      if (atts && atts.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from("lead-attachments")
          .remove(atts.map((a) => a.file_path));
        if (storageErr) throw storageErr;
        const { error: delAttErr } = await supabase
          .from("lead_attachments")
          .delete()
          .eq("lead_id", leadId);
        if (delAttErr) throw delAttErr;
      }

      const { error: delNotesErr } = await supabase
        .from("lead_notes")
        .delete()
        .eq("lead_id", leadId);
      if (delNotesErr) throw delNotesErr;

      const { error } = await supabase.from("leads").delete().eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead excluído.");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const timeline = useQuery({
    queryKey: ["lead-timeline", lead?.id],
    enabled: Boolean(lead),
    queryFn: async (): Promise<TimelineEntry[]> => {
      const { data: notes, error } = await supabase
        .from("lead_notes")
        .select("id, content, created_at")
        .eq("lead_id", lead!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: atts, error: attErr } = await supabase
        .from("lead_attachments")
        .select("id, note_id, file_name, file_path")
        .eq("lead_id", lead!.id);
      if (attErr) throw attErr;
      return (notes ?? []).map((n) => ({
        ...n,
        attachments: (atts ?? [])
          .filter((a) => a.note_id === n.id)
          .map((a) => ({ id: a.id, file_name: a.file_name, file_path: a.file_path })),
      }));
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const { data: created, error } = await supabase
        .from("lead_notes")
        .insert({ lead_id: lead!.id, content: note })
        .select("id")
        .single();
      if (error) throw error;

      if (files && files.length > 0) {
        for (const file of Array.from(files)) {
          const path = `${lead!.id}/${crypto.randomUUID()}-${file.name}`;
          const { error: upErr } = await supabase.storage
            .from("lead-attachments")
            .upload(path, file);
          if (upErr) throw upErr;
          const { error: metaErr } = await supabase.from("lead_attachments").insert({
            lead_id: lead!.id,
            note_id: created.id,
            file_path: path,
            file_name: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
          });
          if (metaErr) throw metaErr;
        }
      }
    },
    onSuccess: () => {
      setNote("");
      setFiles(null);
      toast.success("Registro adicionado à timeline.");
      queryClient.invalidateQueries({ queryKey: ["lead-timeline", lead?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ status, motivoPerda }: { status: string; motivoPerda?: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({
          status: status as never,
          motivo_perda: motivoPerda ?? null,
          fechado_em: status === "aberto" ? null : new Date().toISOString(),
          stage: status === "ganho" ? "vendas" : lead!.stage,
        })
        .eq("id", lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Status atualizado.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openAttachment(path: string) {
    const { data, error } = await supabase.storage
      .from("lead-attachments")
      .createSignedUrl(path, 60 * 10);
    if (error || !data) {
      toast.error("Não foi possível abrir o anexo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const motivoSelecionado = (motivos.data ?? []).find((m) => m.id === motivoId);
  const motivoFinal =
    motivoSelecionado?.motivo === "Outro"
      ? motivoOutro.trim()
      : (motivoSelecionado?.motivo ?? "").trim();

  return (
    <Dialog open={Boolean(lead)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {lead && (
          <>
            <DialogHeader>
              <DialogTitle>{lead.nome}</DialogTitle>
              <DialogDescription>
                Criado em {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}{" "}
                · {resolveChannel(lead)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Dados do lead</h3>
                {!editandoContato && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => setEditandoContato(true)}
                    aria-label="Editar dados do lead"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {editandoContato ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome *</Label>
                    <Input
                      value={contato.nome}
                      onChange={(e) => setContato({ ...contato, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">WhatsApp / Telefone *</Label>
                    <Input
                      inputMode="tel"
                      maxLength={15}
                      value={contato.telefone}
                      onChange={(e) => setContato({ ...contato, telefone: maskPhone(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail</Label>
                    <Input
                      type="email"
                      value={contato.email}
                      onChange={(e) => setContato({ ...contato, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cidade</Label>
                    <Input
                      value={contato.cidade}
                      onChange={(e) => setContato({ ...contato, cidade: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor do projeto (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0,00"
                      value={contato.valor}
                      onChange={(e) => setContato({ ...contato, valor: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Responsável</Label>
                    <Select
                      value={contato.responsavel_id}
                      onValueChange={(v) => setContato({ ...contato, responsavel_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem">Sem responsável</SelectItem>
                        {(responsaveis.data ?? []).map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button
                      size="sm"
                      disabled={saveContato.isPending}
                      onClick={() => saveContato.mutate()}
                    >
                      {saveContato.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saveContato.isPending}
                      onClick={() => {
                        setEditandoContato(false);
                        setContato({
                          nome: lead.nome ?? "",
                          telefone: lead.telefone ?? "",
                          email: lead.email ?? "",
                          cidade: lead.cidade ?? "",
                          valor: lead.investimento_valor != null ? String(lead.investimento_valor) : "",
                          responsavel_id: lead.responsavel_id ?? "sem",
                        });
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.telefone}</span>
                  </div>
                  {lead.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.email}</span>
                    </div>
                  )}
                  {lead.cidade && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Cidade:</span>
                      <span>{lead.cidade}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-semibold">
                      {lead.investimento_valor != null
                        ? BRL.format(lead.investimento_valor)
                        : (INVESTIMENTO_LABELS[lead.investimento ?? ""] ?? "Valor não informado")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Responsável:</span>
                    <span>
                    {lead.responsavel_id
                        ? (
                            (responsaveis.data ?? []).find((r) => r.id === lead.responsavel_id)
                              ?.nome ?? "—"
                          )
                        : "Sem responsável"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Origem / UTMs</h3>
                <Badge variant="outline" className="font-normal">
                  {resolveChannel(lead)}
                </Badge>
              </div>
              {utmSummary(lead).length > 0 ? (
                <div className="grid gap-1 text-xs sm:grid-cols-2">
                  {utmSummary(lead).map((row) => (
                    <div key={row.label} className="flex flex-col">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="break-all font-medium">{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhuma UTM registrada para este lead.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setStatus.mutate({ status: "ganho" })}>
                <Trophy className="mr-1 h-4 w-4" /> Marcar como ganho
              </Button>
              <AlertDialog open={perdaOpen} onOpenChange={setPerdaOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <XCircle className="mr-1 h-4 w-4" /> Marcar como perdido
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Motivo da perda</AlertDialogTitle>
                    <AlertDialogDescription>
                      Informar o motivo da perda é obrigatório. Selecione um dos motivos cadastrados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Select value={motivoId} onValueChange={setMotivoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o motivo *" />
                    </SelectTrigger>
                    <SelectContent>
                      {(motivos.data ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.motivo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {motivoSelecionado?.motivo === "Outro" && (
                    <Textarea
                      value={motivoOutro}
                      onChange={(e) => setMotivoOutro(e.target.value)}
                      placeholder="Descreva o motivo da perda *"
                      required
                    />
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={!motivoSelecionado || setStatus.isPending}
                      onClick={(e) => {
                        if (!motivoSelecionado) {
                          e.preventDefault();
                          toast.error("É obrigatório informar o motivo da perda.");
                          return;
                        }
                        if (motivoSelecionado.motivo === "Outro" && motivoOutro.trim().length < 3) {
                          e.preventDefault();
                          toast.error("É obrigatório descrever o motivo da perda.");
                          return;
                        }
                        setStatus.mutate({ status: "abandonado", motivoPerda: motivoFinal });
                      }}
                    >
                      Confirmar perda
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {lead.status !== "aberto" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus.mutate({ status: "aberto" })}
                >
                  Reabrir
                </Button>
              )}
              {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="ml-auto text-destructive">
                    <Trash2 className="mr-1 h-4 w-4" /> Excluir lead
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir esta oportunidade?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O lead <strong>{lead.nome}</strong>, suas anotações e anexos serão apagados
                      definitivamente. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteLead.mutate()}
                      disabled={deleteLead.isPending}
                    >
                      {deleteLead.isPending ? "Excluindo..." : "Excluir"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              )}
            </div>

            {lead.status === "abandonado" && lead.motivo_perda && (
              <p className="rounded-lg bg-surface p-3 text-sm text-muted-foreground">
                <strong>Motivo da perda:</strong> {lead.motivo_perda}
              </p>
            )}

            <LeadTarefas leadId={lead.id} />

            <div className="space-y-2 border-t border-border pt-4">
              <Label className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" /> Nova anotação
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Registre o contato, orçamento enviado, visita agendada..."
              />
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(e.target.files)}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-xs"
              />
              <Button
                size="sm"
                disabled={!note || addNote.isPending}
                onClick={() => addNote.mutate()}
              >
                {addNote.isPending ? "Salvando..." : "Adicionar à timeline"}
              </Button>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Histórico</h3>
              {timeline.isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
              {timeline.data?.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>
              )}
              {timeline.data?.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{entry.content}</p>
                  {entry.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.attachments.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => openAttachment(a.file_path)}
                          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
                        >
                          <Paperclip className="h-3 w-3" />
                          {a.file_name}
                          <Download className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LeadTarefas({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient();
  const responsaveis = useQuery(responsaveisQuery);
  const [titulo, setTitulo] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [respId, setRespId] = useState("sem");

  const tarefas = useQuery({
    queryKey: ["lead-tarefas", leadId],
    queryFn: async (): Promise<Tarefa[]> => {
      const { data, error } = await supabase
        .from("lead_tarefas")
        .select("*")
        .eq("lead_id", leadId)
        .order("concluida")
        .order("due_at", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Tarefa[];
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["lead-tarefas", leadId] });
    queryClient.invalidateQueries({ queryKey: ["tarefas"] });
  }

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lead_tarefas").insert({
        lead_id: leadId,
        titulo: titulo.trim().slice(0, 200),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        responsavel_id: respId === "sem" ? null : respId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitulo("");
      setDueAt("");
      toast.success("Tarefa criada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (t: Tarefa) => {
      const { error } = await supabase
        .from("lead_tarefas")
        .update({
          concluida: !t.concluida,
          concluida_em: !t.concluida ? new Date().toISOString() : null,
        })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Tarefas</h3>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1">
          <Label className="text-xs">Tarefa</Label>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: ligar para o cliente"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Vencimento</Label>
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-52"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Responsável</Label>
          <Select value={respId} onValueChange={setRespId}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sem">Sem responsável</SelectItem>
              {(responsaveis.data ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" disabled={!titulo.trim() || create.isPending} onClick={() => create.mutate()}>
          Adicionar
        </Button>
      </div>

      <div className="space-y-2">
        {(tarefas.data ?? []).map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <button onClick={() => toggle.mutate(t)} aria-label="Concluir tarefa">
              {t.concluida ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className={t.concluida ? "line-through text-muted-foreground" : ""}>{t.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {t.due_at
                  ? format(new Date(t.due_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : "Sem prazo"}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => remove.mutate(t.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {(tarefas.data ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma tarefa para este lead.</p>
        )}
      </div>
    </div>
  );
}
