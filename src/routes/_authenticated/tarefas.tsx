import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckSquare, Square, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { responsaveisQuery, toDateInput, type Tarefa } from "@/lib/crm-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — Woltz CRM" },
      { name: "description", content: "Agenda de tarefas comerciais por lead e responsável." },
      { property: "og:title", content: "Tarefas — Woltz CRM" },
      { property: "og:description", content: "Agenda de tarefas comerciais do funil." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TarefasPage,
});

type TarefaComLead = Tarefa & { leads: { id: string; nome: string } | null };

type Periodo = "hoje" | "atrasadas" | "semana" | "todas";

function TarefasPage() {
  const queryClient = useQueryClient();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [dia, setDia] = useState(toDateInput(new Date()));
  const [respFilter, setRespFilter] = useState("todos");
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);

  const responsaveis = useQuery(responsaveisQuery);

  const tarefas = useQuery({
    queryKey: ["tarefas"],
    queryFn: async (): Promise<TarefaComLead[]> => {
      const { data, error } = await supabase
        .from("lead_tarefas")
        .select("*, leads(id, nome)")
        .order("due_at", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as TarefaComLead[];
    },
  });

  const lista = useMemo(() => {
    const all = tarefas.data ?? [];
    const hojeStart = new Date(`${dia}T00:00:00`);
    const hojeEnd = new Date(`${dia}T23:59:59`);
    const semanaEnd = new Date(hojeStart.getTime() + 7 * 86400000);
    const agora = new Date();

    return all.filter((t) => {
      if (!mostrarConcluidas && t.concluida) return false;
      if (respFilter === "sem" && t.responsavel_id) return false;
      if (respFilter !== "todos" && respFilter !== "sem" && t.responsavel_id !== respFilter)
        return false;

      if (periodo === "todas") return true;
      if (!t.due_at) return false;
      const due = new Date(t.due_at);
      if (periodo === "hoje") return due >= hojeStart && due <= hojeEnd;
      if (periodo === "semana") return due >= hojeStart && due <= semanaEnd;
      return due < agora && !t.concluida;
    });
  }, [tarefas.data, periodo, dia, respFilter, mostrarConcluidas]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["lead-tarefas"] });
  }

  const toggle = useMutation({
    mutationFn: async (t: TarefaComLead) => {
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
    onSuccess: () => {
      toast.success("Tarefa removida.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const respNome = (id: string | null) =>
    id ? ((responsaveis.data ?? []).find((r) => r.id === id)?.nome ?? "—") : "Sem responsável";

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-2xl">Tarefas</h1>
        <p className="text-sm text-muted-foreground">{lista.length} tarefas no filtro atual</p>
      </div>

      <div className="surface-card mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1">
          <Label className="text-xs">Período</Label>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Do dia</SelectItem>
              <SelectItem value="atrasadas">Atrasadas</SelectItem>
              <SelectItem value="semana">Próximos 7 dias</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(periodo === "hoje" || periodo === "semana") && (
          <div className="space-y-1">
            <Label className="text-xs">Dia</Label>
            <Input
              type="date"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              className="w-40"
            />
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Responsável</Label>
          <Select value={respFilter} onValueChange={setRespFilter}>
            <SelectTrigger className="w-48">
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
        <Button variant="outline" onClick={() => setMostrarConcluidas((v) => !v)}>
          {mostrarConcluidas ? "Ocultar concluídas" : "Mostrar concluídas"}
        </Button>
      </div>

      {tarefas.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando tarefas...</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma tarefa neste filtro.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((t) => {
            const atrasada = t.due_at && !t.concluida && new Date(t.due_at) < new Date();
            return (
              <div
                key={t.id}
                className="surface-card flex flex-wrap items-center gap-3 p-3 text-sm"
              >
                <button onClick={() => toggle.mutate(t)} aria-label="Concluir tarefa">
                  {t.concluida ? (
                    <CheckSquare className="h-5 w-5 text-primary" />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <div className="min-w-40 flex-1">
                  <p className={t.concluida ? "line-through text-muted-foreground" : "font-medium"}>
                    {t.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Lead: {t.leads?.nome ?? "—"} · {respNome(t.responsavel_id)}
                  </p>
                </div>
                <Badge variant={atrasada ? "destructive" : "secondary"}>
                  {t.due_at
                    ? format(new Date(t.due_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    : "Sem prazo"}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => remove.mutate(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
